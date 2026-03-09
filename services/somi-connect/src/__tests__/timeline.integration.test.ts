/**
 * timeline.integration.test.ts — Integration tests for Timeline endpoint.
 *
 * Tests:
 *   GET /v1/clinic/patients/:patientId/timeline
 */

import request from 'supertest';
import { startDb, stopDb, clearDb } from './setup.js';
import { createApp } from '../app.js';
import { UserModel } from '../models/user.model.js';
import { PatientProfileModel } from '../models/patient-profile.model.js';
import { TreatmentPlanModel } from '../models/treatment-plan.model.js';
import { CompletionEventModel } from '../models/completion-event.model.js';
import { ExerciseModel } from '../models/exercise.model.js';
import { ExerciseVersionModel } from '../models/exercise-version.model.js';
import { UploadModel } from '../models/upload.model.js';
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
let planId: string;
let exercise1Id: string;
let exercise1VersionId: string;
let exercise2Id: string;
let exercise2VersionId: string;
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

  const ex1 = await ExerciseModel.create({
    currentVersionId: 'placeholder',
    createdByUserId: therapistId,
  });
  const ev1 = await ExerciseVersionModel.create({
    exerciseId: ex1._id.toString(),
    title: 'Tongue Hold',
    description: 'Hold tongue on palate',
    tags: [],
    defaultParams: { reps: 10, sets: 2 },
    createdByUserId: therapistId,
  });
  ex1.currentVersionId = ev1._id.toString();
  await ex1.save();
  exercise1Id = ex1._id.toString();
  exercise1VersionId = ev1._id.toString();

  const ex2 = await ExerciseModel.create({
    currentVersionId: 'placeholder',
    createdByUserId: therapistId,
  });
  const ev2 = await ExerciseVersionModel.create({
    exerciseId: ex2._id.toString(),
    title: 'Lip Seal',
    description: 'Close lips gently',
    tags: [],
    defaultParams: { seconds: 30 },
    createdByUserId: therapistId,
  });
  ex2.currentVersionId = ev2._id.toString();
  await ex2.save();
  exercise2Id = ex2._id.toString();
  exercise2VersionId = ev2._id.toString();

  const other = await UserModel.create({
    email: 'other.therapist@test.com',
    passwordHash: hash,
    role: 'therapist',
    status: 'active',
    mfaEnabled: false,
  });
  otherTherapistId = other._id.toString();
  otherTherapistToken = getAccessToken(otherTherapistId, 'therapist');

  // Create a plan for completions
  const plan = await TreatmentPlanModel.create({
    patientId,
    status: 'published',
    publishedAt: new Date('2026-01-06T00:00:00Z'),
    publishedBy: therapistId,
    remindersEnabled: false,
    sessions: [
      {
        sessionKey: 'sess_01',
        index: 0,
        title: 'Week 1',
        timesPerDay: 3,
        assignments: [
          {
            assignmentKey: 'asgn_01',
            exerciseId: exercise1Id,
            exerciseVersionId: exercise1VersionId,
            index: 0,
          },
          {
            assignmentKey: 'asgn_02',
            exerciseId: exercise2Id,
            exerciseVersionId: exercise2VersionId,
            index: 1,
          },
        ],
      },
    ],
  });
  planId = plan._id.toString();
}

/**
 * Seed one of each timeline item type for the patient, staggered in time
 * so sorting tests are reliable.
 */
async function seedTimelineItems() {
  // Completion — oldest
  await CompletionEventModel.create({
    patientId,
    planId,
    dateLocal: '2026-01-10',
    occurrence: 1,
    exerciseId: exercise1Id,
    exerciseVersionId: exercise1VersionId,
    completedAt: new Date('2026-01-10T08:00:00.000Z'),
    source: 'web',
  });

  // Upload — second oldest
  await UploadModel.create({
    patientId,
    createdByUserId: clientId,
    ownerRole: 'client',
    purpose: 'practice_video',
    contentType: 'video/mp4',
    sizeBytes: 1024,
    s3Key: 'test/video.mp4',
    s3Bucket: 'test-bucket',
    status: 'available',
    createdAt: new Date('2026-01-11T08:00:00.000Z'),
  });

  // Feedback — second newest
  await FeedbackModel.create({
    patientId,
    therapistUserId: therapistId,
    text: 'Good progress this week.',
    createdAt: new Date('2026-01-12T08:00:00.000Z'),
  });

  // Note — newest
  await NoteModel.create({
    patientId,
    authorUserId: therapistId,
    noteText: 'Patient is improving.',
    createdAt: new Date('2026-01-13T08:00:00.000Z'),
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
  await seedData();
});

// ---------------------------------------------------------------------------
// GET /v1/clinic/patients/:patientId/timeline
// ---------------------------------------------------------------------------
describe('GET /v1/clinic/patients/:patientId/timeline', () => {
  const BASE_URL = () => `/v1/clinic/patients/${patientId}/timeline`;

  it('returns items sorted by timestamp descending', async () => {
    await seedTimelineItems();

    const res = await request(app)
      .get(BASE_URL())
      .set('Authorization', `Bearer ${therapistToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBeGreaterThan(1);

    const timestamps = res.body.items.map((i: { timestamp: string }) => i.timestamp);
    for (let i = 0; i < timestamps.length - 1; i++) {
      expect(new Date(timestamps[i]).getTime()).toBeGreaterThanOrEqual(
        new Date(timestamps[i + 1]).getTime(),
      );
    }
  });

  it('includes all 4 types by default', async () => {
    await seedTimelineItems();

    const res = await request(app)
      .get(BASE_URL())
      .set('Authorization', `Bearer ${therapistToken}`);

    expect(res.status).toBe(200);
    const types = res.body.items.map((i: { type: string }) => i.type) as string[];
    expect(types).toContain('completion');
    expect(types).toContain('upload');
    expect(types).toContain('feedback');
    expect(types).toContain('note');
  });

  it('filters by types=completion', async () => {
    await seedTimelineItems();

    const res = await request(app)
      .get(`${BASE_URL()}?types=completion`)
      .set('Authorization', `Bearer ${therapistToken}`);

    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    for (const item of res.body.items) {
      expect(item.type).toBe('completion');
    }
  });

  it('filters by types=feedback,note', async () => {
    await seedTimelineItems();

    const res = await request(app)
      .get(`${BASE_URL()}?types=feedback,note`)
      .set('Authorization', `Bearer ${therapistToken}`);

    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    for (const item of res.body.items) {
      expect(['feedback', 'note']).toContain(item.type);
    }
    const types = res.body.items.map((i: { type: string }) => i.type) as string[];
    expect(types).not.toContain('completion');
    expect(types).not.toContain('upload');
  });

  it('supports pagination with limit', async () => {
    await seedTimelineItems();

    const res = await request(app)
      .get(`${BASE_URL()}?limit=2`)
      .set('Authorization', `Bearer ${therapistToken}`);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.nextCursor).toBeTruthy();
    expect(typeof res.body.nextCursor).toBe('string');
  });

  it('follows nextCursor to get the next page', async () => {
    await seedTimelineItems();

    const firstPage = await request(app)
      .get(`${BASE_URL()}?limit=2`)
      .set('Authorization', `Bearer ${therapistToken}`);

    expect(firstPage.status).toBe(200);
    const cursor = firstPage.body.nextCursor as string;
    expect(cursor).toBeTruthy();

    const secondPage = await request(app)
      .get(`${BASE_URL()}?limit=2&cursor=${cursor}`)
      .set('Authorization', `Bearer ${therapistToken}`);

    expect(secondPage.status).toBe(200);
    expect(Array.isArray(secondPage.body.items)).toBe(true);
    // Items on second page should be older than items on first page
    if (secondPage.body.items.length > 0) {
      const lastFirstTs = new Date(
        firstPage.body.items[firstPage.body.items.length - 1].timestamp,
      ).getTime();
      const firstSecondTs = new Date(secondPage.body.items[0].timestamp).getTime();
      expect(firstSecondTs).toBeLessThanOrEqual(lastFirstTs);
    }
  });

  it('returns nextCursor as null when all items fit on one page', async () => {
    // Only seed 1 item
    await CompletionEventModel.create({
      patientId,
      planId,
      dateLocal: '2026-01-10',
      occurrence: 1,
      exerciseId: exercise1Id,
      exerciseVersionId: exercise1VersionId,
      completedAt: new Date('2026-01-10T08:00:00.000Z'),
      source: 'web',
    });

    const res = await request(app)
      .get(`${BASE_URL()}?limit=25`)
      .set('Authorization', `Bearer ${therapistToken}`);

    expect(res.status).toBe(200);
    expect(res.body.nextCursor).toBeNull();
  });

  it('returns 403 for client role', async () => {
    const res = await request(app)
      .get(BASE_URL())
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('therapist can access any patient\'s timeline', async () => {
    await seedTimelineItems();

    const res = await request(app)
      .get(BASE_URL())
      .set('Authorization', `Bearer ${otherTherapistToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBeGreaterThan(0);
  });

  it('completion items include exerciseTitle', async () => {
    await CompletionEventModel.create({
      patientId,
      planId,
      dateLocal: '2026-01-10',
      occurrence: 1,
      exerciseId: exercise1Id,
      exerciseVersionId: exercise1VersionId,
      completedAt: new Date('2026-01-10T08:00:00.000Z'),
      source: 'web',
    });

    const res = await request(app)
      .get(`${BASE_URL()}?types=completion`)
      .set('Authorization', `Bearer ${therapistToken}`);

    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    const completion = res.body.items[0];
    expect(completion.type).toBe('completion');
    expect(completion.data).toHaveProperty('exerciseTitle');
    expect(completion.data.exerciseTitle).toBe('Tongue Hold');
  });

  it('admin can access timeline', async () => {
    await seedTimelineItems();

    const res = await request(app)
      .get(BASE_URL())
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  it('returns empty items array when no data exists', async () => {
    const res = await request(app)
      .get(BASE_URL())
      .set('Authorization', `Bearer ${therapistToken}`);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(0);
    expect(res.body.nextCursor).toBeNull();
  });

  it('each item has type, timestamp, and data fields', async () => {
    await seedTimelineItems();

    const res = await request(app)
      .get(BASE_URL())
      .set('Authorization', `Bearer ${therapistToken}`);

    expect(res.status).toBe(200);
    for (const item of res.body.items) {
      expect(item).toHaveProperty('type');
      expect(item).toHaveProperty('timestamp');
      expect(item).toHaveProperty('data');
      expect(typeof item.timestamp).toBe('string');
    }
  });
});
