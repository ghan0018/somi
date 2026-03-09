/**
 * rbac.test.ts — Unit tests for the authorize() RBAC middleware.
 *
 * These tests do NOT require a database or HTTP stack. We exercise the
 * middleware directly by constructing mock Express request / response objects.
 *
 * The authorize() middleware throws AppError synchronously (rather than
 * calling next(err)), so we wrap calls in a try/catch.
 */

import { Request, Response, NextFunction } from 'express';
import { authorize } from '../middleware/authorize.js';
import { AppError } from '../lib/errors.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type Role = 'client' | 'therapist' | 'admin';

/**
 * Build a minimal Express Request mock with the given role set, simulating
 * what the `authenticate` middleware would inject.
 */
function mockRequest(role?: Role): Partial<Request> {
  return { role } as Partial<Request>;
}

function mockResponse(): Partial<Response> {
  return {} as Partial<Response>;
}

/**
 * Invoke the authorize middleware and return the AppError if one is thrown,
 * or null if it passes through (calls next() without an argument).
 *
 * authorize() throws synchronously rather than calling next(err), so we use
 * a try/catch here.
 */
function runMiddleware(
  middleware: ReturnType<typeof authorize>,
  req: Partial<Request>,
): AppError | null {
  const next: NextFunction = () => undefined;

  try {
    middleware(req as Request, mockResponse() as Response, next);
  } catch (err) {
    if (err instanceof AppError) return err;
    throw err; // re-throw unexpected errors
  }

  return null;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('authorize() middleware', () => {
  describe('single-role restriction', () => {
    it('calls next() when the role matches', () => {
      const middleware = authorize('admin');
      const err = runMiddleware(middleware, mockRequest('admin'));
      expect(err).toBeNull();
    });

    it('throws 403 for therapist when only admin is allowed', () => {
      const middleware = authorize('admin');
      const err = runMiddleware(middleware, mockRequest('therapist'));

      expect(err).not.toBeNull();
      expect(err!.statusCode).toBe(403);
      expect(err!.code).toBe('FORBIDDEN');
    });

    it('throws 403 for client when only admin is allowed', () => {
      const middleware = authorize('admin');
      const err = runMiddleware(middleware, mockRequest('client'));

      expect(err).not.toBeNull();
      expect(err!.statusCode).toBe(403);
      expect(err!.code).toBe('FORBIDDEN');
    });

    it('calls next() for therapist when therapist is allowed', () => {
      const middleware = authorize('therapist');
      expect(runMiddleware(middleware, mockRequest('therapist'))).toBeNull();
    });

    it('calls next() for client when client is allowed', () => {
      const middleware = authorize('client');
      expect(runMiddleware(middleware, mockRequest('client'))).toBeNull();
    });
  });

  describe('multi-role allowlist — authorize("therapist", "admin")', () => {
    it('allows therapist', () => {
      const middleware = authorize('therapist', 'admin');
      expect(runMiddleware(middleware, mockRequest('therapist'))).toBeNull();
    });

    it('allows admin', () => {
      const middleware = authorize('therapist', 'admin');
      expect(runMiddleware(middleware, mockRequest('admin'))).toBeNull();
    });

    it('throws 403 for client', () => {
      const middleware = authorize('therapist', 'admin');
      const err = runMiddleware(middleware, mockRequest('client'));

      expect(err).not.toBeNull();
      expect(err!.statusCode).toBe(403);
      expect(err!.code).toBe('FORBIDDEN');
    });
  });

  describe('all roles allowed', () => {
    it('allows client, therapist, and admin when all three are listed', () => {
      const middleware = authorize('client', 'therapist', 'admin');
      expect(runMiddleware(middleware, mockRequest('client'))).toBeNull();
      expect(runMiddleware(middleware, mockRequest('therapist'))).toBeNull();
      expect(runMiddleware(middleware, mockRequest('admin'))).toBeNull();
    });
  });

  describe('missing role (authenticate middleware not called)', () => {
    it('throws 403 with a descriptive message when req.role is undefined', () => {
      const middleware = authorize('admin');
      const err = runMiddleware(middleware, mockRequest(undefined));

      expect(err).not.toBeNull();
      expect(err!.statusCode).toBe(403);
      expect(err!.code).toBe('FORBIDDEN');
      // The error message should indicate that authentication middleware is missing
      expect(err!.message).toMatch(/role not set/i);
    });
  });
});
