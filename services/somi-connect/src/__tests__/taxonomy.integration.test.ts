/**
 * taxonomy.integration.test.ts — Integration tests for taxonomy endpoints.
 *
 * Uses supertest to hit the real Express app backed by MongoDB Memory Server.
 * DB is cleared and re-seeded before each test.
 */

import request from 'supertest';
import { startDb, stopDb, clearDb } from './setup.js';
import { createApp } from '../app.js';
import { UserModel } from '../models/user.model.js';
import { TaxonomyModel } from '../models/taxonomy.model.js';
import { hashPassword, signAccessToken } from '../services/auth.service.js';

const app = createApp();

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let adminId: string;
let adminToken: string;
let therapistId: string;
let therapistToken: string;
let clientId: string;
let clientToken: string;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function getAccessToken(userId: string, role: 'client' | 'therapist' | 'admin'): string {
  return signAccessToken({ userId, role });
}

async function seedData() {
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
// GET /v1/admin/taxonomy
// ---------------------------------------------------------------------------
describe('GET /v1/admin/taxonomy', () => {
  beforeEach(async () => {
    await TaxonomyModel.create([
      { category: 'function', label: 'Strength' },
      { category: 'structure', label: 'Shoulder' },
      { category: 'age', label: 'Adult' },
    ]);
  });

  it('returns all tags for therapist', async () => {
    const res = await request(app)
      .get('/v1/admin/taxonomy')
      .set('Authorization', `Bearer ${therapistToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('items');
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBe(3);

    const item = res.body.items[0];
    expect(item).toHaveProperty('tagId');
    expect(item).toHaveProperty('category');
    expect(item).toHaveProperty('label');
  });

  it('returns all tags for admin', async () => {
    const res = await request(app)
      .get('/v1/admin/taxonomy')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(3);
  });

  it('returns 403 for client role', async () => {
    const res = await request(app)
      .get('/v1/admin/taxonomy')
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/v1/admin/taxonomy');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});

// ---------------------------------------------------------------------------
// POST /v1/admin/taxonomy
// ---------------------------------------------------------------------------
describe('POST /v1/admin/taxonomy', () => {
  it('returns 201 for admin with created tag', async () => {
    const res = await request(app)
      .post('/v1/admin/taxonomy')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ category: 'function', label: 'Mobility' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('tagId');
    expect(res.body).toMatchObject({
      category: 'function',
      label: 'Mobility',
    });
  });

  it('returns 403 for therapist (create is admin-only)', async () => {
    const res = await request(app)
      .post('/v1/admin/taxonomy')
      .set('Authorization', `Bearer ${therapistToken}`)
      .send({ category: 'function', label: 'Mobility' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('returns 409 for duplicate category+label combination', async () => {
    await request(app)
      .post('/v1/admin/taxonomy')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ category: 'structure', label: 'Knee' });

    const res = await request(app)
      .post('/v1/admin/taxonomy')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ category: 'structure', label: 'Knee' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('returns 400 for invalid category', async () => {
    const res = await request(app)
      .post('/v1/admin/taxonomy')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ category: 'invalid_category', label: 'Test' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 for missing label', async () => {
    const res = await request(app)
      .post('/v1/admin/taxonomy')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ category: 'function' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

// ---------------------------------------------------------------------------
// DELETE /v1/admin/taxonomy/:tagId
// ---------------------------------------------------------------------------
describe('DELETE /v1/admin/taxonomy/:tagId', () => {
  let tagId: string;

  beforeEach(async () => {
    const tag = await TaxonomyModel.create({ category: 'age', label: 'Pediatric' });
    tagId = tag._id.toString();
  });

  it('returns 204 for admin', async () => {
    const res = await request(app)
      .delete(`/v1/admin/taxonomy/${tagId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(204);

    // Verify tag is actually deleted
    const deleted = await TaxonomyModel.findById(tagId).lean();
    expect(deleted).toBeNull();
  });

  it('returns 403 for therapist', async () => {
    const res = await request(app)
      .delete(`/v1/admin/taxonomy/${tagId}`)
      .set('Authorization', `Bearer ${therapistToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('returns 404 for non-existent tagId', async () => {
    const fakeId = '000000000000000000000001';
    const res = await request(app)
      .delete(`/v1/admin/taxonomy/${fakeId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
