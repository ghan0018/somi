import { RequestHandler } from 'express';
import { logger } from '../lib/logger.js';

// ---------------------------------------------------------------------------
// Audit event types for PHI endpoints
// ---------------------------------------------------------------------------
export type AuditAction =
  | 'auth.login'
  | 'auth.mfa_verify'
  | 'auth.refresh'
  | 'auth.logout'
  | 'patient.read'
  | 'patient.create'
  | 'patient.update'
  | 'plan.read'
  | 'plan.create'
  | 'plan.update'
  | 'plan.publish'
  | 'plan.archive'
  | 'completion.read'
  | 'completion.create'
  | 'adherence.read'
  | 'timeline.read'
  | 'message.read'
  | 'message.create'
  | 'upload.create'
  | 'upload.complete'
  | 'media.access'
  | 'feedback.read'
  | 'feedback.create'
  | 'note.read'
  | 'note.create'
  | 'exercise.read'
  | 'exercise.create'
  | 'exercise.update'
  | 'exercise.archive'
  | 'admin.user_create'
  | 'admin.user_disable'
  | 'admin.user_enable'
  | 'admin.mfa_reset'
  | 'admin.audit_read';

interface AuditEventData {
  actionType: AuditAction;
  resourceType: string;
  resourceId?: string;
  patientId?: string;
}

/**
 * Create an audit event and persist it to the audit_events collection.
 *
 * Called by route handlers after successful PHI operations.
 * This is a utility function, not middleware — it's invoked explicitly
 * by the service layer so that audit events contain accurate resource IDs.
 */
export async function createAuditEvent(
  req: Express.Request,
  data: AuditEventData,
): Promise<void> {
  try {
    // Lazy import to avoid circular deps during bootstrap
    const { AuditEventModel } = await import(
      '../models/audit-event.model.js'
    );

    await AuditEventModel.create({
      actorUserId: (req as any).userId ?? 'anonymous',
      actorRole: (req as any).role ?? 'unknown',
      actionType: data.actionType,
      resourceType: data.resourceType,
      resourceId: data.resourceId ?? '',
      patientId: data.patientId,
      ip: (req as any).ip,
      userAgent: (req as any).headers?.['user-agent'],
      correlationId: (req as any).correlationId ?? '',
    });
  } catch (err) {
    // Audit logging failures must not break the request — log and continue
    logger.error('Failed to create audit event', {
      actionType: data.actionType,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Middleware factory that automatically creates an audit event after
 * a successful response. Use for simple read endpoints where the
 * resource ID can be derived from route params.
 *
 * Usage:
 * ```
 * router.get('/:patientId/plan', authenticate, auditMiddleware('plan.read', 'treatment_plan'), handler);
 * ```
 */
export function auditMiddleware(
  actionType: AuditAction,
  resourceType: string,
  options?: {
    patientIdParam?: string; // route param name for patientId (default: 'patientId')
    resourceIdParam?: string; // route param name for resource ID
  },
): RequestHandler {
  return (req, res, next) => {
    // Log audit event after the response finishes successfully
    res.on('finish', () => {
      if (res.statusCode >= 200 && res.statusCode < 400) {
        const patientId =
          req.params[options?.patientIdParam ?? 'patientId'] ?? undefined;
        const resourceId =
          req.params[options?.resourceIdParam ?? ''] ?? undefined;

        createAuditEvent(req, {
          actionType,
          resourceType,
          resourceId,
          patientId,
        }).catch(() => {
          // Already handled inside createAuditEvent
        });
      }
    });

    next();
  };
}
