/**
 * exercises.integration.test.ts — Integration tests for exercise endpoints.
 *
 * Uses supertest to hit the real Express app backed by MongoDB Memory Server.
 * DB is cleared and re-seeded before each test.
 */

import request from 'supertest';
import { startDb, stopDb, clearDb } from './setup.js';
import { createApp } from '../app.js';
import { UserModel } from '../models/user.model.js';
import { ExerciseModel } from '../models/exercise.model.js';
import { ExerciseVersionModel } from '../models/exercise-version.model.js';
import { TaxonomyModel } from '../models/taxonomy.model.js';
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

  const adminHash = await hashPassword('AdminPass123!');
  const admin = await UserModel.create({
    email: 'admin@example.com',
    passwordHash: adminHash,
    role: 'admin',
    status: 'active',
    mfaEnabled: false,
  });
  adminId = admin._id.toString();
  adminToken = getAccessToken(adminId, 'admin');

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
}

async function createExerciseViaApi(
  token: string,
  overrides: Record<string, unknown> = {},
): Promise<string> {
  const body = {
    title: 'Bicep Curl',
    description: 'A standard bicep curl exercise',
    defaultParams: { reps: 10, sets: 3 },
    ...overrides,
  };
  const res = await request(app)
    .post('/v1/exercises')
    .set('Authorization', `Bearer ${token}`)
    .send(body);
  return res.body.exerciseId as string;
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
// POST /v1/exercises (admin-only)
// ---------------------------------------------------------------------------
describe('POST /v1/exercises', () => {
  it('returns 201 with exercise object for admin', async () => {
    const res = await request(app)
      .post('/v1/exercises')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Shoulder Press',
        description: 'An overhead shoulder press',
        defaultParams: { reps: 12, sets: 3 },
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('exerciseId');
    expect(res.body).toMatchObject({
      title: 'Shoulder Press',
      description: 'An overhead shoulder press',
    });
    expect(res.body.defaultParams).toMatchObject({ reps: 12, sets: 3 });
    expect(res.body).toHaveProperty('versions');
    expect(Array.isArray(res.body.versions)).toBe(true);
  });

  it('sets currentVersionId on created exercise', async () => {
    const res = await request(app)
      .post('/v1/exercises')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Squat',
        description: 'A basic squat movement',
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('currentVersionId');
    expect(typeof res.body.currentVersionId).toBe('string');
    expect(res.body.currentVersionId.length).toBeGreaterThan(0);

    // The currentVersionId should match the first (and only) version
    expect(res.body.versions).toHaveLength(1);
    expect(res.body.versions[0].exerciseVersionId).toBe(res.body.currentVersionId);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app)
      .post('/v1/exercises')
      .send({ title: 'Lunge', description: 'A forward lunge' });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 403 for therapist role', async () => {
    const res = await request(app)
      .post('/v1/exercises')
      .set('Authorization', `Bearer ${therapistToken}`)
      .send({ title: 'Lunge', description: 'A forward lunge' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('returns 403 for client role', async () => {
    const res = await request(app)
      .post('/v1/exercises')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ title: 'Lunge', description: 'A forward lunge' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});

// ---------------------------------------------------------------------------
// GET /v1/exercises (therapist + admin)
// ---------------------------------------------------------------------------
describe('GET /v1/exercises', () => {
  beforeEach(async () => {
    // Create two active and one archived exercise (as admin)
    await request(app)
      .post('/v1/exercises')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Bicep Curl', description: 'A bicep curl exercise' });

    await request(app)
      .post('/v1/exercises')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Tricep Extension', description: 'A tricep extension exercise' });

    const archivedRes = await request(app)
      .post('/v1/exercises')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Archived Move', description: 'An archived exercise' });
    const archivedId = archivedRes.body.exerciseId as string;

    await request(app)
      .post(`/v1/exercises/${archivedId}/archive`)
      .set('Authorization', `Bearer ${adminToken}`);
  });

  it('returns list of exercises for therapist', async () => {
    const res = await request(app)
      .get('/v1/exercises')
      .set('Authorization', `Bearer ${therapistToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('items');
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBeGreaterThan(0);
    expect(res.body).toHaveProperty('nextCursor');
  });

  it('filters out archived exercises by default', async () => {
    const res = await request(app)
      .get('/v1/exercises')
      .set('Authorization', `Bearer ${therapistToken}`);

    expect(res.status).toBe(200);
    const titles = res.body.items.map((e: { title: string }) => e.title);
    expect(titles).not.toContain('Archived Move');
    expect(titles).toContain('Bicep Curl');
    expect(titles).toContain('Tricep Extension');
  });

  it('returns archived exercises when archived=true', async () => {
    const res = await request(app)
      .get('/v1/exercises?archived=true')
      .set('Authorization', `Bearer ${therapistToken}`);

    expect(res.status).toBe(200);
    const titles = res.body.items.map((e: { title: string }) => e.title);
    expect(titles).toContain('Archived Move');
  });

  it('filters results with text search q param', async () => {
    const res = await request(app)
      .get('/v1/exercises?q=Bicep')
      .set('Authorization', `Bearer ${therapistToken}`);

    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
    const titles = res.body.items.map((e: { title: string }) => e.title);
    expect(titles).toContain('Bicep Curl');
    expect(titles).not.toContain('Tricep Extension');
  });

  it('filters results with tagIds param', async () => {
    // Create a taxonomy tag and an exercise that uses it
    const tag = await TaxonomyModel.create({ category: 'function', label: 'Strength' });
    const tagId = tag._id.toString();

    await request(app)
      .post('/v1/exercises')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Tagged Exercise',
        description: 'An exercise with a tag',
        tagIds: [tagId],
      });

    const res = await request(app)
      .get(`/v1/exercises?tagIds=${tagId}`)
      .set('Authorization', `Bearer ${therapistToken}`);

    expect(res.status).toBe(200);
    const titles = res.body.items.map((e: { title: string }) => e.title);
    expect(titles).toContain('Tagged Exercise');
    expect(titles).not.toContain('Bicep Curl');
  });

  it('returns nextCursor when more items exist', async () => {
    // Create additional exercises to exceed the limit of 1
    await request(app)
      .post('/v1/exercises')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Extra Exercise A', description: 'Extra A' });

    const res = await request(app)
      .get('/v1/exercises?limit=1')
      .set('Authorization', `Bearer ${therapistToken}`);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.nextCursor).not.toBeNull();
    expect(typeof res.body.nextCursor).toBe('string');
  });

  it('returns 403 for client role', async () => {
    const res = await request(app)
      .get('/v1/exercises')
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});

// ---------------------------------------------------------------------------
// GET /v1/exercises/:exerciseId (therapist + admin)
// ---------------------------------------------------------------------------
describe('GET /v1/exercises/:exerciseId', () => {
  let exerciseId: string;

  beforeEach(async () => {
    exerciseId = await createExerciseViaApi(adminToken);
  });

  it('returns exercise with versions array for therapist', async () => {
    const res = await request(app)
      .get(`/v1/exercises/${exerciseId}`)
      .set('Authorization', `Bearer ${therapistToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ exerciseId });
    expect(res.body).toHaveProperty('versions');
    expect(Array.isArray(res.body.versions)).toBe(true);
    expect(res.body.versions.length).toBeGreaterThan(0);
    expect(res.body.versions[0]).toHaveProperty('exerciseVersionId');
    expect(res.body.versions[0]).toHaveProperty('createdAt');
  });

  it('returns 404 for non-existent exercise ID', async () => {
    const fakeId = '000000000000000000000001';
    const res = await request(app)
      .get(`/v1/exercises/${fakeId}`)
      .set('Authorization', `Bearer ${therapistToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 403 for client role', async () => {
    const res = await request(app)
      .get(`/v1/exercises/${exerciseId}`)
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});

// ---------------------------------------------------------------------------
// PATCH /v1/exercises/:exerciseId (admin-only)
// ---------------------------------------------------------------------------
describe('PATCH /v1/exercises/:exerciseId', () => {
  let exerciseId: string;
  let originalVersionId: string;

  beforeEach(async () => {
    const res = await request(app)
      .post('/v1/exercises')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Original Title',
        description: 'Original description',
        defaultParams: { reps: 10, sets: 3 },
      });
    exerciseId = res.body.exerciseId as string;
    originalVersionId = res.body.currentVersionId as string;
  });

  it('creates a new ExerciseVersion on update', async () => {
    const versionsBefore = await ExerciseVersionModel.countDocuments({ exerciseId });

    await request(app)
      .patch(`/v1/exercises/${exerciseId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Updated Title', description: 'Updated description' });

    const versionsAfter = await ExerciseVersionModel.countDocuments({ exerciseId });
    expect(versionsAfter).toBe(versionsBefore + 1);
  });

  it('updates currentVersionId to the new version', async () => {
    const res = await request(app)
      .patch(`/v1/exercises/${exerciseId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Updated Title', description: 'Updated description' });

    expect(res.status).toBe(200);
    expect(res.body.currentVersionId).not.toBe(originalVersionId);
  });

  it('returns updated exercise object', async () => {
    const res = await request(app)
      .patch(`/v1/exercises/${exerciseId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'New Title', description: 'New description' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      exerciseId,
      title: 'New Title',
      description: 'New description',
    });
  });

  it('partial update (only title) keeps other fields from current version', async () => {
    const res = await request(app)
      .patch(`/v1/exercises/${exerciseId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Changed Title Only' });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Changed Title Only');
    // description is inherited from the previous version
    expect(res.body.description).toBe('Original description');
    expect(res.body.defaultParams).toMatchObject({ reps: 10, sets: 3 });
  });

  it('returns 403 for therapist role', async () => {
    const res = await request(app)
      .patch(`/v1/exercises/${exerciseId}`)
      .set('Authorization', `Bearer ${therapistToken}`)
      .send({ title: 'Therapist Update' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});

// ---------------------------------------------------------------------------
// POST /v1/exercises/:exerciseId/archive (admin-only)
// ---------------------------------------------------------------------------
describe('POST /v1/exercises/:exerciseId/archive', () => {
  let exerciseId: string;

  beforeEach(async () => {
    exerciseId = await createExerciseViaApi(adminToken);
  });

  it('sets archivedAt timestamp', async () => {
    const res = await request(app)
      .post(`/v1/exercises/${exerciseId}/archive`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('archivedAt');
    expect(res.body.archivedAt).not.toBeNull();
  });

  it('returns 400 if already archived', async () => {
    // Archive once
    await request(app)
      .post(`/v1/exercises/${exerciseId}/archive`)
      .set('Authorization', `Bearer ${adminToken}`);

    // Try to archive again
    const res = await request(app)
      .post(`/v1/exercises/${exerciseId}/archive`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 403 for therapist role', async () => {
    const res = await request(app)
      .post(`/v1/exercises/${exerciseId}/archive`)
      .set('Authorization', `Bearer ${therapistToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});

// ---------------------------------------------------------------------------
// POST /v1/exercises/:exerciseId/restore (admin-only)
// ---------------------------------------------------------------------------
describe('POST /v1/exercises/:exerciseId/restore', () => {
  let exerciseId: string;

  beforeEach(async () => {
    exerciseId = await createExerciseViaApi(adminToken);
    // Archive the exercise so we can restore it
    await request(app)
      .post(`/v1/exercises/${exerciseId}/archive`)
      .set('Authorization', `Bearer ${adminToken}`);
  });

  it('clears archivedAt on restore', async () => {
    const res = await request(app)
      .post(`/v1/exercises/${exerciseId}/restore`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.archivedAt).toBeNull();
  });

  it('returns 400 if exercise is not archived', async () => {
    // Restore it first
    await request(app)
      .post(`/v1/exercises/${exerciseId}/restore`)
      .set('Authorization', `Bearer ${adminToken}`);

    // Try to restore again (not archived)
    const res = await request(app)
      .post(`/v1/exercises/${exerciseId}/restore`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 403 for therapist role', async () => {
    const res = await request(app)
      .post(`/v1/exercises/${exerciseId}/restore`)
      .set('Authorization', `Bearer ${therapistToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});
