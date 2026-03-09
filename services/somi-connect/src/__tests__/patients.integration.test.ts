/**
 * patients.integration.test.ts — Integration tests for patient endpoints.
 *
 * Uses supertest to hit the real Express app backed by MongoDB Memory Server.
 * DB is cleared and re-seeded before each test.
 */

import request from 'supertest';
import { startDb, stopDb, clearDb } from './setup.js';
import { createApp } from '../app.js';
import { UserModel } from '../models/user.model.js';
import { PatientProfileModel } from '../models/patient-profile.model.js';
import { hashPassword, signAccessToken } from '../services/auth.service.js';

const app = createApp();

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let therapistId: string;
let therapistToken: string;
let otherTherapistId: string;
let otherTherapistToken: string;
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

  const otherTherapistHash = await hashPassword('OtherTherapistPass123!');
  const otherTherapist = await UserModel.create({
    email: 'other.therapist@example.com',
    passwordHash: otherTherapistHash,
    role: 'therapist',
    status: 'active',
    mfaEnabled: false,
  });
  otherTherapistId = otherTherapist._id.toString();
  otherTherapistToken = getAccessToken(otherTherapistId, 'therapist');

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

async function createPatientViaApi(
  token: string,
  overrides: Record<string, unknown> = {},
): Promise<{ patientId: string; userId: string }> {
  const uniqueSuffix = Math.random().toString(36).slice(2, 9);
  const body = {
    displayName: 'Test Patient',
    email: `patient-${uniqueSuffix}@example.com`,
    ...overrides,
  };
  const res = await request(app)
    .post('/v1/clinic/patients')
    .set('Authorization', `Bearer ${token}`)
    .send(body);
  return { patientId: res.body.patientId as string, userId: res.body.userId as string };
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
}, 15_000);

// ---------------------------------------------------------------------------
// POST /v1/clinic/patients
// ---------------------------------------------------------------------------
describe('POST /v1/clinic/patients', () => {
  it('returns 201 with patient object for therapist', async () => {
    const res = await request(app)
      .post('/v1/clinic/patients')
      .set('Authorization', `Bearer ${therapistToken}`)
      .send({ displayName: 'Alice Smith', email: 'alice@example.com' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('patientId');
    expect(res.body).toHaveProperty('userId');
    expect(res.body).toMatchObject({
      displayName: 'Alice Smith',
      email: 'alice@example.com',
      status: 'active',
    });
  });

  it('creates a linked User with role=client', async () => {
    const res = await request(app)
      .post('/v1/clinic/patients')
      .set('Authorization', `Bearer ${therapistToken}`)
      .send({ displayName: 'Bob Jones', email: 'bob@example.com' });

    expect(res.status).toBe(201);
    const userId = res.body.userId as string;

    const userDoc = await UserModel.findById(userId).lean();
    expect(userDoc).not.toBeNull();
    expect(userDoc!.role).toBe('client');
    expect(userDoc!.email).toBe('bob@example.com');
  });

  it('returns 409 for duplicate email', async () => {
    await request(app)
      .post('/v1/clinic/patients')
      .set('Authorization', `Bearer ${therapistToken}`)
      .send({ displayName: 'First Patient', email: 'duplicate@example.com' });

    const res = await request(app)
      .post('/v1/clinic/patients')
      .set('Authorization', `Bearer ${therapistToken}`)
      .send({ displayName: 'Second Patient', email: 'duplicate@example.com' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('returns 403 for client role', async () => {
    const res = await request(app)
      .post('/v1/clinic/patients')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({ displayName: 'Unauthorized', email: 'unauthorized@example.com' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('defaults primaryTherapistId to calling therapist when omitted', async () => {
    const res = await request(app)
      .post('/v1/clinic/patients')
      .set('Authorization', `Bearer ${therapistToken}`)
      .send({ displayName: 'Charlie Brown', email: 'charlie@example.com' });

    expect(res.status).toBe(201);
    expect(res.body.primaryTherapistId).toBe(therapistId);
  });

  it('accepts explicit primaryTherapistId when provided', async () => {
    const res = await request(app)
      .post('/v1/clinic/patients')
      .set('Authorization', `Bearer ${therapistToken}`)
      .send({
        displayName: 'Dana White',
        email: 'dana@example.com',
        primaryTherapistId: otherTherapistId,
      });

    expect(res.status).toBe(201);
    expect(res.body.primaryTherapistId).toBe(otherTherapistId);
  });
});

// ---------------------------------------------------------------------------
// GET /v1/clinic/patients
// ---------------------------------------------------------------------------
describe('GET /v1/clinic/patients', () => {
  beforeEach(async () => {
    // Create two patients assigned to therapist, one to other therapist
    await createPatientViaApi(therapistToken, { displayName: 'Patient A', email: 'patient-a@example.com' });
    await createPatientViaApi(therapistToken, { displayName: 'Patient B', email: 'patient-b@example.com' });
    await createPatientViaApi(otherTherapistToken, { displayName: 'Patient C', email: 'patient-c@example.com' });
  });

  it('therapist sees all patients in the clinic', async () => {
    const res = await request(app)
      .get('/v1/clinic/patients')
      .set('Authorization', `Bearer ${therapistToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('items');
    const names = res.body.items.map((p: { displayName: string }) => p.displayName);
    expect(names).toContain('Patient A');
    expect(names).toContain('Patient B');
    expect(names).toContain('Patient C');
  });

  it('admin sees all patients', async () => {
    const res = await request(app)
      .get('/v1/clinic/patients')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThanOrEqual(3);
    const names = res.body.items.map((p: { displayName: string }) => p.displayName);
    expect(names).toContain('Patient A');
    expect(names).toContain('Patient B');
    expect(names).toContain('Patient C');
  });

  it('filters by status (inactive)', async () => {
    // Mark one patient as inactive
    const profileDocs = await PatientProfileModel.find({
      primaryTherapistId: therapistId,
    }).lean();
    if (profileDocs.length > 0) {
      await PatientProfileModel.findByIdAndUpdate(profileDocs[0]._id, { status: 'inactive' });
    }

    const res = await request(app)
      .get('/v1/clinic/patients?status=inactive')
      .set('Authorization', `Bearer ${therapistToken}`);

    expect(res.status).toBe(200);
    const statuses = res.body.items.map((p: { status: string }) => p.status);
    for (const s of statuses) {
      expect(s).toBe('inactive');
    }
  });
});

// ---------------------------------------------------------------------------
// GET /v1/clinic/patients/:patientId
// ---------------------------------------------------------------------------
describe('GET /v1/clinic/patients/:patientId', () => {
  let myPatientId: string;
  let otherPatientId: string;

  beforeEach(async () => {
    const mine = await createPatientViaApi(therapistToken, {
      displayName: 'My Patient',
      email: 'my-patient@example.com',
    });
    myPatientId = mine.patientId;

    const other = await createPatientViaApi(otherTherapistToken, {
      displayName: 'Other Patient',
      email: 'other-patient@example.com',
    });
    otherPatientId = other.patientId;
  });

  it('therapist can see their assigned patient', async () => {
    const res = await request(app)
      .get(`/v1/clinic/patients/${myPatientId}`)
      .set('Authorization', `Bearer ${therapistToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      patientId: myPatientId,
      displayName: 'My Patient',
    });
    expect(res.body).toHaveProperty('email');
    expect(res.body).toHaveProperty('userId');
  });

  it('therapist can see any patient in the clinic', async () => {
    const res = await request(app)
      .get(`/v1/clinic/patients/${otherPatientId}`)
      .set('Authorization', `Bearer ${therapistToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      patientId: otherPatientId,
      displayName: 'Other Patient',
    });
  });

  it('admin can see any patient', async () => {
    const resOwn = await request(app)
      .get(`/v1/clinic/patients/${myPatientId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(resOwn.status).toBe(200);

    const resOther = await request(app)
      .get(`/v1/clinic/patients/${otherPatientId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(resOther.status).toBe(200);
  });

  it('returns 404 for non-existent patientId', async () => {
    const fakeId = '000000000000000000000001';
    const res = await request(app)
      .get(`/v1/clinic/patients/${fakeId}`)
      .set('Authorization', `Bearer ${therapistToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

// ---------------------------------------------------------------------------
// PATCH /v1/clinic/patients/:patientId
// ---------------------------------------------------------------------------
describe('PATCH /v1/clinic/patients/:patientId', () => {
  let myPatientId: string;
  let otherPatientId: string;

  beforeEach(async () => {
    const mine = await createPatientViaApi(therapistToken, {
      displayName: 'Original Name',
      email: 'patch-patient@example.com',
    });
    myPatientId = mine.patientId;

    const other = await createPatientViaApi(otherTherapistToken, {
      displayName: 'Other Name',
      email: 'patch-other@example.com',
    });
    otherPatientId = other.patientId;
  });

  it('updates displayName', async () => {
    const res = await request(app)
      .patch(`/v1/clinic/patients/${myPatientId}`)
      .set('Authorization', `Bearer ${therapistToken}`)
      .send({ displayName: 'Updated Name' });

    expect(res.status).toBe(200);
    expect(res.body.displayName).toBe('Updated Name');
  });

  it('updates status', async () => {
    const res = await request(app)
      .patch(`/v1/clinic/patients/${myPatientId}`)
      .set('Authorization', `Bearer ${therapistToken}`)
      .send({ status: 'inactive' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('inactive');
  });

  it('updates primaryTherapistId', async () => {
    const res = await request(app)
      .patch(`/v1/clinic/patients/${myPatientId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ primaryTherapistId: otherTherapistId });

    expect(res.status).toBe(200);
    expect(res.body.primaryTherapistId).toBe(otherTherapistId);
  });

  it('therapist can update any patient in the clinic', async () => {
    const res = await request(app)
      .patch(`/v1/clinic/patients/${otherPatientId}`)
      .set('Authorization', `Bearer ${therapistToken}`)
      .send({ displayName: 'Cross-Therapist Update' });

    expect(res.status).toBe(200);
    expect(res.body.displayName).toBe('Cross-Therapist Update');
  });
});
