import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';

// ---------------------------------------------------------------------------
// Password hashing
// ---------------------------------------------------------------------------

const SALT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// ---------------------------------------------------------------------------
// JWT token generation
// ---------------------------------------------------------------------------

export interface AccessTokenPayload {
  userId: string;
  role: 'client' | 'therapist' | 'admin';
}

export interface RefreshTokenPayload {
  userId: string;
  tokenVersion: number; // enables rotation / revocation
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, config.JWT_ACCESS_SECRET, {
    expiresIn: config.JWT_ACCESS_EXPIRES_IN,
  });
}

export function signRefreshToken(payload: RefreshTokenPayload): string {
  return jwt.sign(payload, config.JWT_REFRESH_SECRET, {
    expiresIn: config.JWT_REFRESH_EXPIRES_IN,
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, config.JWT_ACCESS_SECRET) as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, config.JWT_REFRESH_SECRET) as RefreshTokenPayload;
}

// ---------------------------------------------------------------------------
// Refresh token hashing (stored in DB for rotation)
// Uses SHA-256 instead of bcrypt because:
//   1. JWTs are high-entropy strings — no need for a slow hash
//   2. bcrypt truncates input at 72 bytes, JWTs are ~200+ chars and often
//      share the same first 72 bytes (header + userId), defeating the check
// ---------------------------------------------------------------------------

import { createHash } from 'crypto';

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function verifyRefreshTokenHash(
  token: string,
  storedHash: string,
): boolean {
  const computed = createHash('sha256').update(token).digest('hex');
  return computed === storedHash;
}

// ---------------------------------------------------------------------------
// HTTP Basic Auth parsing
// ---------------------------------------------------------------------------

export interface BasicCredentials {
  email: string;
  password: string;
}

/**
 * Parse an HTTP Basic Authorization header.
 * Expected format: "Basic <base64(email:password)>"
 * Returns null if the header is missing or malformed.
 */
export function parseBasicAuth(
  authHeader: string | undefined,
): BasicCredentials | null {
  if (!authHeader) return null;

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Basic') return null;

  let decoded: string;
  try {
    decoded = Buffer.from(parts[1], 'base64').toString('utf-8');
  } catch {
    return null;
  }

  const colonIndex = decoded.indexOf(':');
  if (colonIndex === -1) return null;

  const email = decoded.slice(0, colonIndex);
  const password = decoded.slice(colonIndex + 1);

  if (!email || !password) return null;

  return { email: email.toLowerCase(), password };
}
