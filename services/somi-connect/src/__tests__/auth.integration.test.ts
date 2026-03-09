/**
 * auth.integration.test.ts — Integration tests for auth endpoints.
 *
 * Uses supertest to hit the real Express app, backed by a MongoDB Memory
 * Server instance. The DB is cleared and re-seeded before each test.
 */

import jwt from 'jsonwebtoken';
import request from 'supertest';
import { startDb, stopDb, clearDb } from './setup.js';

// Import the app factory and models AFTER env vars are already set by
// jest.setup.ts (which runs via setupFiles before any module is loaded here).
import { createApp } from '../app.js';
import { UserModel } from '../models/user.model.js';
import { PatientProfileModel } from '../models/patient-profile.model.js';
import { hashPassword } from '../services/auth.service.js';

const app = createApp();

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------
const CLIENT_EMAIL = 'client@example.com';
const CLIENT_PASSWORD = 'ClientPass123!';

const THERAPIST_EMAIL = 'therapist@example.com';
const THERAPIST_PASSWORD = 'TherapistPass123!';

function basicAuthHeader(email: string, password: string): string {
  const encoded = Buffer.from(`${email}:${password}`).toString('base64');
  return `Basic ${encoded}`;
}

async function seedUsers() {
  const clientHash = await hashPassword(CLIENT_PASSWORD);
  const therapistHash = await hashPassword(THERAPIST_PASSWORD);

  const client = await UserModel.create({
    email: CLIENT_EMAIL,
    passwordHash: clientHash,
    role: 'client',
    status: 'active',
    mfaEnabled: false,
  });

  await UserModel.create({
    email: THERAPIST_EMAIL,
    passwordHash: therapistHash,
    role: 'therapist',
    status: 'active',
    mfaEnabled: true,
  });

  // Create a patient profile linked to the client
  await PatientProfileModel.create({
    userId: client._id.toString(),
    displayName: 'Test Client',
    status: 'active',
    clinicId: 'test_clinic',
  });
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------
beforeAll(async () => {
  await startDb();
}, 30_000);

afterAll(async () => {
  await stopDb();
});

beforeEach(async () => {
  await clearDb();
  await seedUsers();
});

// ---------------------------------------------------------------------------
// POST /v1/auth/login
// ---------------------------------------------------------------------------
describe('POST /v1/auth/login', () => {
  it('returns 200 with tokens for valid Basic auth credentials (client, no MFA)', async () => {
    const res = await request(app)
      .post('/v1/auth/login')
      .set('Authorization', basicAuthHeader(CLIENT_EMAIL, CLIENT_PASSWORD));

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');
    expect(res.body).toHaveProperty('expiresIn', 3600);
    expect(res.body.user).toMatchObject({
      role: 'client',
      email: CLIENT_EMAIL,
    });
    expect(res.body).not.toHaveProperty('mfaRequired');
  });

  it('returns 200 with mfaRequired for therapist with MFA enabled', async () => {
    const res = await request(app)
      .post('/v1/auth/login')
      .set('Authorization', basicAuthHeader(THERAPIST_EMAIL, THERAPIST_PASSWORD));

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('mfaRequired', true);
    expect(res.body).toHaveProperty('challengeId');
    expect(typeof res.body.challengeId).toBe('string');
    expect(res.body.methods).toContain('totp');
    expect(res.body).not.toHaveProperty('accessToken');
  });

  it('returns 401 for wrong password', async () => {
    const res = await request(app)
      .post('/v1/auth/login')
      .set('Authorization', basicAuthHeader(CLIENT_EMAIL, 'wrongPassword!'));

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 for non-existent email', async () => {
    const res = await request(app)
      .post('/v1/auth/login')
      .set('Authorization', basicAuthHeader('nobody@example.com', 'somePassword'));

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 for missing Authorization header', async () => {
    const res = await request(app)
      .post('/v1/auth/login');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 for a disabled account', async () => {
    await UserModel.updateOne({ email: CLIENT_EMAIL }, { status: 'disabled' });

    const res = await request(app)
      .post('/v1/auth/login')
      .set('Authorization', basicAuthHeader(CLIENT_EMAIL, CLIENT_PASSWORD));

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});

// ---------------------------------------------------------------------------
// POST /v1/auth/mfa/verify
// ---------------------------------------------------------------------------
describe('POST /v1/auth/mfa/verify', () => {
  async function getChallenge(): Promise<string> {
    const res = await request(app)
      .post('/v1/auth/login')
      .set('Authorization', basicAuthHeader(THERAPIST_EMAIL, THERAPIST_PASSWORD));

    expect(res.status).toBe(200);
    return res.body.challengeId as string;
  }

  it('returns 200 with tokens for valid challenge + 6-digit code', async () => {
    const challengeId = await getChallenge();

    const res = await request(app)
      .post('/v1/auth/mfa/verify')
      .send({ challengeId, code: '123456' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');
    expect(res.body.user).toMatchObject({
      role: 'therapist',
      email: THERAPIST_EMAIL,
    });
  });

  it('returns 401 for an expired challenge (ts older than 5 minutes)', async () => {
    // Build a challenge with a timestamp 6 minutes in the past
    const therapistUser = await UserModel.findOne({ email: THERAPIST_EMAIL });
    const oldTs = Date.now() - 6 * 60 * 1000;
    const expiredChallenge = Buffer.from(
      JSON.stringify({ userId: therapistUser!._id.toString(), ts: oldTs }),
    ).toString('base64url');

    const res = await request(app)
      .post('/v1/auth/mfa/verify')
      .send({ challengeId: expiredChallenge, code: '123456' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 for an invalid (malformed) challengeId', async () => {
    // Use something that is valid base64url but decodes to non-JSON
    const invalidChallenge = Buffer.from('this is not json at all').toString('base64url');

    const res = await request(app)
      .post('/v1/auth/mfa/verify')
      .send({ challengeId: invalidChallenge, code: '123456' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 for an invalid MFA code (not 6 digits)', async () => {
    const challengeId = await getChallenge();

    const res = await request(app)
      .post('/v1/auth/mfa/verify')
      .send({ challengeId, code: 'abc' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});

// ---------------------------------------------------------------------------
// POST /v1/auth/refresh
// ---------------------------------------------------------------------------
describe('POST /v1/auth/refresh', () => {
  async function loginAndGetTokens(): Promise<{ accessToken: string; refreshToken: string }> {
    const res = await request(app)
      .post('/v1/auth/login')
      .set('Authorization', basicAuthHeader(CLIENT_EMAIL, CLIENT_PASSWORD));

    expect(res.status).toBe(200);
    return { accessToken: res.body.accessToken, refreshToken: res.body.refreshToken };
  }

  it('returns 200 with new access and refresh tokens for a valid refresh token', async () => {
    const { refreshToken } = await loginAndGetTokens();

    const res = await request(app)
      .post('/v1/auth/refresh')
      .send({ refreshToken });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body).toHaveProperty('refreshToken');
    expect(res.body).toHaveProperty('expiresIn', 3600);
    // New refresh token should be different from the original
    expect(res.body.refreshToken).not.toBe(refreshToken);
  });

  it('returns 401 for an invalid refresh token string', async () => {
    const res = await request(app)
      .post('/v1/auth/refresh')
      .send({ refreshToken: 'invalid.token.string' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 400 for missing refreshToken in request body', async () => {
    const res = await request(app)
      .post('/v1/auth/refresh')
      .send({});

    expect(res.status).toBe(400);
  });

  it('returns 401 when reusing an already-rotated refresh token', async () => {
    const { refreshToken } = await loginAndGetTokens();

    // Use the token once — this rotates it and stores a new hash
    const rotateRes = await request(app)
      .post('/v1/auth/refresh')
      .send({ refreshToken });
    expect(rotateRes.status).toBe(200);

    // Attempt to reuse the old (now-revoked) token
    const reuseRes = await request(app)
      .post('/v1/auth/refresh')
      .send({ refreshToken });
    expect(reuseRes.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// POST /v1/auth/logout
// ---------------------------------------------------------------------------
describe('POST /v1/auth/logout', () => {
  async function loginAndGetRefreshToken(): Promise<string> {
    const res = await request(app)
      .post('/v1/auth/login')
      .set('Authorization', basicAuthHeader(CLIENT_EMAIL, CLIENT_PASSWORD));

    expect(res.status).toBe(200);
    return res.body.refreshToken as string;
  }

  it('returns 204 for a valid refresh token', async () => {
    const refreshToken = await loginAndGetRefreshToken();

    const res = await request(app)
      .post('/v1/auth/logout')
      .send({ refreshToken });

    expect(res.status).toBe(204);
  });

  it('returns 204 even for an invalid token (idempotent logout)', async () => {
    const res = await request(app)
      .post('/v1/auth/logout')
      .send({ refreshToken: 'this.is.invalid' });

    expect(res.status).toBe(204);
  });

  it('clears the stored refresh token hash so the token cannot be reused after logout', async () => {
    const refreshToken = await loginAndGetRefreshToken();

    const logoutRes = await request(app)
      .post('/v1/auth/logout')
      .send({ refreshToken });
    expect(logoutRes.status).toBe(204);

    // The same refresh token should now fail to refresh
    const refreshRes = await request(app)
      .post('/v1/auth/refresh')
      .send({ refreshToken });
    expect(refreshRes.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// GET /v1/me
// ---------------------------------------------------------------------------
describe('GET /v1/me', () => {
  async function getClientAccessToken(): Promise<string> {
    const res = await request(app)
      .post('/v1/auth/login')
      .set('Authorization', basicAuthHeader(CLIENT_EMAIL, CLIENT_PASSWORD));

    expect(res.status).toBe(200);
    return res.body.accessToken as string;
  }

  async function getTherapistAccessToken(): Promise<string> {
    // 1. Login to get the MFA challenge
    const loginRes = await request(app)
      .post('/v1/auth/login')
      .set('Authorization', basicAuthHeader(THERAPIST_EMAIL, THERAPIST_PASSWORD));
    expect(loginRes.status).toBe(200);

    // 2. Complete MFA verification with any valid 6-digit code
    const mfaRes = await request(app)
      .post('/v1/auth/mfa/verify')
      .send({ challengeId: loginRes.body.challengeId, code: '654321' });
    expect(mfaRes.status).toBe(200);

    return mfaRes.body.accessToken as string;
  }

  it('returns user profile for authenticated client, including patientId and displayName', async () => {
    const accessToken = await getClientAccessToken();

    const res = await request(app)
      .get('/v1/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      role: 'client',
      email: CLIENT_EMAIL,
    });
    expect(res.body).toHaveProperty('patientId');
    expect(res.body).toHaveProperty('displayName', 'Test Client');
    // Sensitive fields must not be exposed
    expect(res.body).not.toHaveProperty('passwordHash');
    expect(res.body).not.toHaveProperty('refreshTokenHash');
  });

  it('returns user profile for authenticated therapist, including mfaEnabled', async () => {
    const accessToken = await getTherapistAccessToken();

    const res = await request(app)
      .get('/v1/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      role: 'therapist',
      email: THERAPIST_EMAIL,
      mfaEnabled: true,
    });
    // Client-only fields should not be present for therapist
    expect(res.body).not.toHaveProperty('patientId');
  });

  it('returns 401 without an Authorization header', async () => {
    const res = await request(app).get('/v1/me');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 with an expired access token', async () => {
    const expiredToken = jwt.sign(
      { userId: 'fake-id', role: 'client' },
      process.env['JWT_ACCESS_SECRET']!,
      { expiresIn: -1 },
    );

    const res = await request(app)
      .get('/v1/me')
      .set('Authorization', `Bearer ${expiredToken}`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});
