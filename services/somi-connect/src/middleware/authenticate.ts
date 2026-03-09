import { RequestHandler } from 'express';
import { verifyAccessToken } from '../services/auth.service.js';
import { unauthorized } from '../lib/errors.js';

/**
 * JWT authentication middleware.
 *
 * Expects: Authorization: Bearer <accessToken>
 * Populates: req.userId, req.role
 * Throws 401 if token is missing, malformed, or expired.
 */
export const authenticate: RequestHandler = (req, _res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw unauthorized('Missing or malformed Authorization header');
  }

  const token = authHeader.slice(7); // strip "Bearer "

  try {
    const payload = verifyAccessToken(token);
    req.userId = payload.userId;
    req.role = payload.role;
    next();
  } catch {
    throw unauthorized('Invalid or expired access token');
  }
};
