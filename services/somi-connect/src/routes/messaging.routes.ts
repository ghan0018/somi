import { Router, RequestHandler } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { createAuditEvent } from '../middleware/auditLog.js';
import { loadAndAuthorizePatient } from '../services/patient.service.js';
import {
  getOrCreateThreadForClient,
  getOrCreateThreadForPatient,
  authorizeThreadAccess,
  listMessages,
  sendMessage,
} from '../services/messaging.service.js';
import { logger } from '../lib/logger.js';

export const messagingRouter = Router();

// ---------------------------------------------------------------------------
// GET /v1/me/messages/thread
// Client: get (or lazily create) their own message thread with their therapist.
// ---------------------------------------------------------------------------
const getClientThreadHandler: RequestHandler = async (req, res, next) => {
  try {
    const thread = await getOrCreateThreadForClient(req.userId!);

    await createAuditEvent(req, {
      actionType: 'message.read',
      resourceType: 'message_thread',
      resourceId: thread.threadId,
      patientId: thread.patientId,
    });

    logger.info('Client fetched message thread', {
      correlationId: req.correlationId,
      userId: req.userId,
      threadId: thread.threadId,
    });

    res.status(200).json(thread);
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// GET /v1/clinic/patients/:patientId/messages/thread
// Therapist / admin: get (or lazily create) the thread for a specific patient.
// ---------------------------------------------------------------------------
const getPatientThreadHandler: RequestHandler = async (req, res, next) => {
  try {
    const { patientId } = req.params;

    const profile = await loadAndAuthorizePatient(
      patientId,
      req.userId!,
      req.role as 'therapist' | 'admin',
    );

    const thread = await getOrCreateThreadForPatient(
      patientId,
      profile.primaryTherapistId ?? req.userId!,
    );

    await createAuditEvent(req, {
      actionType: 'message.read',
      resourceType: 'message_thread',
      resourceId: thread.threadId,
      patientId,
    });

    logger.info('Therapist/admin fetched patient message thread', {
      correlationId: req.correlationId,
      userId: req.userId,
      patientId,
      threadId: thread.threadId,
    });

    res.status(200).json(thread);
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// GET /v1/messages/threads/:threadId/messages
// List messages in a thread (newest first, cursor pagination).
// Roles: client (own thread), therapist (assigned), admin
// ---------------------------------------------------------------------------
const listMessagesHandler: RequestHandler = async (req, res, next) => {
  try {
    const { threadId } = req.params;
    const { limit: limitRaw, cursor } = req.query as Record<string, string | undefined>;

    const limit = limitRaw != null ? parseInt(limitRaw, 10) : undefined;
    if (limit != null && (isNaN(limit) || limit <= 0)) {
      res.status(400).json({ message: 'limit must be a positive integer' });
      return;
    }

    const patientId = await authorizeThreadAccess(
      threadId,
      req.userId!,
      req.role as 'client' | 'therapist' | 'admin',
    );

    const result = await listMessages(threadId, { limit, cursor });

    await createAuditEvent(req, {
      actionType: 'message.read',
      resourceType: 'message',
      resourceId: threadId,
      patientId,
    });

    logger.info('Messages listed', {
      correlationId: req.correlationId,
      userId: req.userId,
      threadId,
      count: result.items.length,
    });

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// POST /v1/messages/threads/:threadId/messages
// Send a message in a thread.
// Roles: client (own thread), therapist (assigned)
// ---------------------------------------------------------------------------
const sendMessageHandler: RequestHandler = async (req, res, next) => {
  try {
    const { threadId } = req.params;
    const { text, attachmentUploadIds } = req.body as {
      text?: string;
      attachmentUploadIds?: string[];
    };

    const patientId = await authorizeThreadAccess(
      threadId,
      req.userId!,
      req.role as 'client' | 'therapist' | 'admin',
    );

    const message = await sendMessage(threadId, {
      senderUserId: req.userId!,
      senderRole: req.role as 'client' | 'therapist' | 'admin',
      text: text ?? '',
      attachmentUploadIds,
    });

    await createAuditEvent(req, {
      actionType: 'message.create',
      resourceType: 'message',
      resourceId: message.messageId,
      patientId,
    });

    logger.info('Message sent', {
      correlationId: req.correlationId,
      userId: req.userId,
      threadId,
      messageId: message.messageId,
    });

    res.status(201).json(message);
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// Mount routes
// ---------------------------------------------------------------------------

// Client: own thread
messagingRouter.get(
  '/me/messages/thread',
  authenticate,
  authorize('client'),
  getClientThreadHandler,
);

// Therapist/admin: patient thread
messagingRouter.get(
  '/clinic/patients/:patientId/messages/thread',
  authenticate,
  authorize('therapist', 'admin'),
  getPatientThreadHandler,
);

// List messages in a thread (all authenticated roles with per-thread auth)
messagingRouter.get(
  '/messages/threads/:threadId/messages',
  authenticate,
  authorize('client', 'therapist', 'admin'),
  listMessagesHandler,
);

// Send a message (clients and therapists only)
messagingRouter.post(
  '/messages/threads/:threadId/messages',
  authenticate,
  authorize('client', 'therapist'),
  sendMessageHandler,
);
