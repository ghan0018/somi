import { Router, RequestHandler } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { createAuditEvent } from '../middleware/auditLog.js';
import { logger } from '../lib/logger.js';
import {
  listUsers,
  inviteUser,
  disableUser,
  enableUser,
  resetMfa,
  queryAuditEvents,
} from '../services/admin.service.js';

export const adminRouter = Router();

// All admin routes require authentication and admin role
const auth = [authenticate, authorize('admin')];

// ---------------------------------------------------------------------------
// GET /v1/admin/users
// List all users with optional role/status filters and cursor pagination.
// ---------------------------------------------------------------------------
const listUsersHandler: RequestHandler = async (req, res, next) => {
  try {
    const {
      role,
      status,
      limit: limitRaw,
      cursor,
    } = req.query as Record<string, string | undefined>;

    const limit = limitRaw != null ? parseInt(limitRaw, 10) : 25;
    if (isNaN(limit) || limit <= 0) {
      res.status(400).json({ message: 'limit must be a positive integer' });
      return;
    }

    const result = await listUsers({
      role,
      status,
      limit,
      cursor,
    });

    logger.info('Admin: users listed', {
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
// POST /v1/admin/users
// Invite a new therapist or admin user.
// ---------------------------------------------------------------------------
const inviteUserHandler: RequestHandler = async (req, res, next) => {
  try {
    const { email, role } = req.body as { email?: string; role?: string };

    const user = await inviteUser({
      email: email ?? '',
      role: role ?? '',
    });

    await createAuditEvent(req, {
      actionType: 'admin.user_create',
      resourceType: 'user',
      resourceId: (user as Record<string, unknown>)['userId'] as string,
    });

    logger.info('Admin: user invited', {
      correlationId: req.correlationId,
      actorUserId: req.userId,
      newUserEmail: email,
      newUserRole: role,
    });

    res.status(201).json(user);
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// POST /v1/admin/users/:userId/disable
// Disable a user account and invalidate their sessions.
// ---------------------------------------------------------------------------
const disableUserHandler: RequestHandler = async (req, res, next) => {
  try {
    const { userId } = req.params;

    const user = await disableUser(userId);

    await createAuditEvent(req, {
      actionType: 'admin.user_disable',
      resourceType: 'user',
      resourceId: userId,
    });

    logger.info('Admin: user disabled', {
      correlationId: req.correlationId,
      actorUserId: req.userId,
      targetUserId: userId,
    });

    res.status(200).json(user);
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// POST /v1/admin/users/:userId/enable
// Re-enable a disabled user account.
// ---------------------------------------------------------------------------
const enableUserHandler: RequestHandler = async (req, res, next) => {
  try {
    const { userId } = req.params;

    const user = await enableUser(userId);

    await createAuditEvent(req, {
      actionType: 'admin.user_enable',
      resourceType: 'user',
      resourceId: userId,
    });

    logger.info('Admin: user enabled', {
      correlationId: req.correlationId,
      actorUserId: req.userId,
      targetUserId: userId,
    });

    res.status(200).json(user);
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// POST /v1/admin/users/:userId/reset-mfa
// Reset MFA for a user (clears mfaEnabled and mfaSecret).
// ---------------------------------------------------------------------------
const resetMfaHandler: RequestHandler = async (req, res, next) => {
  try {
    const { userId } = req.params;

    const user = await resetMfa(userId);

    await createAuditEvent(req, {
      actionType: 'admin.mfa_reset',
      resourceType: 'user',
      resourceId: userId,
    });

    logger.info('Admin: MFA reset', {
      correlationId: req.correlationId,
      actorUserId: req.userId,
      targetUserId: userId,
    });

    res.status(200).json(user);
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// GET /v1/admin/audit
// Query audit events with optional filters and cursor pagination.
// ---------------------------------------------------------------------------
const queryAuditHandler: RequestHandler = async (req, res, next) => {
  try {
    const {
      patientId,
      actorUserId,
      actorEmail,
      actionType,
      from,
      to,
      limit: limitRaw,
      cursor,
    } = req.query as Record<string, string | undefined>;

    const limit = limitRaw != null ? parseInt(limitRaw, 10) : 25;
    if (isNaN(limit) || limit <= 0) {
      res.status(400).json({ message: 'limit must be a positive integer' });
      return;
    }

    const result = await queryAuditEvents({
      patientId,
      actorUserId,
      actorEmail,
      actionType,
      from,
      to,
      limit,
      cursor,
    });

    await createAuditEvent(req, {
      actionType: 'admin.audit_read',
      resourceType: 'audit_event',
    });

    logger.info('Admin: audit events queried', {
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
// Mount routes
// ---------------------------------------------------------------------------

adminRouter.get('/users', ...auth, listUsersHandler);
adminRouter.post('/users', ...auth, inviteUserHandler);
adminRouter.post('/users/:userId/disable', ...auth, disableUserHandler);
adminRouter.post('/users/:userId/enable', ...auth, enableUserHandler);
adminRouter.post('/users/:userId/reset-mfa', ...auth, resetMfaHandler);
adminRouter.get('/audit', ...auth, queryAuditHandler);
