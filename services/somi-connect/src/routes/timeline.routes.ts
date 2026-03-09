import { Router, RequestHandler } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { auditMiddleware } from '../middleware/auditLog.js';
import { loadAndAuthorizePatient } from '../services/patient.service.js';
import { getTimeline } from '../services/timeline.service.js';
import { badRequest } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

export const timelineRouter = Router();

// Shared middleware for timeline routes
const auth = [authenticate, authorize('therapist', 'admin')];

// ---------------------------------------------------------------------------
// GET /:patientId/timeline
// ---------------------------------------------------------------------------

const timelineHandler: RequestHandler = async (req, res, next) => {
  try {
    const { patientId } = req.params;
    const {
      types,
      limit: limitRaw,
      cursor,
    } = req.query as {
      types?: string;
      limit?: string;
      cursor?: string;
    };

    await loadAndAuthorizePatient(patientId, req.userId!, req.role as 'therapist' | 'admin');

    // Validate limit
    let limit: number | undefined;
    if (limitRaw !== undefined) {
      limit = parseInt(limitRaw, 10);
      if (isNaN(limit) || limit < 1) {
        throw badRequest('limit must be a positive integer');
      }
    }

    const result = await getTimeline(patientId, { types, limit, cursor });

    logger.info('Timeline fetched', {
      correlationId: req.correlationId,
      userId: req.userId,
      patientId,
      itemCount: result.items.length,
    });

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// Mount routes
// ---------------------------------------------------------------------------

timelineRouter.get(
  '/:patientId/timeline',
  ...auth,
  auditMiddleware('timeline.read', 'timeline'),
  timelineHandler,
);
