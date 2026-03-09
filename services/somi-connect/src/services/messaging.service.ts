import { Types } from 'mongoose';
import { MessageThreadModel } from '../models/message-thread.model.js';
import { MessageModel } from '../models/message.model.js';
import { PatientProfileModel } from '../models/patient-profile.model.js';
import { UploadModel } from '../models/upload.model.js';
import { badRequest, forbidden, notFound } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ThreadResult {
  threadId: string;
  patientId: string;
  therapistUserId: string;
  lastMessageAt?: string;
  status: 'active' | 'archived';
}

export interface MessageResult {
  messageId: string;
  threadId: string;
  senderUserId: string;
  senderRole: 'client' | 'therapist' | 'admin';
  text: string;
  attachments: Array<{ uploadId: string; contentType: string; purpose: string }>;
  createdAt: string;
}

export interface ListMessagesResult {
  items: MessageResult[];
  nextCursor: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

function decodeCursor(cursor: string): string {
  try {
    return Buffer.from(cursor, 'base64').toString('utf8');
  } catch {
    throw badRequest('Invalid pagination cursor');
  }
}

function encodeCursor(id: unknown): string {
  return Buffer.from(String(id)).toString('base64');
}

// ---------------------------------------------------------------------------
// getOrCreateThreadForClient
// Finds or creates a MessageThread for a patient (client-facing).
// ---------------------------------------------------------------------------

export async function getOrCreateThreadForClient(callerUserId: string): Promise<ThreadResult> {
  const profile = await PatientProfileModel.findOne({ userId: callerUserId }).lean();
  if (!profile) {
    throw notFound('Patient profile not found for this user');
  }

  const patientId = String(profile._id);
  const therapistUserId = profile.primaryTherapistId ?? '';

  let thread = await MessageThreadModel.findOne({ patientId }).lean();

  if (!thread) {
    const created = await MessageThreadModel.create({
      patientId,
      therapistUserId,
      status: 'active',
    });
    logger.info('Message thread created for client', { patientId });
    thread = created.toObject();
  }

  return {
    threadId: String(thread._id),
    patientId: thread.patientId,
    therapistUserId: thread.therapistUserId,
    lastMessageAt: thread.lastMessageAt?.toISOString(),
    status: thread.status,
  };
}

// ---------------------------------------------------------------------------
// getOrCreateThreadForPatient
// Finds or creates a MessageThread for a patient (therapist/admin-facing).
// The caller must already have been authorized via loadAndAuthorizePatient.
// ---------------------------------------------------------------------------

export async function getOrCreateThreadForPatient(
  patientId: string,
  therapistUserId: string,
): Promise<ThreadResult> {
  let thread = await MessageThreadModel.findOne({ patientId }).lean();

  if (!thread) {
    const created = await MessageThreadModel.create({
      patientId,
      therapistUserId,
      status: 'active',
    });
    logger.info('Message thread created for patient', { patientId });
    thread = created.toObject();
  }

  return {
    threadId: String(thread._id),
    patientId: thread.patientId,
    therapistUserId: thread.therapistUserId,
    lastMessageAt: thread.lastMessageAt?.toISOString(),
    status: thread.status,
  };
}

// ---------------------------------------------------------------------------
// authorizeThreadAccess
// Verifies that the caller is allowed to read/write messages in the thread.
// Returns the patientId of the thread (for audit logging).
// ---------------------------------------------------------------------------

export async function authorizeThreadAccess(
  threadId: string,
  callerUserId: string,
  callerRole: 'client' | 'therapist' | 'admin',
): Promise<string> {
  if (!Types.ObjectId.isValid(threadId)) {
    throw notFound(`Thread '${threadId}' not found`);
  }

  const thread = await MessageThreadModel.findById(threadId).lean();
  if (!thread) {
    throw notFound(`Thread '${threadId}' not found`);
  }

  if (callerRole === 'admin') {
    return thread.patientId;
  }

  if (callerRole === 'client') {
    // Client must own the thread
    const profile = await PatientProfileModel.findOne({ userId: callerUserId }).lean();
    if (!profile || thread.patientId !== String(profile._id)) {
      throw forbidden('You do not have access to this thread');
    }
    return thread.patientId;
  }

  // therapist must be the assigned therapist for the patient
  const profile = await PatientProfileModel.findById(thread.patientId).lean();
  if (!profile) {
    throw notFound(`Patient for thread '${threadId}' not found`);
  }
  if (profile.primaryTherapistId !== callerUserId) {
    throw forbidden('You are not the assigned therapist for this patient');
  }

  return thread.patientId;
}

// ---------------------------------------------------------------------------
// listMessages
// Paginates messages in a thread, newest first.
// Authorization must be performed by the caller before calling this function.
// ---------------------------------------------------------------------------

export async function listMessages(
  threadId: string,
  params: { limit?: number; cursor?: string },
): Promise<ListMessagesResult> {
  const limit = Math.min(params.limit ?? DEFAULT_LIMIT, MAX_LIMIT);

  const query: Record<string, unknown> = { threadId };

  if (params.cursor) {
    const decodedId = decodeCursor(params.cursor);
    query['_id'] = { $lt: decodedId };
  }

  const docs = await MessageModel.find(query)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .lean();

  const hasMore = docs.length > limit;
  const page = hasMore ? docs.slice(0, limit) : docs;

  const items: MessageResult[] = page.map((doc) => ({
    messageId: String(doc._id),
    threadId: doc.threadId,
    senderUserId: doc.senderUserId,
    senderRole: doc.senderRole,
    text: doc.text,
    attachments: doc.attachments,
    createdAt: doc.createdAt.toISOString(),
  }));

  const nextCursor = hasMore ? encodeCursor(page[page.length - 1]._id) : null;

  return { items, nextCursor };
}

// ---------------------------------------------------------------------------
// sendMessage
// Creates a new message in the thread and updates thread.lastMessageAt.
// Authorization must be performed by the caller before calling this function.
// ---------------------------------------------------------------------------

export async function sendMessage(
  threadId: string,
  params: {
    senderUserId: string;
    senderRole: 'client' | 'therapist' | 'admin';
    text: string;
    attachmentUploadIds?: string[];
  },
): Promise<MessageResult> {
  if (!params.text?.trim()) {
    throw badRequest('text is required and cannot be empty');
  }

  // Validate attachments if provided
  const attachments: Array<{ uploadId: string; contentType: string; purpose: string }> = [];

  if (params.attachmentUploadIds && params.attachmentUploadIds.length > 0) {
    for (const uploadId of params.attachmentUploadIds) {
      const upload = await UploadModel.findById(uploadId).lean();
      if (!upload) {
        throw badRequest(`Upload '${uploadId}' not found`);
      }
      if (upload.status !== 'available') {
        throw badRequest(`Upload '${uploadId}' is not available (status: ${upload.status})`);
      }
      attachments.push({
        uploadId: String(upload._id),
        contentType: upload.contentType,
        purpose: upload.purpose,
      });
    }
  }

  const message = await MessageModel.create({
    threadId,
    senderUserId: params.senderUserId,
    senderRole: params.senderRole,
    text: params.text.trim(),
    attachments,
  });

  // Update thread.lastMessageAt
  await MessageThreadModel.findByIdAndUpdate(threadId, {
    lastMessageAt: message.createdAt,
  });

  logger.info('Message sent', {
    threadId,
    messageId: String(message._id),
    senderRole: params.senderRole,
  });

  return {
    messageId: String(message._id),
    threadId: message.threadId,
    senderUserId: message.senderUserId,
    senderRole: message.senderRole,
    text: message.text,
    attachments: message.attachments,
    createdAt: message.createdAt.toISOString(),
  };
}
