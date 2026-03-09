import mongoose from 'mongoose';
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { UploadModel } from '../models/upload.model.js';
import { PatientProfileModel } from '../models/patient-profile.model.js';
import { badRequest, notFound, forbidden } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { s3Client, isS3Configured, getBucketForPurpose } from '../lib/s3.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_PURPOSES = [
  'practice_video',
  'message_attachment',
  'therapist_feedback',
  'exercise_media',
] as const;

const VALID_CONTENT_TYPES = [
  'video/mp4',
  'video/quicktime',
  'image/jpeg',
  'image/png',
] as const;

const VIDEO_CONTENT_TYPES = new Set<string>(['video/mp4', 'video/quicktime']);
const IMAGE_CONTENT_TYPES = new Set<string>(['image/jpeg', 'image/png']);

const MAX_VIDEO_BYTES = 500 * 1024 * 1024; // 500 MB
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;  // 10 MB

const PRESIGNED_URL_TTL_SECONDS = 900; // 15 minutes
const PRESIGNED_URL_TTL_MS = PRESIGNED_URL_TTL_SECONDS * 1000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function contentTypeToExtension(contentType: string): string {
  const map: Record<string, string> = {
    'video/mp4': 'mp4',
    'video/quicktime': 'mov',
    'image/jpeg': 'jpg',
    'image/png': 'png',
  };
  return map[contentType] ?? 'bin';
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RequestUploadParams {
  purpose: string;
  contentType: string;
  sizeBytes: number;
  userId: string;
  role: 'client' | 'therapist' | 'admin';
}

export interface RequestUploadResult {
  uploadId: string;
  uploadUrl: string;
  expiresAt: string;
  status: 'pending';
}

export interface CompleteUploadResult {
  uploadId: string;
  status: string;
  contentType: string;
  sizeBytes: number;
}

export interface AccessUploadResult {
  uploadId: string;
  accessUrl: string;
  expiresAt: string;
}

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

/**
 * Validate request fields and create a pending Upload document.
 * Returns a real pre-signed S3 URL when AWS is configured, or a mock URL
 * for local development / CI without AWS credentials.
 */
export async function requestUpload(
  params: RequestUploadParams,
): Promise<RequestUploadResult> {
  const { purpose, contentType, sizeBytes, userId, role } = params;

  // Validate purpose
  if (!VALID_PURPOSES.includes(purpose as (typeof VALID_PURPOSES)[number])) {
    throw badRequest('Invalid purpose', {
      purpose,
      allowed: [...VALID_PURPOSES],
    });
  }

  // Validate contentType
  if (
    !VALID_CONTENT_TYPES.includes(
      contentType as (typeof VALID_CONTENT_TYPES)[number],
    )
  ) {
    throw badRequest('Invalid contentType', {
      contentType,
      allowed: [...VALID_CONTENT_TYPES],
    });
  }

  // Validate sizeBytes
  if (typeof sizeBytes !== 'number' || !Number.isInteger(sizeBytes) || sizeBytes <= 0) {
    throw badRequest('sizeBytes must be a positive integer');
  }

  const isVideo = VIDEO_CONTENT_TYPES.has(contentType);
  const isImage = IMAGE_CONTENT_TYPES.has(contentType);

  if (isVideo && sizeBytes > MAX_VIDEO_BYTES) {
    throw badRequest(
      `Video files must not exceed ${MAX_VIDEO_BYTES / (1024 * 1024)} MB`,
      { sizeBytes, maxBytes: MAX_VIDEO_BYTES },
    );
  }

  if (isImage && sizeBytes > MAX_IMAGE_BYTES) {
    throw badRequest(
      `Image files must not exceed ${MAX_IMAGE_BYTES / (1024 * 1024)} MB`,
      { sizeBytes, maxBytes: MAX_IMAGE_BYTES },
    );
  }

  // Determine target bucket based on upload purpose
  const bucket = getBucketForPurpose(purpose);

  // Generate uploadId from a new ObjectId so we can embed it in the S3 key
  const uploadObjectId = new mongoose.Types.ObjectId();
  const uploadId = uploadObjectId.toString();
  const timestamp = Date.now();
  const ext = contentTypeToExtension(contentType);
  const s3Key = `uploads/${purpose}/${userId}/${uploadId}_${timestamp}.${ext}`;

  // Persist the Upload document
  await UploadModel.create({
    _id: uploadObjectId,
    createdByUserId: userId,
    ownerRole: role,
    purpose,
    contentType,
    sizeBytes,
    s3Key,
    s3Bucket: bucket,
    status: 'pending',
  });

  // Generate pre-signed PUT URL
  const expiresAt = new Date(Date.now() + PRESIGNED_URL_TTL_MS).toISOString();
  let uploadUrl: string;

  if (isS3Configured && s3Client) {
    // Real S3 pre-signed URL
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: s3Key,
      ContentType: contentType,
    });
    uploadUrl = await getSignedUrl(s3Client, command, {
      expiresIn: PRESIGNED_URL_TTL_SECONDS,
    });

    logger.info('Upload requested (real pre-signed URL)', {
      uploadId,
      userId,
      purpose,
      contentType,
      sizeBytes,
      bucket,
    });
  } else {
    // Mock fallback for local dev / CI without AWS
    uploadUrl = `https://s3.amazonaws.com/${bucket}/${s3Key}?X-Amz-Expires=${PRESIGNED_URL_TTL_SECONDS}&X-Amz-Mock=true`;

    logger.info('Upload requested (mock pre-signed URL)', {
      uploadId,
      userId,
      purpose,
      contentType,
      sizeBytes,
    });
  }

  return { uploadId, uploadUrl, expiresAt, status: 'pending' };
}

/**
 * Mark a pending upload as available. Idempotent if already available.
 * Verifies that the caller owns the upload.
 */
export async function completeUpload(
  uploadId: string,
  userId: string,
): Promise<CompleteUploadResult> {
  let objectId: mongoose.Types.ObjectId;
  try {
    objectId = new mongoose.Types.ObjectId(uploadId);
  } catch {
    throw notFound(`Upload '${uploadId}' not found`);
  }

  const uploadDoc = await UploadModel.findById(objectId);
  if (!uploadDoc) {
    throw notFound(`Upload '${uploadId}' not found`);
  }

  // Ownership check
  if (uploadDoc.createdByUserId !== userId) {
    throw forbidden('You do not have permission to complete this upload');
  }

  // Idempotent: already available
  if (uploadDoc.status === 'available') {
    logger.info('Upload already available (idempotent complete)', {
      uploadId,
      userId,
    });
    return {
      uploadId,
      status: uploadDoc.status,
      contentType: uploadDoc.contentType,
      sizeBytes: uploadDoc.sizeBytes,
    };
  }

  uploadDoc.status = 'available';
  await uploadDoc.save();

  logger.info('Upload marked available', { uploadId, userId });

  return {
    uploadId,
    status: 'available',
    contentType: uploadDoc.contentType,
    sizeBytes: uploadDoc.sizeBytes,
  };
}

/**
 * Authorize access to an upload and return a signed access URL.
 *
 * Authorization rules:
 *   - Admin: always allowed.
 *   - Therapist: always allowed for exercise_media (non-PHI library content);
 *     for other uploads, must be the primary therapist of the associated patient.
 *   - Client: allowed if createdByUserId === callerUserId OR
 *     if the upload is therapist_feedback (feedback media for their exercises).
 */
export async function accessUpload(
  uploadId: string,
  userId: string,
  role: 'client' | 'therapist' | 'admin',
): Promise<AccessUploadResult> {
  let objectId: mongoose.Types.ObjectId;
  try {
    objectId = new mongoose.Types.ObjectId(uploadId);
  } catch {
    throw notFound(`Upload '${uploadId}' not found`);
  }

  const uploadDoc = await UploadModel.findById(objectId).lean();
  if (!uploadDoc) {
    throw notFound(`Upload '${uploadId}' not found`);
  }

  // Authorization
  if (role !== 'admin') {
    // exercise_media is non-PHI library content — therapists can always access
    const isExerciseMedia = uploadDoc.purpose === 'exercise_media';

    if (role === 'therapist') {
      if (!isExerciseMedia) {
        // Therapist may access uploads that belong to their assigned patients.
        if (!uploadDoc.patientId) {
          throw forbidden('Access denied: upload is not associated with a patient');
        }

        let patientObjectId: mongoose.Types.ObjectId;
        try {
          patientObjectId = new mongoose.Types.ObjectId(uploadDoc.patientId);
        } catch {
          throw forbidden('Access denied: invalid patient reference on upload');
        }

        const patientProfile = await PatientProfileModel.findById(patientObjectId)
          .select('primaryTherapistId')
          .lean();

        if (!patientProfile || patientProfile.primaryTherapistId !== userId) {
          throw forbidden(
            'Access denied: you are not the primary therapist for this patient',
          );
        }
      }
    } else {
      // role === 'client'
      const isOwner = uploadDoc.createdByUserId === userId;
      const isFeedbackMedia = uploadDoc.purpose === 'therapist_feedback';

      if (!isOwner && !isFeedbackMedia) {
        throw forbidden(
          'Access denied: you can only access your own uploads or feedback media',
        );
      }

      // If it is feedback media but not owned, we still allow it (therapist
      // uploaded it for this client's exercise). We do not have a direct
      // client→upload link for feedback media yet, so we allow all
      // therapist_feedback uploads for clients per MVP scope.
      // TODO (Milestone 4): Narrow by checking the feedback record's patientId.
    }
  }

  // Generate pre-signed GET URL
  const expiresAt = new Date(Date.now() + PRESIGNED_URL_TTL_MS).toISOString();
  const s3Key = uploadDoc.s3Key;
  let accessUrl: string;

  if (isS3Configured && s3Client) {
    // Real S3 pre-signed URL
    const command = new GetObjectCommand({
      Bucket: uploadDoc.s3Bucket,
      Key: s3Key,
    });
    accessUrl = await getSignedUrl(s3Client, command, {
      expiresIn: PRESIGNED_URL_TTL_SECONDS,
    });

    logger.info('Upload access URL generated', {
      uploadId,
      userId,
      role,
      purpose: uploadDoc.purpose,
      bucket: uploadDoc.s3Bucket,
    });
  } else {
    // Mock fallback
    accessUrl = `https://s3.amazonaws.com/${uploadDoc.s3Bucket}/${s3Key}?X-Amz-Expires=${PRESIGNED_URL_TTL_SECONDS}&X-Amz-Mock=true`;

    logger.info('Upload access URL generated (mock)', {
      uploadId,
      userId,
      role,
      purpose: uploadDoc.purpose,
    });
  }

  return { uploadId, accessUrl, expiresAt };
}
