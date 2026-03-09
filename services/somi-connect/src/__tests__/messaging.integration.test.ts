/**
 * messaging.integration.test.ts — Integration tests for Messaging endpoints.
 *
 * Tests:
 *   GET  /v1/me/messages/thread
 *   GET  /v1/clinic/patients/:patientId/messages/thread
 *   GET  /v1/messages/threads/:threadId/messages
 *   POST /v1/messages/threads/:threadId/messages
 */

import request from 'supertest';
import { startDb, stopDb, clearDb } from './setup.js';
import { createApp } from '../app.js';
import { UserModel } from '../models/user.model.js';
import { PatientProfileModel } from '../models/patient-profile.model.js';
import { MessageThreadModel } from '../models/message-thread.model.js';
import { hashPassword, signAccessToken } from '../services/auth.service.js';

const app = createApp();

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let therapistId: string;
let therapistToken: string;
let adminId: string;
let adminToken: string;
let clientId: string;
let clientToken: string;
let patientId: string;

// Unrelated client for access-control tests
let otherClientId: string;
let otherClientToken: string;
let otherPatientId: string;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function getAccessToken(userId: string, role: 'client' | 'therapist' | 'admin'): string {
  return signAccessToken({ userId, role });
}

async function seedData() {
  const hash = await hashPassword('Password123!');

  const therapist = await UserModel.create({
    email: 'therapist@test.com',
    passwordHash: hash,
    role: 'therapist',
    status: 'active',
    mfaEnabled: false,
  });
  therapistId = therapist._id.toString();
  therapistToken = getAccessToken(therapistId, 'therapist');

  const admin = await UserModel.create({
    email: 'admin@test.com',
    passwordHash: hash,
    role: 'admin',
    status: 'active',
    mfaEnabled: false,
  });
  adminId = admin._id.toString();
  adminToken = getAccessToken(adminId, 'admin');

  const client = await UserModel.create({
    email: 'client@test.com',
    passwordHash: hash,
    role: 'client',
    status: 'active',
    mfaEnabled: false,
  });
  clientId = client._id.toString();
  clientToken = getAccessToken(clientId, 'client');

  const patient = await PatientProfileModel.create({
    userId: clientId,
    displayName: 'Test Patient',
    status: 'active',
    primaryTherapistId: therapistId,
    clinicId: 'default_clinic',
  });
  patientId = patient._id.toString();

  // Unrelated client with their own patient profile
  const otherClient = await UserModel.create({
    email: 'other.client@test.com',
    passwordHash: hash,
    role: 'client',
    status: 'active',
    mfaEnabled: false,
  });
  otherClientId = otherClient._id.toString();
  otherClientToken = getAccessToken(otherClientId, 'client');

  const otherPatient = await PatientProfileModel.create({
    userId: otherClientId,
    displayName: 'Other Patient',
    status: 'active',
    primaryTherapistId: therapistId,
    clinicId: 'default_clinic',
  });
  otherPatientId = otherPatient._id.toString();
}

/**
 * Get or create the thread for the main client by hitting the API.
 * Returns the thread body (includes threadId).
 */
async function getClientThread() {
  const res = await request(app)
    .get('/v1/me/messages/thread')
    .set('Authorization', `Bearer ${clientToken}`);
  expect(res.status).toBe(200);
  return res.body as { threadId: string; patientId: string; therapistUserId: string };
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
// GET /v1/me/messages/thread
// ---------------------------------------------------------------------------
describe('GET /v1/me/messages/thread', () => {
  it('returns thread for the client (creates if needed)', async () => {
    const res = await request(app)
      .get('/v1/me/messages/thread')
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('threadId');
    expect(res.body.patientId).toBe(patientId);
    expect(res.body.therapistUserId).toBe(therapistId);
    expect(res.body.status).toBe('active');
  });

  it('returns the same thread on repeated calls (idempotent)', async () => {
    const first = await request(app)
      .get('/v1/me/messages/thread')
      .set('Authorization', `Bearer ${clientToken}`);
    const second = await request(app)
      .get('/v1/me/messages/thread')
      .set('Authorization', `Bearer ${clientToken}`);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(first.body.threadId).toBe(second.body.threadId);
  });

  it('returns 403 for therapist role', async () => {
    const res = await request(app)
      .get('/v1/me/messages/thread')
      .set('Authorization', `Bearer ${therapistToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('returns 403 for admin role', async () => {
    const res = await request(app)
      .get('/v1/me/messages/thread')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('returns 401 without authentication', async () => {
    const res = await request(app).get('/v1/me/messages/thread');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});

// ---------------------------------------------------------------------------
// GET /v1/clinic/patients/:patientId/messages/thread
// ---------------------------------------------------------------------------
describe('GET /v1/clinic/patients/:patientId/messages/thread', () => {
  it('returns thread for the assigned therapist (creates if needed)', async () => {
    const res = await request(app)
      .get(`/v1/clinic/patients/${patientId}/messages/thread`)
      .set('Authorization', `Bearer ${therapistToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('threadId');
    expect(res.body.patientId).toBe(patientId);
    expect(res.body.status).toBe('active');
  });

  it('admin can access any patient thread', async () => {
    const res = await request(app)
      .get(`/v1/clinic/patients/${patientId}/messages/thread`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('threadId');
  });

  it('returns 403 for client role', async () => {
    const res = await request(app)
      .get(`/v1/clinic/patients/${patientId}/messages/thread`)
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('returns the same thread as GET /v1/me/messages/thread', async () => {
    const clientRes = await request(app)
      .get('/v1/me/messages/thread')
      .set('Authorization', `Bearer ${clientToken}`);
    const therapistRes = await request(app)
      .get(`/v1/clinic/patients/${patientId}/messages/thread`)
      .set('Authorization', `Bearer ${therapistToken}`);

    expect(clientRes.status).toBe(200);
    expect(therapistRes.status).toBe(200);
    expect(clientRes.body.threadId).toBe(therapistRes.body.threadId);
  });
});

// ---------------------------------------------------------------------------
// GET /v1/messages/threads/:threadId/messages
// ---------------------------------------------------------------------------
describe('GET /v1/messages/threads/:threadId/messages', () => {
  it('returns empty list for a new thread', async () => {
    const { threadId } = await getClientThread();

    const res = await request(app)
      .get(`/v1/messages/threads/${threadId}/messages`)
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(0);
    expect(res.body.nextCursor).toBeNull();
  });

  it('returns messages after sending some', async () => {
    const { threadId } = await getClientThread();

    // Send 2 messages
    await request(app)
      .post(`/v1/messages/threads/${threadId}/messages`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ text: 'Hello from client' });

    await request(app)
      .post(`/v1/messages/threads/${threadId}/messages`)
      .set('Authorization', `Bearer ${therapistToken}`)
      .send({ text: 'Hello from therapist' });

    const res = await request(app)
      .get(`/v1/messages/threads/${threadId}/messages`)
      .set('Authorization', `Bearer ${therapistToken}`);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.items[0]).toHaveProperty('messageId');
    expect(res.body.items[0]).toHaveProperty('threadId');
    expect(res.body.items[0]).toHaveProperty('senderUserId');
    expect(res.body.items[0]).toHaveProperty('senderRole');
    expect(res.body.items[0]).toHaveProperty('text');
    expect(res.body.items[0]).toHaveProperty('createdAt');
  });

  it('supports pagination with limit', async () => {
    const { threadId } = await getClientThread();

    // Send 5 messages
    for (let i = 1; i <= 5; i++) {
      await request(app)
        .post(`/v1/messages/threads/${threadId}/messages`)
        .set('Authorization', `Bearer ${clientToken}`)
        .send({ text: `Message ${i}` });
    }

    const res = await request(app)
      .get(`/v1/messages/threads/${threadId}/messages?limit=3`)
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(3);
    expect(res.body.nextCursor).toBeTruthy();
  });

  it('follows nextCursor to get the next page', async () => {
    const { threadId } = await getClientThread();

    for (let i = 1; i <= 4; i++) {
      await request(app)
        .post(`/v1/messages/threads/${threadId}/messages`)
        .set('Authorization', `Bearer ${clientToken}`)
        .send({ text: `Message ${i}` });
    }

    const firstPage = await request(app)
      .get(`/v1/messages/threads/${threadId}/messages?limit=2`)
      .set('Authorization', `Bearer ${clientToken}`);

    expect(firstPage.status).toBe(200);
    const cursor = firstPage.body.nextCursor as string;
    expect(cursor).toBeTruthy();

    const secondPage = await request(app)
      .get(`/v1/messages/threads/${threadId}/messages?limit=2&cursor=${cursor}`)
      .set('Authorization', `Bearer ${clientToken}`);

    expect(secondPage.status).toBe(200);
    expect(Array.isArray(secondPage.body.items)).toBe(true);
    // IDs should not overlap
    const firstIds = firstPage.body.items.map((m: { messageId: string }) => m.messageId);
    const secondIds = secondPage.body.items.map((m: { messageId: string }) => m.messageId);
    for (const id of secondIds) {
      expect(firstIds).not.toContain(id);
    }
  });

  it('returns 403 for unrelated client', async () => {
    const { threadId } = await getClientThread();

    const res = await request(app)
      .get(`/v1/messages/threads/${threadId}/messages`)
      .set('Authorization', `Bearer ${otherClientToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('returns 404 for a non-existent threadId', async () => {
    const fakeThreadId = '000000000000000000000001';

    const res = await request(app)
      .get(`/v1/messages/threads/${fakeThreadId}/messages`)
      .set('Authorization', `Bearer ${therapistToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('therapist can read messages in their patient thread', async () => {
    const { threadId } = await getClientThread();

    await request(app)
      .post(`/v1/messages/threads/${threadId}/messages`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ text: 'A message' });

    const res = await request(app)
      .get(`/v1/messages/threads/${threadId}/messages`)
      .set('Authorization', `Bearer ${therapistToken}`);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// POST /v1/messages/threads/:threadId/messages
// ---------------------------------------------------------------------------
describe('POST /v1/messages/threads/:threadId/messages', () => {
  it('creates a message for the client', async () => {
    const { threadId } = await getClientThread();

    const res = await request(app)
      .post(`/v1/messages/threads/${threadId}/messages`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ text: 'Hello therapist!' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('messageId');
    expect(res.body.threadId).toBe(threadId);
    expect(res.body.senderUserId).toBe(clientId);
    expect(res.body.senderRole).toBe('client');
    expect(res.body.text).toBe('Hello therapist!');
    expect(res.body).toHaveProperty('createdAt');
  });

  it('creates a message for the therapist', async () => {
    const { threadId } = await getClientThread();

    const res = await request(app)
      .post(`/v1/messages/threads/${threadId}/messages`)
      .set('Authorization', `Bearer ${therapistToken}`)
      .send({ text: 'Good progress!' });

    expect(res.status).toBe(201);
    expect(res.body.senderUserId).toBe(therapistId);
    expect(res.body.senderRole).toBe('therapist');
    expect(res.body.text).toBe('Good progress!');
  });

  it('validates that text is non-empty', async () => {
    const { threadId } = await getClientThread();

    const res = await request(app)
      .post(`/v1/messages/threads/${threadId}/messages`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ text: '   ' });

    expect(res.status).toBe(400);
  });

  it('validates that text is present', async () => {
    const { threadId } = await getClientThread();

    const res = await request(app)
      .post(`/v1/messages/threads/${threadId}/messages`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it('returns 403 for unrelated client', async () => {
    const { threadId } = await getClientThread();

    const res = await request(app)
      .post(`/v1/messages/threads/${threadId}/messages`)
      .set('Authorization', `Bearer ${otherClientToken}`)
      .send({ text: 'Hacking attempt' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('updates lastMessageAt on the thread after sending', async () => {
    const { threadId } = await getClientThread();

    await request(app)
      .post(`/v1/messages/threads/${threadId}/messages`)
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ text: 'test message' });

    const thread = await MessageThreadModel.findById(threadId).lean();
    expect(thread?.lastMessageAt).toBeDefined();
  });

  it('returns 401 without authentication', async () => {
    const { threadId } = await getClientThread();

    const res = await request(app)
      .post(`/v1/messages/threads/${threadId}/messages`)
      .send({ text: 'no auth' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});
