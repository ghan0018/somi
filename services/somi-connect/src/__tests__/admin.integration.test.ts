/**
 * admin.integration.test.ts — Integration tests for admin endpoints.
 *
 * Uses supertest to hit the real Express app backed by MongoDB Memory Server.
 * DB is cleared and re-seeded before each test.
 */

import request from 'supertest';
import { startDb, stopDb, clearDb } from './setup.js';
import { createApp } from '../app.js';
import { UserModel } from '../models/user.model.js';
import { AuditEventModel } from '../models/audit-event.model.js';
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
// GET /v1/admin/users
// ---------------------------------------------------------------------------
describe('GET /v1/admin/users', () => {
  it('returns all users for admin', async () => {
    const res = await request(app)
      .get('/v1/admin/users')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('items');
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBe(3);
    expect(res.body).toHaveProperty('nextCursor');
  });

  it('filters by role', async () => {
    const res = await request(app)
      .get('/v1/admin/users?role=therapist')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(1);
    expect(res.body.items[0].role).toBe('therapist');
  });

  it('filters by status', async () => {
    // Disable the therapist user directly in the DB
    await UserModel.findByIdAndUpdate(therapistId, { status: 'disabled' });

    const res = await request(app)
      .get('/v1/admin/users?status=disabled')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(1);
    expect(res.body.items[0].status).toBe('disabled');
  });

  it('supports pagination', async () => {
    const res = await request(app)
      .get('/v1/admin/users?limit=2')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.nextCursor).not.toBeNull();
    expect(typeof res.body.nextCursor).toBe('string');

    // Fetch next page
    const res2 = await request(app)
      .get(`/v1/admin/users?limit=2&cursor=${res.body.nextCursor}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res2.status).toBe(200);
    expect(res2.body.items.length).toBe(1);
    expect(res2.body.nextCursor).toBeNull();
  });

  it('does NOT include passwordHash in response', async () => {
    const res = await request(app)
      .get('/v1/admin/users')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    for (const item of res.body.items) {
      expect(item).not.toHaveProperty('passwordHash');
      expect(item).not.toHaveProperty('mfaSecret');
      expect(item).not.toHaveProperty('refreshTokenHash');
    }
  });

  it('returns 403 for therapist', async () => {
    const res = await request(app)
      .get('/v1/admin/users')
      .set('Authorization', `Bearer ${therapistToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('returns 403 for client', async () => {
    const res = await request(app)
      .get('/v1/admin/users')
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});

// ---------------------------------------------------------------------------
// POST /v1/admin/users
// ---------------------------------------------------------------------------
describe('POST /v1/admin/users', () => {
  it('returns 201 for admin inviting therapist', async () => {
    const res = await request(app)
      .post('/v1/admin/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: 'newtherapist@somi.com', role: 'therapist' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('userId');
    expect(res.body.email).toBe('newtherapist@somi.com');
    expect(res.body.role).toBe('therapist');
    expect(res.body.status).toBe('active');
    expect(res.body.mfaEnabled).toBe(false);
    // Sensitive fields must not be present
    expect(res.body).not.toHaveProperty('passwordHash');
    expect(res.body).not.toHaveProperty('mfaSecret');
    expect(res.body).not.toHaveProperty('refreshTokenHash');
  });

  it('returns 409 for duplicate email', async () => {
    const res = await request(app)
      .post('/v1/admin/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: 'therapist@example.com', role: 'therapist' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('returns 400 for role=client (not allowed)', async () => {
    const res = await request(app)
      .post('/v1/admin/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: 'newclient@somi.com', role: 'client' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 403 for therapist', async () => {
    const res = await request(app)
      .post('/v1/admin/users')
      .set('Authorization', `Bearer ${therapistToken}`)
      .send({ email: 'another@somi.com', role: 'therapist' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});

// ---------------------------------------------------------------------------
// POST /v1/admin/users/:userId/disable
// ---------------------------------------------------------------------------
describe('POST /v1/admin/users/:userId/disable', () => {
  it('sets status to disabled', async () => {
    const res = await request(app)
      .post(`/v1/admin/users/${therapistId}/disable`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('disabled');

    // Verify in DB
    const dbUser = await UserModel.findById(therapistId);
    expect(dbUser?.status).toBe('disabled');
  });

  it('clears refreshTokenHash', async () => {
    // First set a refreshTokenHash
    await UserModel.findByIdAndUpdate(therapistId, {
      refreshTokenHash: 'somehashedtoken',
    });

    const res = await request(app)
      .post(`/v1/admin/users/${therapistId}/disable`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);

    const dbUser = await UserModel.findById(therapistId);
    expect(dbUser?.refreshTokenHash).toBeUndefined();
  });

  it('returns 404 for non-existent user', async () => {
    const fakeId = '000000000000000000000001';
    const res = await request(app)
      .post(`/v1/admin/users/${fakeId}/disable`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 403 for therapist', async () => {
    const res = await request(app)
      .post(`/v1/admin/users/${clientId}/disable`)
      .set('Authorization', `Bearer ${therapistToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});

// ---------------------------------------------------------------------------
// POST /v1/admin/users/:userId/reset-mfa
// ---------------------------------------------------------------------------
describe('POST /v1/admin/users/:userId/reset-mfa', () => {
  it('sets mfaEnabled to false and clears mfaSecret', async () => {
    // First enable MFA on the therapist
    await UserModel.findByIdAndUpdate(therapistId, {
      mfaEnabled: true,
      mfaSecret: 'SOMESECRET',
    });

    const res = await request(app)
      .post(`/v1/admin/users/${therapistId}/reset-mfa`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.mfaEnabled).toBe(false);

    // Verify in DB
    const dbUser = await UserModel.findById(therapistId);
    expect(dbUser?.mfaEnabled).toBe(false);
    expect(dbUser?.mfaSecret).toBeUndefined();
  });

  it('returns 404 for non-existent user', async () => {
    const fakeId = '000000000000000000000001';
    const res = await request(app)
      .post(`/v1/admin/users/${fakeId}/reset-mfa`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 403 for therapist', async () => {
    const res = await request(app)
      .post(`/v1/admin/users/${clientId}/reset-mfa`)
      .set('Authorization', `Bearer ${therapistToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});

// ---------------------------------------------------------------------------
// GET /v1/admin/audit
// ---------------------------------------------------------------------------
describe('GET /v1/admin/audit', () => {
  beforeEach(async () => {
    // Seed some audit events
    await AuditEventModel.create([
      {
        actorUserId: therapistId,
        actorRole: 'therapist',
        actionType: 'plan.publish',
        resourceType: 'treatment_plan',
        resourceId: 'plan_001',
        patientId: 'pat_456',
        correlationId: 'req_abc123',
      },
      {
        actorUserId: therapistId,
        actorRole: 'therapist',
        actionType: 'patient.read',
        resourceType: 'patient',
        resourceId: 'pat_456',
        patientId: 'pat_456',
        correlationId: 'req_def456',
      },
      {
        actorUserId: adminId,
        actorRole: 'admin',
        actionType: 'admin.user_create',
        resourceType: 'user',
        resourceId: 'usr_789',
        correlationId: 'req_ghi789',
      },
    ]);
  });

  it('returns audit events for admin', async () => {
    const res = await request(app)
      .get('/v1/admin/audit')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('items');
    expect(Array.isArray(res.body.items)).toBe(true);
    // At least the 3 seeded + 1 from this request's audit log
    expect(res.body.items.length).toBeGreaterThanOrEqual(3);
    expect(res.body).toHaveProperty('nextCursor');
  });

  it('filters by patientId', async () => {
    const res = await request(app)
      .get('/v1/admin/audit?patientId=pat_456')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(2);
    for (const item of res.body.items) {
      expect(item.patientId).toBe('pat_456');
    }
  });

  it('filters by actorUserId', async () => {
    const res = await request(app)
      .get(`/v1/admin/audit?actorUserId=${therapistId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(2);
    for (const item of res.body.items) {
      expect(item.actorUserId).toBe(therapistId);
    }
  });

  it('filters by actionType', async () => {
    const res = await request(app)
      .get('/v1/admin/audit?actionType=plan.publish')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(1);
    expect(res.body.items[0].actionType).toBe('plan.publish');
  });

  it('filters by from/to timestamps', async () => {
    const from = new Date(Date.now() - 60_000).toISOString(); // 1 minute ago
    const to = new Date(Date.now() + 60_000).toISOString();   // 1 minute from now

    const res = await request(app)
      .get(`/v1/admin/audit?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThanOrEqual(3);
  });

  it('supports pagination', async () => {
    const res = await request(app)
      .get('/v1/admin/audit?limit=2')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.nextCursor).not.toBeNull();

    const res2 = await request(app)
      .get(`/v1/admin/audit?limit=2&cursor=${res.body.nextCursor}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res2.status).toBe(200);
    expect(res2.body.items.length).toBeGreaterThan(0);
  });

  it('returns 403 for therapist', async () => {
    const res = await request(app)
      .get('/v1/admin/audit')
      .set('Authorization', `Bearer ${therapistToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});
