import { ErrorRequestHandler } from 'express';
import { AppError, ERROR_CODES } from '../lib/errors.js';
import { logger } from '../lib/logger.js';
import { config } from '../config/env.js';

interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details: Record<string, unknown>;
  };
}

// Express error-handling middleware requires 4 parameters — the `_next`
// parameter is intentionally unused but must be present for Express to
// recognise this as an error handler.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  let statusCode = 500;
  let code: string = ERROR_CODES.INTERNAL_ERROR;
  let message = 'An unexpected error occurred';
  let details: Record<string, unknown> = {};

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    code = err.code;
    message = err.message;
    details = err.details;
  }

  // Structured error log — stack trace only in non-production
  logger.error('Request error', {
    correlationId: req.correlationId,
    method: req.method,
    path: req.path,
    statusCode,
    code,
    message,
    ...(config.NODE_ENV !== 'production' && err instanceof Error
      ? { stack: err.stack }
      : {}),
  });

  const body: ErrorResponse = {
    error: {
      code,
      message,
      details,
    },
  };

  res.status(statusCode).json(body);
}
