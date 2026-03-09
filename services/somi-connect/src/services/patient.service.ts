import crypto from 'crypto';
import { PatientProfileModel } from '../models/patient-profile.model.js';
import { UserModel } from '../models/user.model.js';
import { hashPassword } from './auth.service.js';
import { badRequest, notFound, conflict } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PatientListItem {
  patientId: string;
  displayName: string;
  status: 'active' | 'inactive';
  primaryTherapistId?: string;
  lastActivityAt: string;
  createdAt: string;
}

export interface PatientDetail {
  patientId: string;
  userId: string;
  displayName: string;
  email: string;
  status: 'active' | 'inactive';
  primaryTherapistId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PatientCreateResult {
  patientId: string;
  userId: string;
  displayName: string;
  email: string;
  status: 'active' | 'inactive';
  primaryTherapistId?: string;
  createdAt: string;
}

export interface ListPatientsParams {
  status?: string;
  search?: string;
  limit?: number;
  cursor?: string;
  callerRole: 'therapist' | 'admin';
  callerUserId: string;
}

export interface CreatePatientParams {
  displayName: string;
  email: string;
  primaryTherapistId?: string;
  callerRole: 'therapist' | 'admin';
  callerUserId: string;
}

export interface UpdatePatientParams {
  displayName?: string;
  status?: string;
  primaryTherapistId?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

function decodeCursor(cursor: string): string {
  try {
    return Buffer.from(cursor, 'base64').toString('utf8');
  } catch {
    throw badRequest('Invalid pagination cursor');
  }
}

function encodeCursor(id: unknown): string {
  return Buffer.from(String(id)).toString('base64');
}

// ---------------------------------------------------------------------------
// Service methods
// ---------------------------------------------------------------------------

/**
 * List patients with optional status filtering and cursor-based pagination.
 * All clinic staff (therapist + admin) see all patients.
 */
export async function listPatients(
  params: ListPatientsParams,
): Promise<{ items: PatientListItem[]; nextCursor: string | null }> {
  const rawStatus = params.status ?? 'active';
  if (rawStatus !== 'active' && rawStatus !== 'inactive') {
    throw badRequest('status must be "active" or "inactive"');
  }
  const status = rawStatus as 'active' | 'inactive';

  const limit = Math.min(
    params.limit != null ? params.limit : DEFAULT_LIMIT,
    MAX_LIMIT,
  );

  const query: Record<string, unknown> = { status };

  // Case-insensitive search on displayName
  if (params.search?.trim()) {
    query['displayName'] = { $regex: params.search.trim(), $options: 'i' };
  }

  // Cursor-based pagination
  if (params.cursor) {
    const decodedId = decodeCursor(params.cursor);
    query['_id'] = { $gt: decodedId };
  }

  const docs = await PatientProfileModel.find(query)
    .sort({ _id: 1 })
    .limit(limit + 1)
    .lean();

  const hasMore = docs.length > limit;
  const page = hasMore ? docs.slice(0, limit) : docs;

  const items: PatientListItem[] = page.map((doc) => ({
    patientId: String(doc._id),
    displayName: doc.displayName,
    status: doc.status,
    primaryTherapistId: doc.primaryTherapistId,
    // For MVP, lastActivityAt mirrors updatedAt
    lastActivityAt: doc.updatedAt.toISOString(),
    createdAt: doc.createdAt.toISOString(),
  }));

  const nextCursor = hasMore ? encodeCursor(page[page.length - 1]._id) : null;

  return { items, nextCursor };
}

/**
 * Create a new patient by:
 * 1. Checking for a duplicate email on UserModel.
 * 2. Creating a linked User with role='client'.
 * 3. Creating a PatientProfile linked to that User.
 */
export async function createPatient(
  params: CreatePatientParams,
): Promise<PatientCreateResult> {
  const { displayName, email, callerRole, callerUserId } = params;

  // Validate required fields
  if (!displayName?.trim()) {
    throw badRequest('displayName is required');
  }
  if (!email?.trim()) {
    throw badRequest('email is required');
  }

  const normalizedEmail = email.trim().toLowerCase();

  // Determine primaryTherapistId: if omitted and caller is a therapist, default to caller
  let primaryTherapistId = params.primaryTherapistId;
  if (!primaryTherapistId && callerRole === 'therapist') {
    primaryTherapistId = callerUserId;
  }

  // Check for duplicate email
  const existingUser = await UserModel.findOne({ email: normalizedEmail }).lean();
  if (existingUser) {
    // Check if there's an inactive patient profile linked to this user
    const existingProfile = await PatientProfileModel.findOne({
      userId: String(existingUser._id),
    }).lean();

    if (existingProfile && existingProfile.status === 'inactive') {
      throw conflict('A patient with that email already exists but is inactive', {
        code: 'INACTIVE_PATIENT_EXISTS',
        existingPatientId: String(existingProfile._id),
      });
    }

    throw conflict('A user with that email already exists');
  }

  // Generate and hash a random temporary password
  const tempPassword = crypto.randomBytes(32).toString('hex');
  const passwordHash = await hashPassword(tempPassword);

  // Create the User
  const userDoc = await UserModel.create({
    email: normalizedEmail,
    passwordHash,
    role: 'client',
    status: 'active',
    mfaEnabled: false,
  });

  const userId = String(userDoc._id);

  // Create the PatientProfile
  const profileDoc = await PatientProfileModel.create({
    userId,
    displayName: displayName.trim(),
    status: 'active',
    primaryTherapistId,
    clinicId: 'default_clinic',
  });

  const patientId = String(profileDoc._id);

  logger.info('Patient created', { patientId, userId });

  return {
    patientId,
    userId,
    displayName: profileDoc.displayName,
    email: normalizedEmail,
    status: profileDoc.status,
    primaryTherapistId: profileDoc.primaryTherapistId,
    createdAt: profileDoc.createdAt.toISOString(),
  };
}

/**
 * Get a single patient's profile joined with their User email.
 * Access control (therapist scope) is enforced by the route-level
 * checkPatientAccess middleware before this function is called.
 */
export async function getPatientById(patientId: string): Promise<PatientDetail> {
  const profileDoc = await PatientProfileModel.findById(patientId).lean();
  if (!profileDoc) {
    throw notFound(`Patient '${patientId}' not found`);
  }

  const userDoc = await UserModel.findById(profileDoc.userId).lean();
  if (!userDoc) {
    logger.warn('Patient profile exists but linked user is missing', {
      patientId,
      userId: profileDoc.userId,
    });
    throw notFound(`User record for patient '${patientId}' not found`);
  }

  return {
    patientId: String(profileDoc._id),
    userId: String(userDoc._id),
    displayName: profileDoc.displayName,
    email: userDoc.email,
    status: profileDoc.status,
    primaryTherapistId: profileDoc.primaryTherapistId,
    createdAt: profileDoc.createdAt.toISOString(),
    updatedAt: profileDoc.updatedAt.toISOString(),
  };
}

/**
 * Update allowed patient profile fields: displayName, status, primaryTherapistId.
 * Access control is enforced upstream by checkPatientAccess middleware.
 */
export async function updatePatient(
  patientId: string,
  params: UpdatePatientParams,
): Promise<PatientDetail> {
  const { displayName, status, primaryTherapistId } = params;

  // Validate that at least one field is provided
  if (
    displayName === undefined &&
    status === undefined &&
    primaryTherapistId === undefined
  ) {
    throw badRequest('At least one field must be provided for update');
  }

  // Validate status value if provided
  if (status !== undefined && status !== 'active' && status !== 'inactive') {
    throw badRequest('status must be "active" or "inactive"');
  }

  const profileDoc = await PatientProfileModel.findById(patientId);
  if (!profileDoc) {
    throw notFound(`Patient '${patientId}' not found`);
  }

  if (displayName !== undefined) {
    if (!displayName.trim()) {
      throw badRequest('displayName cannot be empty');
    }
    profileDoc.displayName = displayName.trim();
  }

  if (status !== undefined) {
    profileDoc.status = status as 'active' | 'inactive';
  }

  if (primaryTherapistId !== undefined) {
    profileDoc.primaryTherapistId = primaryTherapistId;
  }

  await profileDoc.save();

  logger.info('Patient updated', { patientId });

  return getPatientById(patientId);
}

/**
 * Load a PatientProfile by patientId.
 * Returns the profile document if found.
 *
 * Throws 404 if not found.
 * Note: All clinic staff (therapist + admin) can view any patient in the clinic.
 * Per-patient write restrictions will be added with treatment plan scoping.
 */
export async function loadAndAuthorizePatient(
  patientId: string,
  _callerUserId: string,
  _callerRole: 'therapist' | 'admin',
) {
  const profileDoc = await PatientProfileModel.findById(patientId).lean();
  if (!profileDoc) {
    throw notFound(`Patient '${patientId}' not found`);
  }

  return profileDoc;
}
