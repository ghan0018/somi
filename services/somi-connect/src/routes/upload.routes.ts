import { Router, RequestHandler } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { createAuditEvent } from '../middleware/auditLog.js';
import { logger } from '../lib/logger.js';
import {
  requestUpload,
  completeUpload,
  accessUpload,
} from '../services/upload.service.js';

export const uploadRouter = Router();

// Shared middleware stacks
const authAllRoles = [authenticate, authorize('client', 'therapist', 'admin')];

// ---------------------------------------------------------------------------
// POST /v1/uploads
// Request a pre-signed upload URL. Returns uploadId + mock URL + expiry.
// ---------------------------------------------------------------------------
const requestUploadHandler: RequestHandler = async (req, res, next) => {
  try {
    const { purpose, contentType, sizeBytes } = req.body as {
      purpose?: unknown;
      contentType?: unknown;
      sizeBytes?: unknown;
    };

    const result = await requestUpload({
      purpose: typeof purpose === 'string' ? purpose : '',
      contentType: typeof contentType === 'string' ? contentType : '',
      sizeBytes: typeof sizeBytes === 'number' ? sizeBytes : NaN,
      userId: req.userId!,
      role: req.role as 'client' | 'therapist' | 'admin',
    });

    await createAuditEvent(req, {
      actionType: 'upload.create',
      resourceType: 'upload',
      resourceId: result.uploadId,
    });

    logger.info('Upload requested', {
      correlationId: req.correlationId,
      userId: req.userId,
      uploadId: result.uploadId,
      purpose,
      contentType,
    });

    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// POST /v1/uploads/:uploadId/complete
// Mark a pending upload as available. Verifies ownership.
// ---------------------------------------------------------------------------
const completeUploadHandler: RequestHandler = async (req, res, next) => {
  try {
    const { uploadId } = req.params;

    const result = await completeUpload(uploadId, req.userId!);

    await createAuditEvent(req, {
      actionType: 'upload.complete',
      resourceType: 'upload',
      resourceId: uploadId,
    });

    logger.info('Upload completed', {
      correlationId: req.correlationId,
      userId: req.userId,
      uploadId,
    });

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// POST /v1/uploads/:uploadId/access
// Generate a short-lived signed URL to access an uploaded file.
// ---------------------------------------------------------------------------
const accessUploadHandler: RequestHandler = async (req, res, next) => {
  try {
    const { uploadId } = req.params;

    const result = await accessUpload(
      uploadId,
      req.userId!,
      req.role as 'client' | 'therapist' | 'admin',
    );

    await createAuditEvent(req, {
      actionType: 'media.access',
      resourceType: 'upload',
      resourceId: uploadId,
    });

    logger.info('Upload access URL generated', {
      correlationId: req.correlationId,
      userId: req.userId,
      uploadId,
      role: req.role,
    });

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// Mount routes
// ---------------------------------------------------------------------------

uploadRouter.post('/', ...authAllRoles, requestUploadHandler);

uploadRouter.post('/:uploadId/complete', ...authAllRoles, completeUploadHandler);

uploadRouter.post('/:uploadId/access', ...authAllRoles, accessUploadHandler);
