import { Router, RequestHandler } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { auditMiddleware, createAuditEvent } from '../middleware/auditLog.js';
import { logger } from '../lib/logger.js';
import { loadAndAuthorizePatient } from '../services/patient.service.js';
import {
  createPlan,
  replacePlan,
  publishPlan,
  archivePlan,
  advanceSession,
  revertToDraft,
  updatePlanSettings,
  getTherapistPlan,
  getPlanById,
  SessionInput,
} from '../services/plan.service.js';

export const planRouter = Router();

// Shared middleware for all therapist/admin plan routes
const auth = [authenticate, authorize('therapist', 'admin')];

// ---------------------------------------------------------------------------
// POST /:patientId/plan
// Create a new treatment plan in draft status.
// ---------------------------------------------------------------------------
const createPlanHandler: RequestHandler = async (req, res, next) => {
  try {
    const { patientId } = req.params;
    const { sessions } = req.body as { sessions?: SessionInput[] };

    await loadAndAuthorizePatient(patientId, req.userId!, req.role as 'therapist' | 'admin');

    if (!sessions || !Array.isArray(sessions) || sessions.length === 0) {
      res.status(400).json({ message: 'sessions array must not be empty' });
      return;
    }

    const plan = await createPlan(patientId, sessions) as Record<string, unknown>;

    await createAuditEvent(req, {
      actionType: 'plan.create',
      resourceType: 'treatment_plan',
      resourceId: plan['planId'] as string,
      patientId,
    });

    logger.info('Treatment plan created via API', {
      correlationId: req.correlationId,
      userId: req.userId,
      patientId,
      planId: plan['planId'],
    });

    res.status(201).json(plan);
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// PUT /:patientId/plan/:planId
// Replace the full plan content (draft only).
// ---------------------------------------------------------------------------
const replacePlanHandler: RequestHandler = async (req, res, next) => {
  try {
    const { patientId, planId } = req.params;
    const { sessions } = req.body as { sessions?: SessionInput[] };

    await loadAndAuthorizePatient(patientId, req.userId!, req.role as 'therapist' | 'admin');

    // Verify the plan belongs to this patient
    await getPlanById(planId, patientId);

    if (!sessions || !Array.isArray(sessions) || sessions.length === 0) {
      res.status(400).json({ message: 'sessions array must not be empty' });
      return;
    }

    const plan = await replacePlan(planId, sessions) as Record<string, unknown>;

    await createAuditEvent(req, {
      actionType: 'plan.update',
      resourceType: 'treatment_plan',
      resourceId: planId,
      patientId,
    });

    logger.info('Treatment plan replaced via API', {
      correlationId: req.correlationId,
      userId: req.userId,
      patientId,
      planId,
    });

    res.status(200).json(plan);
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// POST /:patientId/plan/:planId/publish
// Publish a draft plan.
// ---------------------------------------------------------------------------
const publishPlanHandler: RequestHandler = async (req, res, next) => {
  try {
    const { patientId, planId } = req.params;

    await loadAndAuthorizePatient(patientId, req.userId!, req.role as 'therapist' | 'admin');

    // Verify the plan belongs to this patient
    await getPlanById(planId, patientId);

    const plan = await publishPlan(planId, req.userId!);

    await createAuditEvent(req, {
      actionType: 'plan.publish',
      resourceType: 'treatment_plan',
      resourceId: planId,
      patientId,
    });

    logger.info('Treatment plan published via API', {
      correlationId: req.correlationId,
      userId: req.userId,
      patientId,
      planId,
    });

    res.status(200).json(plan);
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// POST /:patientId/plan/:planId/archive
// Archive a plan.
// ---------------------------------------------------------------------------
const archivePlanHandler: RequestHandler = async (req, res, next) => {
  try {
    const { patientId, planId } = req.params;

    await loadAndAuthorizePatient(patientId, req.userId!, req.role as 'therapist' | 'admin');

    // Verify the plan belongs to this patient
    await getPlanById(planId, patientId);

    const plan = await archivePlan(planId);

    await createAuditEvent(req, {
      actionType: 'plan.archive',
      resourceType: 'treatment_plan',
      resourceId: planId,
      patientId,
    });

    logger.info('Treatment plan archived via API', {
      correlationId: req.correlationId,
      userId: req.userId,
      patientId,
      planId,
    });

    res.status(200).json(plan);
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// PATCH /:patientId/plan/:planId
// Update plan-level settings (remindersEnabled only).
// ---------------------------------------------------------------------------
const updatePlanSettingsHandler: RequestHandler = async (req, res, next) => {
  try {
    const { patientId, planId } = req.params;
    const { remindersEnabled } = req.body as { remindersEnabled?: boolean };

    await loadAndAuthorizePatient(patientId, req.userId!, req.role as 'therapist' | 'admin');

    // Verify the plan belongs to this patient
    await getPlanById(planId, patientId);

    if (remindersEnabled === undefined) {
      res.status(400).json({ message: 'remindersEnabled is required' });
      return;
    }

    const plan = await updatePlanSettings(planId, { remindersEnabled });

    await createAuditEvent(req, {
      actionType: 'plan.update',
      resourceType: 'treatment_plan',
      resourceId: planId,
      patientId,
    });

    logger.info('Treatment plan settings updated via API', {
      correlationId: req.correlationId,
      userId: req.userId,
      patientId,
      planId,
    });

    res.status(200).json(plan);
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// GET /:patientId/plan
// Get the patient's current plan for therapist view.
// ---------------------------------------------------------------------------
const getTherapistPlanHandler: RequestHandler = async (req, res, next) => {
  try {
    const { patientId } = req.params;

    await loadAndAuthorizePatient(patientId, req.userId!, req.role as 'therapist' | 'admin');

    const plan = await getTherapistPlan(patientId);

    if (!plan) {
      res.status(404).json({ message: 'No treatment plan found for this patient' });
      return;
    }

    logger.info('Treatment plan fetched (therapist view)', {
      correlationId: req.correlationId,
      userId: req.userId,
      patientId,
    });

    res.status(200).json(plan);
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// POST /:patientId/plan/:planId/advance-session
// Advance the active session index by one (published plans only).
// ---------------------------------------------------------------------------
const advanceSessionHandler: RequestHandler = async (req, res, next) => {
  try {
    const { patientId, planId } = req.params;

    await loadAndAuthorizePatient(patientId, req.userId!, req.role as 'therapist' | 'admin');

    // Verify the plan belongs to this patient
    await getPlanById(planId, patientId);

    const plan = await advanceSession(planId);

    await createAuditEvent(req, {
      actionType: 'plan.advance_session',
      resourceType: 'treatment_plan',
      resourceId: planId,
      patientId,
    });

    logger.info('Treatment plan session advanced via API', {
      correlationId: req.correlationId,
      userId: req.userId,
      patientId,
      planId,
    });

    res.status(200).json(plan);
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// POST /:patientId/plan/:planId/revert-to-draft
// Revert a published plan back to draft status so it can be edited.
// ---------------------------------------------------------------------------
const revertToDraftHandler: RequestHandler = async (req, res, next) => {
  try {
    const { patientId, planId } = req.params;

    await loadAndAuthorizePatient(patientId, req.userId!, req.role as 'therapist' | 'admin');

    // Verify the plan belongs to this patient
    await getPlanById(planId, patientId);

    const plan = await revertToDraft(planId);

    await createAuditEvent(req, {
      actionType: 'plan.revert_to_draft',
      resourceType: 'treatment_plan',
      resourceId: planId,
      patientId,
    });

    logger.info('Treatment plan reverted to draft via API', {
      correlationId: req.correlationId,
      userId: req.userId,
      patientId,
      planId,
    });

    res.status(200).json(plan);
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// Mount routes
// ---------------------------------------------------------------------------

planRouter.post(
  '/:patientId/plan',
  ...auth,
  createPlanHandler,
);

planRouter.put(
  '/:patientId/plan/:planId',
  ...auth,
  replacePlanHandler,
);

planRouter.post(
  '/:patientId/plan/:planId/publish',
  ...auth,
  publishPlanHandler,
);

planRouter.post(
  '/:patientId/plan/:planId/archive',
  ...auth,
  archivePlanHandler,
);

planRouter.post(
  '/:patientId/plan/:planId/advance-session',
  ...auth,
  advanceSessionHandler,
);

planRouter.post(
  '/:patientId/plan/:planId/revert-to-draft',
  ...auth,
  revertToDraftHandler,
);

planRouter.patch(
  '/:patientId/plan/:planId',
  ...auth,
  updatePlanSettingsHandler,
);

planRouter.get(
  '/:patientId/plan',
  ...auth,
  auditMiddleware('plan.read', 'treatment_plan'),
  getTherapistPlanHandler,
);
