import { Router, RequestHandler } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { auditMiddleware } from '../middleware/auditLog.js';
import { logger } from '../lib/logger.js';
import { getClientPlan, getPatientIdByUserId } from '../services/plan.service.js';

export const clientPlanRouter = Router();

// ---------------------------------------------------------------------------
// GET /me/plan
// Get the authenticated client's published treatment plan.
// Returns the published plan for the authenticated client.
// ---------------------------------------------------------------------------
const getMyPlanHandler: RequestHandler = async (req, res, next) => {
  try {
    const userId = req.userId!;

    // Resolve userId → patientId via PatientProfile
    const patientId = await getPatientIdByUserId(userId);

    const plan = await getClientPlan(patientId);

    if (!plan) {
      res.status(404).json({ message: 'No published treatment plan found' });
      return;
    }

    logger.info('Client treatment plan fetched', {
      correlationId: req.correlationId,
      userId,
      patientId,
    });

    res.status(200).json(plan);
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// Mount routes
// ---------------------------------------------------------------------------

clientPlanRouter.get(
  '/me/plan',
  authenticate,
  authorize('client'),
  auditMiddleware('plan.read', 'treatment_plan'),
  getMyPlanHandler,
);
