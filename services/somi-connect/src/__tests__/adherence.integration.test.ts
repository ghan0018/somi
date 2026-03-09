/**
 * adherence.integration.test.ts — Integration tests for Adherence endpoints.
 *
 * Tests:
 *   GET /v1/clinic/patients/:patientId/adherence/weekly
 *   GET /v1/clinic/patients/:patientId/adherence/overall
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
}

/**
 * Seed a published plan with timesPerDay=3 and 2 exercises (6 completions per day).
 * publishedAt is set to a Monday in the distant past so that the overall endpoint
 * always has at least one week.
 */
async function createPublishedPlan(publishedAtDate?: Date) {
  const publishedAt = publishedAtDate ?? new Date('2026-01-05T10:00:00Z'); // a Monday
  return TreatmentPlanModel.create({
    patientId,
    status: 'published',
    publishedAt,
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
}

/**
 * Insert a completion directly into the database for speed.
 * `planId` must be a valid plan ID.
 */
async function insertCompletion(
  planId: string,
  dateLocal: string,
  occurrence: 1 | 2 | 3,
  exerciseVersionId: string,
  exerciseId: string,
) {
  await CompletionEventModel.create({
    patientId,
    planId,
    dateLocal,
    occurrence,
    exerciseId,
    exerciseVersionId,
    completedAt: new Date(`${dateLocal}T10:00:00.000Z`),
    source: 'web',
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
// GET /v1/clinic/patients/:patientId/adherence/weekly
// ---------------------------------------------------------------------------
describe('GET /v1/clinic/patients/:patientId/adherence/weekly', () => {
  /**
   * Fetch the current week's adherence (no weekStart param) and return the
   * weekStart that the server computed. This is timezone-safe because the
   * server uses local-time arithmetic for getMonday().
   */
  async function getCurrentWeekStart(): Promise<string> {
    await createPublishedPlan();
    const res = await request(app)
      .get(`/v1/clinic/patients/${patientId}/adherence/weekly`)
      .set('Authorization', `Bearer ${therapistToken}`);
    expect(res.status).toBe(200);
    return res.body.weekStart as string;
  }

  it('returns 7 days of data with assigned and completed counts', async () => {
    await createPublishedPlan();

    const res = await request(app)
      .get(`/v1/clinic/patients/${patientId}/adherence/weekly`)
      .set('Authorization', `Bearer ${therapistToken}`);

    expect(res.status).toBe(200);
    expect(res.body.patientId).toBe(patientId);
    expect(typeof res.body.weekStart).toBe('string');
    expect(res.body.weekStart).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Array.isArray(res.body.days)).toBe(true);
    expect(res.body.days).toHaveLength(7);
  });

  it('counts completions correctly for specific days', async () => {
    const plan = await createPublishedPlan();
    const planId = plan._id.toString();
    const weekStart = await getCurrentWeekStart();

    // Insert 2 completions on the first day of the current week
    await insertCompletion(planId, weekStart, 1, exercise1VersionId, exercise1Id);
    await insertCompletion(planId, weekStart, 2, exercise1VersionId, exercise1Id);

    const res = await request(app)
      .get(`/v1/clinic/patients/${patientId}/adherence/weekly`)
      .set('Authorization', `Bearer ${therapistToken}`);

    expect(res.status).toBe(200);
    const day = res.body.days.find((d: { date: string }) => d.date === weekStart);
    expect(day).toBeDefined();
    expect(day.completed).toBe(2);
    // Each day: 2 exercises × 3 timesPerDay = 6 assigned
    expect(day.assigned).toBe(6);
  });

  it('returns 0 completed when no completions exist', async () => {
    await createPublishedPlan();

    const res = await request(app)
      .get(`/v1/clinic/patients/${patientId}/adherence/weekly`)
      .set('Authorization', `Bearer ${therapistToken}`);

    expect(res.status).toBe(200);
    for (const day of res.body.days) {
      expect(day.completed).toBe(0);
      expect(day.assigned).toBe(6);
    }
  });

  it('computes summary rate correctly', async () => {
    const plan = await createPublishedPlan();
    const planId = plan._id.toString();

    // Get the current week's days from the API first
    const weekRes = await request(app)
      .get(`/v1/clinic/patients/${patientId}/adherence/weekly`)
      .set('Authorization', `Bearer ${therapistToken}`);
    expect(weekRes.status).toBe(200);
    const days = weekRes.body.days as { date: string }[];

    // Insert 3 completions (exercise1) on each of the 7 days → 21 out of 42 = 0.5
    for (const day of days) {
      for (let occ = 1; occ <= 3; occ++) {
        await insertCompletion(planId, day.date, occ as 1 | 2 | 3, exercise1VersionId, exercise1Id);
      }
    }

    const res = await request(app)
      .get(`/v1/clinic/patients/${patientId}/adherence/weekly`)
      .set('Authorization', `Bearer ${therapistToken}`);

    expect(res.status).toBe(200);
    expect(res.body.summary.totalAssigned).toBe(42);
    expect(res.body.summary.totalCompleted).toBe(21);
    expect(res.body.summary.rate).toBeCloseTo(0.5);
  });

  it('returns 403 for client role', async () => {
    await createPublishedPlan();

    const res = await request(app)
      .get(`/v1/clinic/patients/${patientId}/adherence/weekly`)
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('therapist can access any patient\'s weekly adherence', async () => {
    await createPublishedPlan();

    const res = await request(app)
      .get(`/v1/clinic/patients/${patientId}/adherence/weekly`)
      .set('Authorization', `Bearer ${otherTherapistToken}`);

    expect(res.status).toBe(200);
    expect(res.body.patientId).toBe(patientId);
    expect(res.body.days).toHaveLength(7);
  });

  it('returns 404 when no published plan exists', async () => {
    // No plan created

    const res = await request(app)
      .get(`/v1/clinic/patients/${patientId}/adherence/weekly`)
      .set('Authorization', `Bearer ${therapistToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('admin can view weekly adherence', async () => {
    await createPublishedPlan();

    const res = await request(app)
      .get(`/v1/clinic/patients/${patientId}/adherence/weekly`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.days).toHaveLength(7);
  });

  it('returns weekStart and weekEnd in response with correct 7-day span', async () => {
    await createPublishedPlan();

    const res = await request(app)
      .get(`/v1/clinic/patients/${patientId}/adherence/weekly`)
      .set('Authorization', `Bearer ${therapistToken}`);

    expect(res.status).toBe(200);
    expect(res.body.weekStart).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(res.body.weekEnd).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // weekEnd should be 6 days after weekStart
    const start = new Date(res.body.weekStart + 'T12:00:00Z');
    const end = new Date(res.body.weekEnd + 'T12:00:00Z');
    const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBe(6);
  });
});

// ---------------------------------------------------------------------------
// GET /v1/clinic/patients/:patientId/adherence/overall
// ---------------------------------------------------------------------------
describe('GET /v1/clinic/patients/:patientId/adherence/overall', () => {
  it('returns weeks array from publishedAt to current week', async () => {
    // Published 4 weeks ago (Monday 2026-02-02)
    await createPublishedPlan(new Date('2026-02-02T00:00:00Z'));

    const res = await request(app)
      .get(`/v1/clinic/patients/${patientId}/adherence/overall`)
      .set('Authorization', `Bearer ${therapistToken}`);

    expect(res.status).toBe(200);
    expect(res.body.patientId).toBe(patientId);
    expect(res.body).toHaveProperty('planId');
    expect(Array.isArray(res.body.weeks)).toBe(true);
    expect(res.body.weeks.length).toBeGreaterThanOrEqual(1);
    // Each week has weekStart, rate, successful
    for (const week of res.body.weeks) {
      expect(week).toHaveProperty('weekStart');
      expect(week).toHaveProperty('rate');
      expect(week).toHaveProperty('successful');
      expect(typeof week.weekStart).toBe('string');
      expect(typeof week.rate).toBe('number');
      expect(typeof week.successful).toBe('boolean');
    }
  });

  it('marks weeks as successful when rate >= 0.80', async () => {
    // Published on 2026-02-16 (Monday)
    const publishedAt = new Date('2026-02-16T00:00:00Z');
    const plan = await createPublishedPlan(publishedAt);
    const planId = plan._id.toString();

    // Complete all 6 slots every day of that week (2026-02-16 to 2026-02-22) → rate = 1.0
    const dates = ['2026-02-16', '2026-02-17', '2026-02-18', '2026-02-19', '2026-02-20', '2026-02-21', '2026-02-22'];
    for (const date of dates) {
      for (let occ = 1; occ <= 3; occ++) {
        await insertCompletion(planId, date, occ as 1 | 2 | 3, exercise1VersionId, exercise1Id);
        await insertCompletion(planId, date, occ as 1 | 2 | 3, exercise2VersionId, exercise2Id);
      }
    }

    const res = await request(app)
      .get(`/v1/clinic/patients/${patientId}/adherence/overall`)
      .set('Authorization', `Bearer ${therapistToken}`);

    expect(res.status).toBe(200);
    // The week starting 2026-02-16 should be successful
    const week = res.body.weeks.find((w: { weekStart: string }) => w.weekStart === '2026-02-16');
    expect(week).toBeDefined();
    expect(week.successful).toBe(true);
    expect(week.rate).toBeCloseTo(1.0);
  });

  it('marks weeks as unsuccessful when rate < 0.80', async () => {
    // Published on 2026-02-16 (Monday) with no completions → rate = 0 → unsuccessful
    await createPublishedPlan(new Date('2026-02-16T00:00:00Z'));

    const res = await request(app)
      .get(`/v1/clinic/patients/${patientId}/adherence/overall`)
      .set('Authorization', `Bearer ${therapistToken}`);

    expect(res.status).toBe(200);
    const week = res.body.weeks.find((w: { weekStart: string }) => w.weekStart === '2026-02-16');
    expect(week).toBeDefined();
    expect(week.successful).toBe(false);
  });

  it('computes overallRate in summary', async () => {
    await createPublishedPlan(new Date('2026-02-23T00:00:00Z'));

    const res = await request(app)
      .get(`/v1/clinic/patients/${patientId}/adherence/overall`)
      .set('Authorization', `Bearer ${therapistToken}`);

    expect(res.status).toBe(200);
    expect(res.body.summary).toHaveProperty('totalWeeks');
    expect(res.body.summary).toHaveProperty('successfulWeeks');
    expect(res.body.summary).toHaveProperty('overallRate');
    expect(typeof res.body.summary.overallRate).toBe('number');
  });

  it('returns 403 for client role', async () => {
    await createPublishedPlan();

    const res = await request(app)
      .get(`/v1/clinic/patients/${patientId}/adherence/overall`)
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('therapist can access any patient\'s overall adherence', async () => {
    await createPublishedPlan();

    const res = await request(app)
      .get(`/v1/clinic/patients/${patientId}/adherence/overall`)
      .set('Authorization', `Bearer ${otherTherapistToken}`);

    expect(res.status).toBe(200);
    expect(res.body.patientId).toBe(patientId);
    expect(Array.isArray(res.body.weeks)).toBe(true);
  });

  it('returns 404 when no published plan exists', async () => {
    const res = await request(app)
      .get(`/v1/clinic/patients/${patientId}/adherence/overall`)
      .set('Authorization', `Bearer ${therapistToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('admin can view overall adherence', async () => {
    await createPublishedPlan(new Date('2026-02-23T00:00:00Z'));

    const res = await request(app)
      .get(`/v1/clinic/patients/${patientId}/adherence/overall`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.weeks)).toBe(true);
  });
});
