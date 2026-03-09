/**
 * auth.service.test.ts — Unit tests for src/services/auth.service.ts
 *
 * These tests do NOT require a database connection. They test pure functions
 * and JWT operations only.
 */

import jwt from 'jsonwebtoken';

import {
  hashPassword,
  verifyPassword,
  signAccessToken,
  verifyAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  parseBasicAuth,
} from '../services/auth.service.js';

// ---------------------------------------------------------------------------
// hashPassword / verifyPassword
// ---------------------------------------------------------------------------
describe('hashPassword / verifyPassword', () => {
  it('produces a bcrypt hash that verifyPassword accepts', async () => {
    const plain = 'SuperSecretPassword123!';
    const hash = await hashPassword(plain);

    expect(hash).not.toBe(plain);
    expect(hash.startsWith('$2')).toBe(true); // bcrypt marker

    await expect(verifyPassword(plain, hash)).resolves.toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('correct-password');
    await expect(verifyPassword('wrong-password', hash)).resolves.toBe(false);
  });

  it('produces distinct hashes for the same password (random salt)', async () => {
    const plain = 'same-password';
    const hash1 = await hashPassword(plain);
    const hash2 = await hashPassword(plain);

    expect(hash1).not.toBe(hash2);
    await expect(verifyPassword(plain, hash1)).resolves.toBe(true);
    await expect(verifyPassword(plain, hash2)).resolves.toBe(true);
  });
});

// ---------------------------------------------------------------------------
// signAccessToken / verifyAccessToken
// ---------------------------------------------------------------------------
describe('signAccessToken / verifyAccessToken', () => {
  const payload = { userId: 'user-abc-123', role: 'client' as const };

  it('signs and verifies an access token round-trip', () => {
    const token = signAccessToken(payload);
    expect(typeof token).toBe('string');
    expect(token.split('.').length).toBe(3); // JWT structure

    const decoded = verifyAccessToken(token);
    expect(decoded.userId).toBe(payload.userId);
    expect(decoded.role).toBe(payload.role);
  });

  it('encodes all role values correctly', () => {
    for (const role of ['client', 'therapist', 'admin'] as const) {
      const token = signAccessToken({ userId: 'u1', role });
      const decoded = verifyAccessToken(token);
      expect(decoded.role).toBe(role);
    }
  });

  it('throws on a tampered token', () => {
    const token = signAccessToken(payload);
    const tampered = token.slice(0, -5) + 'XXXXX';
    expect(() => verifyAccessToken(tampered)).toThrow();
  });

  it('throws on an expired token', () => {
    // Sign with an already-expired expiry (-1 second)
    const expired = jwt.sign(payload, process.env['JWT_ACCESS_SECRET']!, {
      expiresIn: -1,
    });
    expect(() => verifyAccessToken(expired)).toThrow();
  });

  it('throws on a token signed with the wrong secret', () => {
    const wrongSecret = jwt.sign(payload, 'completely-wrong-secret');
    expect(() => verifyAccessToken(wrongSecret)).toThrow();
  });

  it('throws on an invalid (non-JWT) string', () => {
    expect(() => verifyAccessToken('not.a.token')).toThrow();
    expect(() => verifyAccessToken('')).toThrow();
  });
});

// ---------------------------------------------------------------------------
// signRefreshToken / verifyRefreshToken
// ---------------------------------------------------------------------------
describe('signRefreshToken / verifyRefreshToken', () => {
  const payload = { userId: 'user-xyz-456', tokenVersion: 1 };

  it('signs and verifies a refresh token round-trip', () => {
    const token = signRefreshToken(payload);
    expect(typeof token).toBe('string');
    expect(token.split('.').length).toBe(3);

    const decoded = verifyRefreshToken(token);
    expect(decoded.userId).toBe(payload.userId);
    expect(decoded.tokenVersion).toBe(payload.tokenVersion);
  });

  it('throws on a token signed with the wrong secret', () => {
    const wrongSecret = jwt.sign(payload, 'wrong-refresh-secret');
    expect(() => verifyRefreshToken(wrongSecret)).toThrow();
  });

  it('throws on an expired refresh token', () => {
    const expired = jwt.sign(payload, process.env['JWT_REFRESH_SECRET']!, {
      expiresIn: -1,
    });
    expect(() => verifyRefreshToken(expired)).toThrow();
  });

  it('access token is rejected by verifyRefreshToken (different secret)', () => {
    const accessToken = signAccessToken({ userId: 'u1', role: 'client' });
    // Secrets differ, so this should throw
    expect(() => verifyRefreshToken(accessToken)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// parseBasicAuth
// ---------------------------------------------------------------------------
describe('parseBasicAuth', () => {
  function encodeBasic(email: string, password: string): string {
    return 'Basic ' + Buffer.from(`${email}:${password}`).toString('base64');
  }

  it('parses a well-formed Basic auth header', () => {
    const result = parseBasicAuth(encodeBasic('user@example.com', 'password123'));
    expect(result).toEqual({ email: 'user@example.com', password: 'password123' });
  });

  it('lowercases the email address', () => {
    const result = parseBasicAuth(encodeBasic('User@Example.COM', 'pass'));
    expect(result?.email).toBe('user@example.com');
  });

  it('handles colons in the password correctly', () => {
    const passwordWithColon = 'p@ss:word:with:colons';
    const result = parseBasicAuth(encodeBasic('user@example.com', passwordWithColon));
    expect(result).toEqual({ email: 'user@example.com', password: passwordWithColon });
  });

  it('returns null for undefined header', () => {
    expect(parseBasicAuth(undefined)).toBeNull();
  });

  it('returns null for empty string header', () => {
    expect(parseBasicAuth('')).toBeNull();
  });

  it('returns null when scheme is not "Basic"', () => {
    const token = Buffer.from('user@example.com:pass').toString('base64');
    expect(parseBasicAuth(`Bearer ${token}`)).toBeNull();
  });

  it('returns null when header has more than two parts', () => {
    const token = Buffer.from('user@example.com:pass').toString('base64');
    expect(parseBasicAuth(`Basic ${token} extra`)).toBeNull();
  });

  it('returns null when there is no colon separator in decoded value', () => {
    const noColon = Buffer.from('userexamplecompassword').toString('base64');
    expect(parseBasicAuth(`Basic ${noColon}`)).toBeNull();
  });

  it('returns null when the email part is empty', () => {
    const emptyEmail = Buffer.from(':password').toString('base64');
    expect(parseBasicAuth(`Basic ${emptyEmail}`)).toBeNull();
  });

  it('returns null when the password part is empty', () => {
    const emptyPassword = Buffer.from('user@example.com:').toString('base64');
    expect(parseBasicAuth(`Basic ${emptyPassword}`)).toBeNull();
  });
});
