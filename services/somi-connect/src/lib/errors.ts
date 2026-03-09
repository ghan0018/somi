// ---------------------------------------------------------------------------
// Error code constants
// ---------------------------------------------------------------------------

export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  UNPROCESSABLE_ENTITY: 'UNPROCESSABLE_ENTITY',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

// ---------------------------------------------------------------------------
// AppError class
// ---------------------------------------------------------------------------

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly details: Record<string, unknown>;

  constructor(
    message: string,
    statusCode: number,
    code: ErrorCode,
    details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;

    // Restore prototype chain for instanceof checks after TypeScript transpile
    Object.setPrototypeOf(this, new.target.prototype);

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

// ---------------------------------------------------------------------------
// Factory functions
// ---------------------------------------------------------------------------

export function badRequest(
  message = 'Invalid request',
  details: Record<string, unknown> = {},
): AppError {
  return new AppError(message, 400, ERROR_CODES.VALIDATION_ERROR, details);
}

export function unauthorized(
  message = 'Authentication required',
  details: Record<string, unknown> = {},
): AppError {
  return new AppError(message, 401, ERROR_CODES.UNAUTHORIZED, details);
}

export function forbidden(
  message = 'Access denied',
  details: Record<string, unknown> = {},
): AppError {
  return new AppError(message, 403, ERROR_CODES.FORBIDDEN, details);
}

export function notFound(
  message = 'Resource not found',
  details: Record<string, unknown> = {},
): AppError {
  return new AppError(message, 404, ERROR_CODES.NOT_FOUND, details);
}

export function conflict(
  message = 'Resource already exists',
  details: Record<string, unknown> = {},
): AppError {
  return new AppError(message, 409, ERROR_CODES.CONFLICT, details);
}

export function unprocessable(
  message = 'Unprocessable entity',
  details: Record<string, unknown> = {},
): AppError {
  return new AppError(message, 422, ERROR_CODES.UNPROCESSABLE_ENTITY, details);
}

export function rateLimited(
  message = 'Too many requests',
  details: Record<string, unknown> = {},
): AppError {
  return new AppError(message, 429, ERROR_CODES.RATE_LIMITED, details);
}
