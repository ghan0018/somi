import { Router, RequestHandler } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { auditMiddleware, createAuditEvent } from '../middleware/auditLog.js';
import { loadAndAuthorizePatient } from '../services/patient.service.js';
import {
  getTodayView,
  recordCompletion,
  deleteCompletion,
  listCompletions,
  getPatientIdByUserId,
} from '../services/completion.service.js';
import { badRequest } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

export const completionRouter = Router();

// ---------------------------------------------------------------------------
// GET /me/today
// Get client's exercise assignments for a specific date merged with completions.
// ---------------------------------------------------------------------------

const getTodayHandler: RequestHandler = async (req, res, next) => {
  try {
    const userId = req.userId!;
    const { dateLocal } = req.query as { dateLocal?: string };

    if (!dateLocal) {
      throw badRequest('dateLocal query parameter is required');
    }

    // Resolve userId -> patientId
    const patientId = await getPatientIdByUserId(userId);

    const todayView = await getTodayView(patientId, dateLocal);

    await createAuditEvent(req, {
      actionType: 'plan.read',
      resourceType: 'treatment_plan',
      patientId,
    });

    logger.info('Today view fetched', {
      correlationId: req.correlationId,
      userId,
      patientId,
      dateLocal,
    });

    res.status(200).json(todayView);
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// POST /me/completions
// Record an exercise completion for the authenticated client.
// ---------------------------------------------------------------------------

const recordCompletionHandler: RequestHandler = async (req, res, next) => {
  try {
    const userId = req.userId!;
    const idempotencyKey = req.headers['idempotency-key'];

    if (!idempotencyKey || typeof idempotencyKey !== 'string') {
      throw badRequest('Idempotency-Key header is required');
    }

    const { dateLocal, occurrence, exerciseVersionId, source } = req.body as {
      dateLocal?: string;
      occurrence?: number;
      exerciseVersionId?: string;
      source?: string;
    };

    if (!dateLocal) {
      throw badRequest('dateLocal is required');
    }
    if (occurrence === undefined || occurrence === null) {
      throw badRequest('occurrence is required');
    }
    if (!exerciseVersionId) {
      throw badRequest('exerciseVersionId is required');
    }

    const validSources = ['mobile_ios', 'mobile_android', 'web'] as const;
    const resolvedSource = source && validSources.includes(source as typeof validSources[number])
      ? (source as typeof validSources[number])
      : 'web';

    // Resolve userId -> patientId
    const patientId = await getPatientIdByUserId(userId);

    const { completion, isIdempotentReturn } = await recordCompletion({
      patientId,
      dateLocal,
      occurrence: Number(occurrence),
      exerciseVersionId,
      idempotencyKey,
      source: resolvedSource,
    });

    if (!isIdempotentReturn) {
      await createAuditEvent(req, {
        actionType: 'completion.create',
        resourceType: 'completion_event',
        resourceId: (completion as { completionId: string }).completionId,
        patientId,
      });
    }

    logger.info('Completion recorded via API', {
      correlationId: req.correlationId,
      userId,
      patientId,
      completionId: (completion as { completionId: string }).completionId,
      isIdempotentReturn,
    });

    // Return 200 for idempotent re-submissions, 201 for new creations
    res.status(isIdempotentReturn ? 200 : 201).json(completion);
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// GET /clinic/patients/:patientId/completions
// List completions for a patient (therapist/admin view).
// ---------------------------------------------------------------------------

const listCompletionsHandler: RequestHandler = async (req, res, next) => {
  try {
    const { patientId } = req.params;

    await loadAndAuthorizePatient(
      patientId,
      req.userId!,
      req.role as 'therapist' | 'admin',
    );

    const {
      dateFrom,
      dateTo,
      occurrence: occurrenceRaw,
      limit: limitRaw,
      cursor,
    } = req.query as {
      dateFrom?: string;
      dateTo?: string;
      occurrence?: string;
      limit?: string;
      cursor?: string;
    };

    const limit = limitRaw !== undefined ? parseInt(limitRaw, 10) : 25;
    if (isNaN(limit) || limit < 1) {
      throw badRequest('limit must be a positive integer');
    }

    const occurrence =
      occurrenceRaw !== undefined ? parseInt(occurrenceRaw, 10) : undefined;
    if (occurrenceRaw !== undefined && isNaN(occurrence!)) {
      throw badRequest('occurrence must be a number');
    }

    const result = await listCompletions({
      patientId,
      dateFrom,
      dateTo,
      occurrence,
      limit,
      cursor,
    });

    logger.info('Completions listed (therapist view)', {
      correlationId: req.correlationId,
      userId: req.userId,
      patientId,
    });

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// Mount routes
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// DELETE /me/completions
// Remove a previously recorded completion (undo / uncheck). Client-only.
// ---------------------------------------------------------------------------

const deleteCompletionHandler: RequestHandler = async (req, res, next) => {
  try {
    const userId = req.userId!;

    const { dateLocal, occurrence, exerciseVersionId } = req.body as {
      dateLocal?: string;
      occurrence?: number;
      exerciseVersionId?: string;
    };

    if (!dateLocal) throw badRequest('dateLocal is required');
    if (occurrence === undefined || occurrence === null) throw badRequest('occurrence is required');
    if (!exerciseVersionId) throw badRequest('exerciseVersionId is required');

    const patientId = await getPatientIdByUserId(userId);

    await deleteCompletion({
      patientId,
      dateLocal,
      occurrence: Number(occurrence),
      exerciseVersionId,
    });

    logger.info('Completion deleted via API', {
      correlationId: req.correlationId,
      userId,
      patientId,
      dateLocal,
      occurrence,
      exerciseVersionId,
    });

    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

// Client routes
completionRouter.get(
  '/me/today',
  authenticate,
  authorize('client'),
  getTodayHandler,
);

completionRouter.post(
  '/me/completions',
  authenticate,
  authorize('client'),
  recordCompletionHandler,
);

completionRouter.delete(
  '/me/completions',
  authenticate,
  authorize('client'),
  deleteCompletionHandler,
);

// Therapist/admin route
completionRouter.get(
  '/clinic/patients/:patientId/completions',
  authenticate,
  authorize('therapist', 'admin'),
  auditMiddleware('completion.read', 'completion_event'),
  listCompletionsHandler,
);
