import { RequestHandler } from 'express';
import { config } from '../config/env.js';
import { logger } from '../lib/logger.js';

export const requestLogger: RequestHandler = (req, res, next) => {
  const startedAt = Date.now();

  res.on('finish', () => {
    const durationMs = Date.now() - startedAt;

    // Prefer the matched route pattern (e.g. /v1/patients/:id) to avoid
    // logging raw user-supplied path segments that could contain PHI.
    const path: string =
      (req.route as { path?: string } | undefined)?.path ?? req.path;

    logger.info('Request completed', {
      correlationId: req.correlationId,
      environment: config.NODE_ENV,
      method: req.method,
      path,
      statusCode: res.statusCode,
      durationMs,
      // userId and role are populated by auth middleware — may be undefined here
      ...(req.userId !== undefined && { userId: req.userId }),
      ...(req.role !== undefined && { role: req.role }),
    });
  });

  next();
}
