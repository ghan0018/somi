/**
 * uploads.integration.test.ts — Integration tests for upload endpoints.
 *
 * Uses supertest to hit the real Express app backed by MongoDB Memory Server.
 * DB is cleared and re-seeded before each test.
 */

import request from 'supertest';
import { startDb, stopDb, clearDb } from './setup.js';
import { createApp } from '../app.js';
import { UserModel } from '../models/user.model.js';
import { hashPassword, signAccessToken } from '../services/auth.service.js';

const app = createApp();

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let therapistId: string;
let therapistToken: string;
let clientId: string;
let clientToken: string;
let otherClientId: string;
let otherClientToken: string;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function getAccessToken(userId: string, role: 'client' | 'therapist' | 'admin'): string {
  return signAccessToken({ userId, role });
}

async function seedData() {
  const therapistHash = await hashPassword('TherapistPass123!');
  const therapist = await UserModel.create({
    email: 'therapist@example.com',
    passwordHash: therapistHash,
    role: 'therapist',
    status: 'active',
    mfaEnabled: false,
  });
  therapistId = therapist._id.toString();
  therapistToken = getAccessToken(therapistId, 'therapist');

  const clientHash = await hashPassword('ClientPass123!');
  const client = await UserModel.create({
    email: 'client@example.com',
    passwordHash: clientHash,
    role: 'client',
    status: 'active',
    mfaEnabled: false,
  });
  clientId = client._id.toString();
  clientToken = getAccessToken(clientId, 'client');

  const otherClientHash = await hashPassword('OtherClientPass123!');
  const otherClient = await UserModel.create({
    email: 'other.client@example.com',
    passwordHash: otherClientHash,
    role: 'client',
    status: 'active',
    mfaEnabled: false,
  });
  otherClientId = otherClient._id.toString();
  otherClientToken = getAccessToken(otherClientId, 'client');
}

async function requestUploadViaApi(
  token: string,
  overrides: Record<string, unknown> = {},
): Promise<string> {
  const body = {
    purpose: 'practice_video',
    contentType: 'video/mp4',
    sizeBytes: 1024 * 1024, // 1 MB
    ...overrides,
  };
  const res = await request(app)
    .post('/v1/uploads')
    .set('Authorization', `Bearer ${token}`)
    .send(body);
  return res.body.uploadId as string;
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
  await seedData();
});

// ---------------------------------------------------------------------------
// POST /v1/uploads
// ---------------------------------------------------------------------------
describe('POST /v1/uploads', () => {
  it('returns 201 with mock uploadUrl for client', async () => {
    const res = await request(app)
      .post('/v1/uploads')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        purpose: 'practice_video',
        contentType: 'video/mp4',
        sizeBytes: 1024 * 1024,
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('uploadId');
    expect(res.body).toHaveProperty('uploadUrl');
    expect(res.body).toHaveProperty('expiresAt');
    expect(res.body).toHaveProperty('status', 'pending');
    expect(typeof res.body.uploadUrl).toBe('string');
    expect(res.body.uploadUrl.length).toBeGreaterThan(0);
  });

  it('returns 201 for therapist', async () => {
    const res = await request(app)
      .post('/v1/uploads')
      .set('Authorization', `Bearer ${therapistToken}`)
      .send({
        purpose: 'exercise_media',
        contentType: 'image/jpeg',
        sizeBytes: 512 * 1024,
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('uploadId');
    expect(res.body.status).toBe('pending');
  });

  it('validates contentType — rejects unsupported type', async () => {
    const res = await request(app)
      .post('/v1/uploads')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        purpose: 'practice_video',
        contentType: 'application/pdf',
        sizeBytes: 1024,
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('validates sizeBytes — rejects file that is too large for video', async () => {
    const oversizedBytes = 600 * 1024 * 1024; // 600 MB, over 500 MB limit
    const res = await request(app)
      .post('/v1/uploads')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        purpose: 'practice_video',
        contentType: 'video/mp4',
        sizeBytes: oversizedBytes,
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('validates sizeBytes — rejects image that is too large', async () => {
    const oversizedBytes = 15 * 1024 * 1024; // 15 MB, over 10 MB limit
    const res = await request(app)
      .post('/v1/uploads')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        purpose: 'message_attachment',
        contentType: 'image/jpeg',
        sizeBytes: oversizedBytes,
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 401 without auth', async () => {
    const res = await request(app)
      .post('/v1/uploads')
      .send({
        purpose: 'practice_video',
        contentType: 'video/mp4',
        sizeBytes: 1024,
      });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});

// ---------------------------------------------------------------------------
// POST /v1/uploads/:uploadId/complete
// ---------------------------------------------------------------------------
describe('POST /v1/uploads/:uploadId/complete', () => {
  let uploadId: string;

  beforeEach(async () => {
    uploadId = await requestUploadViaApi(clientToken);
  });

  it('transitions status from pending to available', async () => {
    const res = await request(app)
      .post(`/v1/uploads/${uploadId}/complete`)
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      uploadId,
      status: 'available',
    });
    expect(res.body).toHaveProperty('contentType');
    expect(res.body).toHaveProperty('sizeBytes');
  });

  it('returns 403 for non-owner (other client)', async () => {
    const res = await request(app)
      .post(`/v1/uploads/${uploadId}/complete`)
      .set('Authorization', `Bearer ${otherClientToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('is idempotent — returns 200 if already available', async () => {
    // Complete once
    await request(app)
      .post(`/v1/uploads/${uploadId}/complete`)
      .set('Authorization', `Bearer ${clientToken}`);

    // Complete again — should still return 200
    const res = await request(app)
      .post(`/v1/uploads/${uploadId}/complete`)
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      uploadId,
      status: 'available',
    });
  });
});

// ---------------------------------------------------------------------------
// POST /v1/uploads/:uploadId/access
// ---------------------------------------------------------------------------
describe('POST /v1/uploads/:uploadId/access', () => {
  let uploadId: string;

  beforeEach(async () => {
    uploadId = await requestUploadViaApi(clientToken);
    // Complete the upload so it is available
    await request(app)
      .post(`/v1/uploads/${uploadId}/complete`)
      .set('Authorization', `Bearer ${clientToken}`);
  });

  it('returns mock accessUrl for upload owner', async () => {
    const res = await request(app)
      .post(`/v1/uploads/${uploadId}/access`)
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('uploadId', uploadId);
    expect(res.body).toHaveProperty('accessUrl');
    expect(res.body).toHaveProperty('expiresAt');
    expect(typeof res.body.accessUrl).toBe('string');
    expect(res.body.accessUrl.length).toBeGreaterThan(0);
  });

  it('returns 403 for non-owner client without therapist_feedback purpose', async () => {
    const res = await request(app)
      .post(`/v1/uploads/${uploadId}/access`)
      .set('Authorization', `Bearer ${otherClientToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('allows client access to therapist_feedback uploads', async () => {
    // Therapist creates a feedback upload
    const feedbackUploadId = await requestUploadViaApi(therapistToken, {
      purpose: 'therapist_feedback',
      contentType: 'video/mp4',
      sizeBytes: 1024 * 1024,
    });

    // Complete it
    await request(app)
      .post(`/v1/uploads/${feedbackUploadId}/complete`)
      .set('Authorization', `Bearer ${therapistToken}`);

    // A client (non-owner) can access therapist_feedback uploads
    const res = await request(app)
      .post(`/v1/uploads/${feedbackUploadId}/access`)
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessUrl');
  });
});
