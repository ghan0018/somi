/**
 * completions.integration.test.ts — Integration tests for Today View and
 * Completion endpoints.
 *
 * Uses supertest to hit the real Express app backed by MongoDB Memory Server.
 * DB is cleared and re-seeded before each test.
 */

import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import { startDb, stopDb, clearDb } from './setup.js';
import { createApp } from '../app.js';
import { UserModel } from '../models/user.model.js';
import { PatientProfileModel } from '../models/patient-profile.model.js';
import { ExerciseModel } from '../models/exercise.model.js';
import { ExerciseVersionModel } from '../models/exercise-version.model.js';
import { TreatmentPlanModel } from '../models/treatment-plan.model.js';
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

// Unassigned therapist for access-control tests
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

  // Exercise 1 — reps-based
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

  // Exercise 2 — seconds-based
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

  // Unrelated therapist
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

/** Seed a published plan with 2 assignments in a single session (timesPerDay=3). */
async function createPublishedPlan(timesPerDay = 3): Promise<string> {
  const plan = await TreatmentPlanModel.create({
    patientId,
    status: 'published',
    publishedAt: new Date(),
    publishedBy: therapistId,
    remindersEnabled: false,
    sessions: [
      {
        sessionKey: 'sess_01',
        index: 0,
        title: 'Week 1',
        timesPerDay,
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
  return plan._id.toString();
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
// GET /v1/me/today — Today View
// ---------------------------------------------------------------------------
describe('GET /v1/me/today', () => {
  const DATE = '2025-06-15';

  beforeEach(async () => {
    await createPublishedPlan(3);
  });

  it('returns assignments with completion arrays for the date', async () => {
    const res = await request(app)
      .get(`/v1/me/today?dateLocal=${DATE}`)
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.status).toBe(200);
    expect(res.body.dateLocal).toBe(DATE);
    expect(res.body).toHaveProperty('sessionKey');
    expect(Array.isArray(res.body.assignments)).toBe(true);
    expect(res.body.assignments).toHaveLength(2);
  });

  it('all completions default to completed:false when none exist', async () => {
    const res = await request(app)
      .get(`/v1/me/today?dateLocal=${DATE}`)
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.status).toBe(200);
    for (const assignment of res.body.assignments) {
      expect(Array.isArray(assignment.completions)).toBe(true);
      for (const completion of assignment.completions) {
        expect(completion.completed).toBe(false);
        expect(completion.completedAt).toBeNull();
      }
    }
  });

  it('shows completed:true for occurrences that have been recorded', async () => {
    // Record occurrence 1 for exercise1
    await request(app)
      .post('/v1/me/completions')
      .set('Authorization', `Bearer ${clientToken}`)
      .set('Idempotency-Key', uuidv4())
      .send({
        dateLocal: DATE,
        occurrence: 1,
        exerciseVersionId: exercise1VersionId,
      });

    const res = await request(app)
      .get(`/v1/me/today?dateLocal=${DATE}`)
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.status).toBe(200);
    const ex1Assignment = res.body.assignments.find(
      (a: { exerciseVersionId: string }) => a.exerciseVersionId === exercise1VersionId,
    );
    expect(ex1Assignment).toBeDefined();
    const occ1 = ex1Assignment.completions.find(
      (c: { occurrence: number }) => c.occurrence === 1,
    );
    expect(occ1.completed).toBe(true);
    expect(occ1.completedAt).toBeTruthy();

    // Occurrence 2 should still be incomplete
    const occ2 = ex1Assignment.completions.find(
      (c: { occurrence: number }) => c.occurrence === 2,
    );
    expect(occ2.completed).toBe(false);
  });

  it('includes exercise inline snapshot with title and description', async () => {
    const res = await request(app)
      .get(`/v1/me/today?dateLocal=${DATE}`)
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.status).toBe(200);
    for (const assignment of res.body.assignments) {
      expect(assignment).toHaveProperty('exercise');
      expect(assignment.exercise).toHaveProperty('title');
      expect(assignment.exercise).toHaveProperty('description');
      expect(typeof assignment.exercise.title).toBe('string');
    }
  });

  it('includes effectiveParams for each assignment', async () => {
    const res = await request(app)
      .get(`/v1/me/today?dateLocal=${DATE}`)
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.status).toBe(200);
    for (const assignment of res.body.assignments) {
      expect(assignment).toHaveProperty('effectiveParams');
      expect(typeof assignment.effectiveParams).toBe('object');
    }

    const ex1Assignment = res.body.assignments.find(
      (a: { exerciseVersionId: string }) => a.exerciseVersionId === exercise1VersionId,
    );
    expect(ex1Assignment.effectiveParams).toMatchObject({ reps: 10, sets: 2 });

    const ex2Assignment = res.body.assignments.find(
      (a: { exerciseVersionId: string }) => a.exerciseVersionId === exercise2VersionId,
    );
    expect(ex2Assignment.effectiveParams).toMatchObject({ seconds: 30 });
  });

  it('computes overallCompletionRate correctly', async () => {
    // Plan has 2 assignments, timesPerDay=3 → totalSlots = 6
    // Record 3 completions → rate = 3/6 = 0.5
    for (let occ = 1; occ <= 3; occ++) {
      await request(app)
        .post('/v1/me/completions')
        .set('Authorization', `Bearer ${clientToken}`)
        .set('Idempotency-Key', uuidv4())
        .send({
          dateLocal: DATE,
          occurrence: occ,
          exerciseVersionId: exercise1VersionId,
        });
    }

    const res = await request(app)
      .get(`/v1/me/today?dateLocal=${DATE}`)
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.status).toBe(200);
    expect(res.body.overallCompletionRate).toBeCloseTo(0.5);
  });

  it('computes overallCompletionRate as 1.0 when all slots are completed', async () => {
    // 2 assignments × 3 timesPerDay = 6 total slots; complete all 6
    for (const versionId of [exercise1VersionId, exercise2VersionId]) {
      for (let occ = 1; occ <= 3; occ++) {
        await request(app)
          .post('/v1/me/completions')
          .set('Authorization', `Bearer ${clientToken}`)
          .set('Idempotency-Key', uuidv4())
          .send({ dateLocal: DATE, occurrence: occ, exerciseVersionId: versionId });
      }
    }

    const res = await request(app)
      .get(`/v1/me/today?dateLocal=${DATE}`)
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.status).toBe(200);
    expect(res.body.overallCompletionRate).toBeCloseTo(1.0);
  });

  it('returns 400 for missing dateLocal', async () => {
    const res = await request(app)
      .get('/v1/me/today')
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 404 when no published plan exists for the client', async () => {
    // No plan was seeded for a fresh client — clear and re-seed without a plan
    await clearDb();
    await seedData();

    const res = await request(app)
      .get(`/v1/me/today?dateLocal=${DATE}`)
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 403 for therapist role', async () => {
    const res = await request(app)
      .get(`/v1/me/today?dateLocal=${DATE}`)
      .set('Authorization', `Bearer ${therapistToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});

// ---------------------------------------------------------------------------
// POST /v1/me/completions — Record completion
// ---------------------------------------------------------------------------
describe('POST /v1/me/completions', () => {
  const DATE = '2025-06-15';

  beforeEach(async () => {
    await createPublishedPlan(3);
  });

  it('returns 201 for a valid new completion', async () => {
    const res = await request(app)
      .post('/v1/me/completions')
      .set('Authorization', `Bearer ${clientToken}`)
      .set('Idempotency-Key', uuidv4())
      .send({
        dateLocal: DATE,
        occurrence: 1,
        exerciseVersionId: exercise1VersionId,
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('completionId');
    expect(res.body.dateLocal).toBe(DATE);
    expect(res.body.occurrence).toBe(1);
    expect(res.body.exerciseVersionId).toBe(exercise1VersionId);
    expect(res.body.patientId).toBe(patientId);
    expect(res.body).toHaveProperty('completedAt');
  });

  it('requires Idempotency-Key header — returns 400 without it', async () => {
    const res = await request(app)
      .post('/v1/me/completions')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        dateLocal: DATE,
        occurrence: 1,
        exerciseVersionId: exercise1VersionId,
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 200 for idempotent resubmission with the same Idempotency-Key', async () => {
    const key = uuidv4();
    const body = {
      dateLocal: DATE,
      occurrence: 1,
      exerciseVersionId: exercise1VersionId,
    };

    const first = await request(app)
      .post('/v1/me/completions')
      .set('Authorization', `Bearer ${clientToken}`)
      .set('Idempotency-Key', key)
      .send(body);

    expect(first.status).toBe(201);

    const second = await request(app)
      .post('/v1/me/completions')
      .set('Authorization', `Bearer ${clientToken}`)
      .set('Idempotency-Key', key)
      .send(body);

    expect(second.status).toBe(200);
    expect(second.body.completionId).toBe(first.body.completionId);
  });

  it('returns 409 for duplicate (patientId, dateLocal, occurrence, exerciseVersionId) with a different key', async () => {
    const body = {
      dateLocal: DATE,
      occurrence: 1,
      exerciseVersionId: exercise1VersionId,
    };

    await request(app)
      .post('/v1/me/completions')
      .set('Authorization', `Bearer ${clientToken}`)
      .set('Idempotency-Key', uuidv4())
      .send(body);

    const res = await request(app)
      .post('/v1/me/completions')
      .set('Authorization', `Bearer ${clientToken}`)
      .set('Idempotency-Key', uuidv4()) // different key, same completion tuple
      .send(body);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('returns 403 for therapist role', async () => {
    const res = await request(app)
      .post('/v1/me/completions')
      .set('Authorization', `Bearer ${therapistToken}`)
      .set('Idempotency-Key', uuidv4())
      .send({
        dateLocal: DATE,
        occurrence: 1,
        exerciseVersionId: exercise1VersionId,
      });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('returns 400 when occurrence exceeds timesPerDay', async () => {
    // Plan is created with timesPerDay=3; occurrence 4 is invalid
    const res = await request(app)
      .post('/v1/me/completions')
      .set('Authorization', `Bearer ${clientToken}`)
      .set('Idempotency-Key', uuidv4())
      .send({
        dateLocal: DATE,
        occurrence: 4,
        exerciseVersionId: exercise1VersionId,
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when exerciseVersionId is not in the plan', async () => {
    // Create a random exercise version ID that is not part of the plan
    const fakeVersionId = '000000000000000000000001';

    const res = await request(app)
      .post('/v1/me/completions')
      .set('Authorization', `Bearer ${clientToken}`)
      .set('Idempotency-Key', uuidv4())
      .send({
        dateLocal: DATE,
        occurrence: 1,
        exerciseVersionId: fakeVersionId,
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 401 without authentication', async () => {
    const res = await request(app)
      .post('/v1/me/completions')
      .set('Idempotency-Key', uuidv4())
      .send({
        dateLocal: DATE,
        occurrence: 1,
        exerciseVersionId: exercise1VersionId,
      });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});

// ---------------------------------------------------------------------------
// GET /v1/clinic/patients/:patientId/completions — Therapist view
// ---------------------------------------------------------------------------
describe('GET /v1/clinic/patients/:patientId/completions', () => {
  const BASE_URL = () => `/v1/clinic/patients/${patientId}/completions`;

  beforeEach(async () => {
    await createPublishedPlan(3);

    // Seed several completions across different dates and occurrences
    const completions = [
      { dateLocal: '2025-06-10', occurrence: 1, exerciseVersionId: exercise1VersionId },
      { dateLocal: '2025-06-10', occurrence: 2, exerciseVersionId: exercise1VersionId },
      { dateLocal: '2025-06-11', occurrence: 1, exerciseVersionId: exercise1VersionId },
      { dateLocal: '2025-06-11', occurrence: 1, exerciseVersionId: exercise2VersionId },
      { dateLocal: '2025-06-12', occurrence: 1, exerciseVersionId: exercise1VersionId },
    ];

    for (const c of completions) {
      await request(app)
        .post('/v1/me/completions')
        .set('Authorization', `Bearer ${clientToken}`)
        .set('Idempotency-Key', uuidv4())
        .send(c);
    }
  });

  it('returns completions list for the assigned therapist', async () => {
    const res = await request(app)
      .get(BASE_URL())
      .set('Authorization', `Bearer ${therapistToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('items');
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBeGreaterThan(0);
    expect(res.body).toHaveProperty('nextCursor');
  });

  it('each item has expected fields', async () => {
    const res = await request(app)
      .get(BASE_URL())
      .set('Authorization', `Bearer ${therapistToken}`);

    expect(res.status).toBe(200);
    const item = res.body.items[0];
    expect(item).toHaveProperty('completionId');
    expect(item).toHaveProperty('dateLocal');
    expect(item).toHaveProperty('occurrence');
    expect(item).toHaveProperty('exerciseId');
    expect(item).toHaveProperty('exerciseVersionId');
    expect(item).toHaveProperty('completedAt');
  });

  it('filters by dateFrom', async () => {
    const res = await request(app)
      .get(`${BASE_URL()}?dateFrom=2025-06-11`)
      .set('Authorization', `Bearer ${therapistToken}`);

    expect(res.status).toBe(200);
    for (const item of res.body.items) {
      expect(item.dateLocal >= '2025-06-11').toBe(true);
    }
    // Should not include 2025-06-10 completions
    const dates = res.body.items.map((i: { dateLocal: string }) => i.dateLocal);
    expect(dates).not.toContain('2025-06-10');
  });

  it('filters by dateTo', async () => {
    const res = await request(app)
      .get(`${BASE_URL()}?dateTo=2025-06-11`)
      .set('Authorization', `Bearer ${therapistToken}`);

    expect(res.status).toBe(200);
    for (const item of res.body.items) {
      expect(item.dateLocal <= '2025-06-11').toBe(true);
    }
    const dates = res.body.items.map((i: { dateLocal: string }) => i.dateLocal);
    expect(dates).not.toContain('2025-06-12');
  });

  it('filters by dateFrom and dateTo range', async () => {
    const res = await request(app)
      .get(`${BASE_URL()}?dateFrom=2025-06-10&dateTo=2025-06-11`)
      .set('Authorization', `Bearer ${therapistToken}`);

    expect(res.status).toBe(200);
    const dates = res.body.items.map((i: { dateLocal: string }) => i.dateLocal);
    expect(dates).not.toContain('2025-06-12');
    expect(dates.some((d: string) => d === '2025-06-10' || d === '2025-06-11')).toBe(true);
  });

  it('filters by occurrence', async () => {
    const res = await request(app)
      .get(`${BASE_URL()}?occurrence=2`)
      .set('Authorization', `Bearer ${therapistToken}`);

    expect(res.status).toBe(200);
    for (const item of res.body.items) {
      expect(item.occurrence).toBe(2);
    }
  });

  it('supports pagination with limit', async () => {
    const res = await request(app)
      .get(`${BASE_URL()}?limit=2`)
      .set('Authorization', `Bearer ${therapistToken}`);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.nextCursor).not.toBeNull();
    expect(typeof res.body.nextCursor).toBe('string');
  });

  it('follows nextCursor to get the next page', async () => {
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
    // IDs on second page should not overlap with first page
    const firstIds = firstPage.body.items.map((i: { completionId: string }) => i.completionId);
    const secondIds = secondPage.body.items.map((i: { completionId: string }) => i.completionId);
    for (const id of secondIds) {
      expect(firstIds).not.toContain(id);
    }
  });

  it('therapist can view completions for any patient', async () => {
    const res = await request(app)
      .get(BASE_URL())
      .set('Authorization', `Bearer ${otherTherapistToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  it('admin can view any patient completions', async () => {
    const res = await request(app)
      .get(BASE_URL())
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
  });

  it('returns 403 for client role', async () => {
    const res = await request(app)
      .get(BASE_URL())
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});
