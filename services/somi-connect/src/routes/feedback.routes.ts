import { Router, RequestHandler } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { createAuditEvent } from '../middleware/auditLog.js';
import { loadAndAuthorizePatient } from '../services/patient.service.js';
import { FeedbackModel } from '../models/feedback.model.js';
import { PatientProfileModel } from '../models/patient-profile.model.js';
import { badRequest, forbidden, notFound } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

export const feedbackRouter = Router();

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
// POST /v1/clinic/patients/:patientId/feedback
// Create therapist feedback for a patient.
// Roles: therapist (assigned), admin
// ---------------------------------------------------------------------------
const createFeedbackHandler: RequestHandler = async (req, res, next) => {
  try {
    const { patientId } = req.params;
    const { text, uploadId, feedbackMediaUploadId } = req.body as {
      text?: string;
      uploadId?: string;
      feedbackMediaUploadId?: string;
    };

    await loadAndAuthorizePatient(
      patientId,
      req.userId!,
      req.role as 'therapist' | 'admin',
    );

    if (!text?.trim()) {
      throw badRequest('text is required and cannot be empty');
    }

    const feedback = await FeedbackModel.create({
      patientId,
      therapistUserId: req.userId!,
      text: text.trim(),
      ...(uploadId != null && { uploadId }),
      ...(feedbackMediaUploadId != null && { feedbackMediaUploadId }),
    });

    const feedbackId = String(feedback._id);

    await createAuditEvent(req, {
      actionType: 'feedback.create',
      resourceType: 'feedback',
      resourceId: feedbackId,
      patientId,
    });

    logger.info('Feedback created', {
      correlationId: req.correlationId,
      userId: req.userId,
      patientId,
      feedbackId,
    });

    res.status(201).json(feedback.toJSON());
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// GET /v1/clinic/patients/:patientId/feedback
// List feedback for a patient (newest first, cursor pagination).
// Roles: therapist (assigned), admin; client (own feedback, read-only)
// ---------------------------------------------------------------------------
const listFeedbackHandler: RequestHandler = async (req, res, next) => {
  try {
    const { patientId } = req.params;
    const { limit: limitRaw, cursor } = req.query as Record<string, string | undefined>;

    const limit = limitRaw != null ? parseInt(limitRaw, 10) : DEFAULT_LIMIT;
    if (isNaN(limit) || limit <= 0) {
      res.status(400).json({ message: 'limit must be a positive integer' });
      return;
    }
    const effectiveLimit = Math.min(limit, MAX_LIMIT);

    // Access control: therapists/admins use loadAndAuthorizePatient;
    // clients must verify the patientId matches their own profile.
    if (req.role === 'client') {
      const profile = await PatientProfileModel.findOne({ userId: req.userId }).lean();
      if (!profile) {
        throw notFound('Patient profile not found for this user');
      }
      if (String(profile._id) !== patientId) {
        throw forbidden('You can only access your own feedback');
      }
    } else {
      await loadAndAuthorizePatient(
        patientId,
        req.userId!,
        req.role as 'therapist' | 'admin',
      );
    }

    const query: Record<string, unknown> = { patientId };

    if (cursor) {
      const decodedId = decodeCursor(cursor);
      query['_id'] = { $lt: decodedId };
    }

    const docs = await FeedbackModel.find(query)
      .sort({ _id: -1 })
      .limit(effectiveLimit + 1)
      .lean();

    const hasMore = docs.length > effectiveLimit;
    const page = hasMore ? docs.slice(0, effectiveLimit) : docs;

    const items = page.map((doc) => ({
      feedbackId: String(doc._id),
      patientId: doc.patientId,
      therapistUserId: doc.therapistUserId,
      text: doc.text,
      uploadId: doc.uploadId,
      feedbackMediaUploadId: doc.feedbackMediaUploadId,
      createdAt: doc.createdAt.toISOString(),
    }));

    const nextCursor = hasMore ? encodeCursor(page[page.length - 1]._id) : null;

    await createAuditEvent(req, {
      actionType: 'feedback.read',
      resourceType: 'feedback',
      patientId,
    });

    logger.info('Feedback listed', {
      correlationId: req.correlationId,
      userId: req.userId,
      patientId,
      count: items.length,
    });

    res.status(200).json({ items, nextCursor });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// Mount routes
// ---------------------------------------------------------------------------

// POST /:patientId/feedback — therapist/admin only
feedbackRouter.post(
  '/:patientId/feedback',
  authenticate,
  authorize('therapist', 'admin'),
  createFeedbackHandler,
);

// GET /:patientId/feedback — therapist (assigned), admin, client (own)
feedbackRouter.get(
  '/:patientId/feedback',
  authenticate,
  authorize('client', 'therapist', 'admin'),
  listFeedbackHandler,
);
