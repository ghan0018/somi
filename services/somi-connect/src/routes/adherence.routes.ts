import { Router, RequestHandler } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { auditMiddleware } from '../middleware/auditLog.js';
import { loadAndAuthorizePatient } from '../services/patient.service.js';
import { getWeeklyAdherence, getOverallAdherence } from '../services/adherence.service.js';
import { badRequest } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

export const adherenceRouter = Router();

// Shared middleware for all adherence routes
const auth = [authenticate, authorize('therapist', 'admin')];

// ---------------------------------------------------------------------------
// GET /:patientId/adherence/weekly
// ---------------------------------------------------------------------------

const weeklyAdherenceHandler: RequestHandler = async (req, res, next) => {
  try {
    const { patientId } = req.params;
    const { weekStart } = req.query as { weekStart?: string };

    await loadAndAuthorizePatient(patientId, req.userId!, req.role as 'therapist' | 'admin');

    // Validate weekStart format if provided
    if (weekStart !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
      throw badRequest('weekStart must be in YYYY-MM-DD format');
    }

    const result = await getWeeklyAdherence(patientId, weekStart);

    logger.info('Weekly adherence fetched', {
      correlationId: req.correlationId,
      userId: req.userId,
      patientId,
      weekStart: result.weekStart,
    });

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// GET /:patientId/adherence/overall
// ---------------------------------------------------------------------------

const overallAdherenceHandler: RequestHandler = async (req, res, next) => {
  try {
    const { patientId } = req.params;

    await loadAndAuthorizePatient(patientId, req.userId!, req.role as 'therapist' | 'admin');

    const result = await getOverallAdherence(patientId);

    logger.info('Overall adherence fetched', {
      correlationId: req.correlationId,
      userId: req.userId,
      patientId,
      planId: result.planId,
    });

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// Mount routes
// ---------------------------------------------------------------------------

adherenceRouter.get(
  '/:patientId/adherence/weekly',
  ...auth,
  auditMiddleware('adherence.read', 'adherence'),
  weeklyAdherenceHandler,
);

adherenceRouter.get(
  '/:patientId/adherence/overall',
  ...auth,
  auditMiddleware('adherence.read', 'adherence'),
  overallAdherenceHandler,
);
