import rateLimit from 'express-rate-limit';
import { ERROR_CODES } from '../lib/errors.js';

/**
 * Strict rate limiter for authentication endpoints (login, MFA verify).
 * Prevents brute-force attacks on credentials.
 *
 * Not applied globally — authenticated API routes are already protected
 * by JWT validation, so a blanket rate limiter just punishes normal usage.
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 20,                // 20 login attempts per 15-minute window per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: ERROR_CODES.RATE_LIMITED,
      message: 'Too many requests. Please try again later.',
      details: {},
    },
  },
  statusCode: 429,
});
