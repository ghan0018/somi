import { RequestHandler } from 'express';
import { forbidden } from '../lib/errors.js';

type Role = 'client' | 'therapist' | 'admin';

/**
 * Role-based authorization middleware factory.
 *
 * Usage: `router.get('/endpoint', authenticate, authorize('therapist', 'admin'), handler)`
 *
 * Must be used AFTER `authenticate` middleware (which sets req.role).
 * Returns 403 if the user's role is not in the allowed list.
 */
export function authorize(...allowedRoles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.role) {
      throw forbidden('Role not set — authentication middleware may be missing');
    }

    if (!allowedRoles.includes(req.role)) {
      throw forbidden(
        `Role '${req.role}' is not authorized for this resource`,
      );
    }

    next();
  };
}
