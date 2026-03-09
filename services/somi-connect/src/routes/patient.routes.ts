import { Router, RequestHandler } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { auditMiddleware, createAuditEvent } from '../middleware/auditLog.js';
import { logger } from '../lib/logger.js';
import {
  listPatients,
  createPatient,
  getPatientById,
  updatePatient,
  loadAndAuthorizePatient,
} from '../services/patient.service.js';

export const patientRouter = Router();

// Shared middleware applied to all patient routes
const auth = [authenticate, authorize('therapist', 'admin')];

// ---------------------------------------------------------------------------
// Middleware: checkPatientAccess
//
// Loads PatientProfile by :patientId from route params.
// Returns 404 if not found.
// Attaches the loaded profile to res.locals.patientProfile for downstream use.
// ---------------------------------------------------------------------------
const checkPatientAccess: RequestHandler = async (req, res, next) => {
  try {
    const { patientId } = req.params;
    const callerUserId = req.userId!;
    const callerRole = req.role as 'therapist' | 'admin';

    const profileDoc = await loadAndAuthorizePatient(
      patientId,
      callerUserId,
      callerRole,
    );

    res.locals['patientProfile'] = profileDoc;
    next();
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// GET /v1/clinic/patients
// List patients, filtered by status. All clinic staff see all patients.
// ---------------------------------------------------------------------------
const listPatientsHandler: RequestHandler = async (req, res, next) => {
  try {
    const {
      status,
      search,
      limit: limitRaw,
      cursor,
    } = req.query as Record<string, string | undefined>;

    const limit = limitRaw != null ? parseInt(limitRaw, 10) : undefined;
    if (limit != null && (isNaN(limit) || limit <= 0)) {
      res.status(400).json({ message: 'limit must be a positive integer' });
      return;
    }

    const result = await listPatients({
      status,
      search,
      limit,
      cursor,
      callerRole: req.role as 'therapist' | 'admin',
      callerUserId: req.userId!,
    });

    logger.info('Patients listed', {
      correlationId: req.correlationId,
      userId: req.userId,
      count: result.items.length,
    });

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// POST /v1/clinic/patients
// Create a new patient + linked User with role='client'.
// ---------------------------------------------------------------------------
const createPatientHandler: RequestHandler = async (req, res, next) => {
  try {
    const { displayName, email, primaryTherapistId } = req.body as {
      displayName?: string;
      email?: string;
      primaryTherapistId?: string;
    };

    const patient = await createPatient({
      displayName: displayName ?? '',
      email: email ?? '',
      primaryTherapistId,
      callerRole: req.role as 'therapist' | 'admin',
      callerUserId: req.userId!,
    });

    await createAuditEvent(req, {
      actionType: 'patient.create',
      resourceType: 'patient',
      resourceId: patient.patientId,
      patientId: patient.patientId,
    });

    logger.info('Patient created', {
      correlationId: req.correlationId,
      userId: req.userId,
      patientId: patient.patientId,
    });

    res.status(201).json(patient);
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// GET /v1/clinic/patients/:patientId
// Get a single patient's profile (therapist: assigned only, admin: any).
// ---------------------------------------------------------------------------
const getPatientHandler: RequestHandler = async (req, res, next) => {
  try {
    const { patientId } = req.params;

    const patient = await getPatientById(patientId);

    logger.info('Patient fetched', {
      correlationId: req.correlationId,
      userId: req.userId,
      patientId,
    });

    res.status(200).json(patient);
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// PATCH /v1/clinic/patients/:patientId
// Partial update of allowed patient fields: displayName, status, primaryTherapistId.
// ---------------------------------------------------------------------------
const updatePatientHandler: RequestHandler = async (req, res, next) => {
  try {
    const { patientId } = req.params;
    const { displayName, status, primaryTherapistId } = req.body as {
      displayName?: string;
      status?: string;
      primaryTherapistId?: string;
    };

    const patient = await updatePatient(patientId, {
      displayName,
      status,
      primaryTherapistId,
    });

    await createAuditEvent(req, {
      actionType: 'patient.update',
      resourceType: 'patient',
      resourceId: patient.patientId,
      patientId: patient.patientId,
    });

    logger.info('Patient updated', {
      correlationId: req.correlationId,
      userId: req.userId,
      patientId,
    });

    res.status(200).json(patient);
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// Mount routes
// ---------------------------------------------------------------------------

patientRouter.get(
  '/',
  ...auth,
  auditMiddleware('patient.read', 'patient'),
  listPatientsHandler,
);

patientRouter.post(
  '/',
  ...auth,
  createPatientHandler,
);

patientRouter.get(
  '/:patientId',
  ...auth,
  checkPatientAccess,
  auditMiddleware('patient.read', 'patient'),
  getPatientHandler,
);

patientRouter.patch(
  '/:patientId',
  ...auth,
  checkPatientAccess,
  updatePatientHandler,
);
