/**
 * feedback-notes.integration.test.ts — Integration tests for Feedback and Notes endpoints.
 *
 * Tests:
 *   POST /v1/clinic/patients/:patientId/feedback
 *   GET  /v1/clinic/patients/:patientId/feedback
 *   POST /v1/clinic/patients/:patientId/notes
 *   GET  /v1/clinic/patients/:patientId/notes
 */

import request from 'supertest';
import { startDb, stopDb, clearDb } from './setup.js';
import { createApp } from '../app.js';
import { UserModel } from '../models/user.model.js';
import { PatientProfileModel } from '../models/patient-profile.model.js';
import { FeedbackModel } from '../models/feedback.model.js';
import { NoteModel } from '../models/note.model.js';
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
let otherTherapistId: string;
let otherTherapistToken: string;

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

  const other = await UserModel.create({
    email: 'other.therapist@test.com',
    passwordHash: hash,
    role: 'therapist',
    status: 'active',
    mfaEnabled: false,
  });
  otherTherapistId = other._id.toString();
  otherTherapistToken = getAccessToken(otherTherapistId, 'therapist');
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
// POST /v1/clinic/patients/:patientId/feedback
// ---------------------------------------------------------------------------
describe('POST /v1/clinic/patients/:patientId/feedback', () => {
  const FEEDBACK_URL = () => `/v1/clinic/patients/${patientId}/feedback`;

  it('returns 201 and feedback body for assigned therapist', async () => {
    const res = await request(app)
      .post(FEEDBACK_URL())
      .set('Authorization', `Bearer ${therapistToken}`)
      .send({ text: 'Great progress this week!' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('feedbackId');
    expect(res.body.patientId).toBe(patientId);
    expect(res.body.therapistUserId).toBe(therapistId);
    expect(res.body.text).toBe('Great progress this week!');
    expect(res.body).toHaveProperty('createdAt');
  });

  it('returns 201 for admin', async () => {
    const res = await request(app)
      .post(FEEDBACK_URL())
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ text: 'Admin feedback.' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('feedbackId');
  });

  it('validates text is non-empty', async () => {
    const res = await request(app)
      .post(FEEDBACK_URL())
      .set('Authorization', `Bearer ${therapistToken}`)
      .send({ text: '   ' });

    expect(res.status).toBe(400);
  });

  it('validates text is present', async () => {
    const res = await request(app)
      .post(FEEDBACK_URL())
      .set('Authorization', `Bearer ${therapistToken}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it('returns 403 for client role', async () => {
    const res = await request(app)
      .post(FEEDBACK_URL())
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ text: 'Client cannot create feedback.' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('therapist can create feedback for any patient', async () => {
    const res = await request(app)
      .post(FEEDBACK_URL())
      .set('Authorization', `Bearer ${otherTherapistToken}`)
      .send({ text: 'Feedback from another therapist.' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('feedbackId');
    expect(res.body.patientId).toBe(patientId);
    expect(res.body.therapistUserId).toBe(otherTherapistId);
    expect(res.body.text).toBe('Feedback from another therapist.');
    expect(res.body).toHaveProperty('createdAt');
  });

  it('returns 401 without authentication', async () => {
    const res = await request(app)
      .post(FEEDBACK_URL())
      .send({ text: 'No auth.' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});

// ---------------------------------------------------------------------------
// GET /v1/clinic/patients/:patientId/feedback
// ---------------------------------------------------------------------------
describe('GET /v1/clinic/patients/:patientId/feedback', () => {
  const FEEDBACK_URL = () => `/v1/clinic/patients/${patientId}/feedback`;

  beforeEach(async () => {
    // Seed 5 feedback items
    for (let i = 1; i <= 5; i++) {
      await FeedbackModel.create({
        patientId,
        therapistUserId: therapistId,
        text: `Feedback item ${i}`,
      });
    }
  });

  it('returns list for assigned therapist', async () => {
    const res = await request(app)
      .get(FEEDBACK_URL())
      .set('Authorization', `Bearer ${therapistToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBe(5);
    expect(res.body).toHaveProperty('nextCursor');
  });

  it('returns list for admin', async () => {
    const res = await request(app)
      .get(FEEDBACK_URL())
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(5);
  });

  it('each item has expected fields', async () => {
    const res = await request(app)
      .get(FEEDBACK_URL())
      .set('Authorization', `Bearer ${therapistToken}`);

    expect(res.status).toBe(200);
    const item = res.body.items[0];
    expect(item).toHaveProperty('feedbackId');
    expect(item).toHaveProperty('patientId');
    expect(item).toHaveProperty('therapistUserId');
    expect(item).toHaveProperty('text');
    expect(item).toHaveProperty('createdAt');
  });

  it('client can read their own feedback', async () => {
    const res = await request(app)
      .get(FEEDBACK_URL())
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
  });

  it('supports pagination with limit', async () => {
    const res = await request(app)
      .get(`${FEEDBACK_URL()}?limit=3`)
      .set('Authorization', `Bearer ${therapistToken}`);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(3);
    expect(res.body.nextCursor).toBeTruthy();
    expect(typeof res.body.nextCursor).toBe('string');
  });

  it('follows nextCursor to get the next page', async () => {
    const firstPage = await request(app)
      .get(`${FEEDBACK_URL()}?limit=3`)
      .set('Authorization', `Bearer ${therapistToken}`);

    expect(firstPage.status).toBe(200);
    const cursor = firstPage.body.nextCursor as string;
    expect(cursor).toBeTruthy();

    const secondPage = await request(app)
      .get(`${FEEDBACK_URL()}?limit=3&cursor=${cursor}`)
      .set('Authorization', `Bearer ${therapistToken}`);

    expect(secondPage.status).toBe(200);
    expect(Array.isArray(secondPage.body.items)).toBe(true);
    // IDs should not overlap between pages
    const firstIds = firstPage.body.items.map((i: { feedbackId: string }) => i.feedbackId);
    const secondIds = secondPage.body.items.map((i: { feedbackId: string }) => i.feedbackId);
    for (const id of secondIds) {
      expect(firstIds).not.toContain(id);
    }
  });

  it('returns nextCursor as null when all items fit', async () => {
    const res = await request(app)
      .get(`${FEEDBACK_URL()}?limit=25`)
      .set('Authorization', `Bearer ${therapistToken}`);

    expect(res.status).toBe(200);
    expect(res.body.nextCursor).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// POST /v1/clinic/patients/:patientId/notes
// ---------------------------------------------------------------------------
describe('POST /v1/clinic/patients/:patientId/notes', () => {
  const NOTES_URL = () => `/v1/clinic/patients/${patientId}/notes`;

  it('returns 201 and note body for assigned therapist', async () => {
    const res = await request(app)
      .post(NOTES_URL())
      .set('Authorization', `Bearer ${therapistToken}`)
      .send({ noteText: 'Patient showed improvement in session.' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('noteId');
    expect(res.body.patientId).toBe(patientId);
    expect(res.body.authorUserId).toBe(therapistId);
    expect(res.body.noteText).toBe('Patient showed improvement in session.');
    expect(res.body).toHaveProperty('createdAt');
  });

  it('returns 201 for admin', async () => {
    const res = await request(app)
      .post(NOTES_URL())
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ noteText: 'Admin note.' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('noteId');
  });

  it('validates noteText is non-empty', async () => {
    const res = await request(app)
      .post(NOTES_URL())
      .set('Authorization', `Bearer ${therapistToken}`)
      .send({ noteText: '   ' });

    expect(res.status).toBe(400);
  });

  it('validates noteText is present', async () => {
    const res = await request(app)
      .post(NOTES_URL())
      .set('Authorization', `Bearer ${therapistToken}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it('returns 403 for client role', async () => {
    const res = await request(app)
      .post(NOTES_URL())
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ noteText: 'Client should not create notes.' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('therapist can create notes for any patient', async () => {
    const res = await request(app)
      .post(NOTES_URL())
      .set('Authorization', `Bearer ${otherTherapistToken}`)
      .send({ noteText: 'Cross-therapist note.' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('noteId');
  });

  it('returns 401 without authentication', async () => {
    const res = await request(app)
      .post(NOTES_URL())
      .send({ noteText: 'No auth.' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('accepts optional planId and sessionKey fields', async () => {
    const res = await request(app)
      .post(NOTES_URL())
      .set('Authorization', `Bearer ${therapistToken}`)
      .send({
        noteText: 'Session-specific note.',
        planId: '000000000000000000000001',
        sessionKey: 'sess_01',
      });

    expect(res.status).toBe(201);
    expect(res.body.planId).toBe('000000000000000000000001');
    expect(res.body.sessionKey).toBe('sess_01');
  });
});

// ---------------------------------------------------------------------------
// GET /v1/clinic/patients/:patientId/notes
// ---------------------------------------------------------------------------
describe('GET /v1/clinic/patients/:patientId/notes', () => {
  const NOTES_URL = () => `/v1/clinic/patients/${patientId}/notes`;

  beforeEach(async () => {
    // Seed 5 notes
    for (let i = 1; i <= 5; i++) {
      await NoteModel.create({
        patientId,
        authorUserId: therapistId,
        noteText: `Note item ${i}`,
      });
    }
  });

  it('returns list for assigned therapist', async () => {
    const res = await request(app)
      .get(NOTES_URL())
      .set('Authorization', `Bearer ${therapistToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBe(5);
    expect(res.body).toHaveProperty('nextCursor');
  });

  it('returns list for admin', async () => {
    const res = await request(app)
      .get(NOTES_URL())
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(5);
  });

  it('each item has expected fields', async () => {
    const res = await request(app)
      .get(NOTES_URL())
      .set('Authorization', `Bearer ${therapistToken}`);

    expect(res.status).toBe(200);
    const item = res.body.items[0];
    expect(item).toHaveProperty('noteId');
    expect(item).toHaveProperty('patientId');
    expect(item).toHaveProperty('authorUserId');
    expect(item).toHaveProperty('noteText');
    expect(item).toHaveProperty('createdAt');
  });

  it('returns 403 for client role — notes are NEVER exposed to clients', async () => {
    const res = await request(app)
      .get(NOTES_URL())
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('therapist can list notes for any patient', async () => {
    const res = await request(app)
      .get(NOTES_URL())
      .set('Authorization', `Bearer ${otherTherapistToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  it('supports pagination with limit', async () => {
    const res = await request(app)
      .get(`${NOTES_URL()}?limit=3`)
      .set('Authorization', `Bearer ${therapistToken}`);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(3);
    expect(res.body.nextCursor).toBeTruthy();
    expect(typeof res.body.nextCursor).toBe('string');
  });

  it('follows nextCursor to get the next page', async () => {
    const firstPage = await request(app)
      .get(`${NOTES_URL()}?limit=3`)
      .set('Authorization', `Bearer ${therapistToken}`);

    expect(firstPage.status).toBe(200);
    const cursor = firstPage.body.nextCursor as string;
    expect(cursor).toBeTruthy();

    const secondPage = await request(app)
      .get(`${NOTES_URL()}?limit=3&cursor=${cursor}`)
      .set('Authorization', `Bearer ${therapistToken}`);

    expect(secondPage.status).toBe(200);
    expect(Array.isArray(secondPage.body.items)).toBe(true);
    // IDs should not overlap between pages
    const firstIds = firstPage.body.items.map((i: { noteId: string }) => i.noteId);
    const secondIds = secondPage.body.items.map((i: { noteId: string }) => i.noteId);
    for (const id of secondIds) {
      expect(firstIds).not.toContain(id);
    }
  });

  it('returns nextCursor as null when all items fit', async () => {
    const res = await request(app)
      .get(`${NOTES_URL()}?limit=25`)
      .set('Authorization', `Bearer ${therapistToken}`);

    expect(res.status).toBe(200);
    expect(res.body.nextCursor).toBeNull();
  });

  it('returns 401 without authentication', async () => {
    const res = await request(app).get(NOTES_URL());

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});
