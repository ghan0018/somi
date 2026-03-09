import { UserModel } from '../models/user.model.js';
import { PatientProfileModel } from '../models/patient-profile.model.js';
import { AuditEventModel } from '../models/audit-event.model.js';
import { hashPassword } from './auth.service.js';
import { badRequest, conflict, notFound } from '../lib/errors.js';
import { randomBytes } from 'crypto';
import mongoose from 'mongoose';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function encodeCursor(id: string): string {
  return Buffer.from(id).toString('base64');
}

function decodeCursor(cursor: string): string {
  return Buffer.from(cursor, 'base64').toString('utf-8');
}

function toSafeUser(doc: InstanceType<typeof UserModel>): object {
  const json = doc.toJSON() as Record<string, unknown>;
  // toJSON transform already strips passwordHash, mfaSecret, refreshTokenHash
  return {
    userId: json['userId'],
    role: json['role'],
    email: json['email'],
    status: json['status'],
    mfaEnabled: json['mfaEnabled'],
    createdAt: json['createdAt'],
  };
}

// ---------------------------------------------------------------------------
// listUsers
// ---------------------------------------------------------------------------

export async function listUsers(params: {
  role?: string;
  status?: string;
  limit: number;
  cursor?: string;
}): Promise<{ items: object[]; nextCursor: string | null }> {
  const { role, status, cursor } = params;
  const limit = Math.min(params.limit, 100);

  const filter: Record<string, unknown> = {};

  if (role) {
    filter['role'] = role;
  }

  if (status) {
    filter['status'] = status;
  }

  if (cursor) {
    const decodedId = decodeCursor(cursor);
    filter['_id'] = { $gt: new mongoose.Types.ObjectId(decodedId) };
  }

  const docs = await UserModel.find(filter)
    .sort({ _id: 1 })
    .limit(limit + 1)
    .lean({ virtuals: false });

  const hasMore = docs.length > limit;
  const page = hasMore ? docs.slice(0, limit) : docs;

  // Map to safe objects manually from lean docs
  const items = page.map((doc) => {
    const id = String(doc['_id']);
    return {
      userId: id,
      role: doc['role'],
      email: doc['email'],
      status: doc['status'],
      mfaEnabled: doc['mfaEnabled'],
      createdAt: doc['createdAt'],
    };
  });

  const nextCursor =
    hasMore && page.length > 0
      ? encodeCursor(String(page[page.length - 1]!['_id']))
      : null;

  return { items, nextCursor };
}

// ---------------------------------------------------------------------------
// inviteUser
// ---------------------------------------------------------------------------

export async function inviteUser(params: {
  email: string;
  role: string;
}): Promise<object> {
  const { email, role } = params;

  // Validate email
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    throw badRequest('Valid email is required');
  }

  // Validate role — only therapist or admin, NOT client
  if (!['therapist', 'admin'].includes(role)) {
    throw badRequest('Role must be therapist or admin');
  }

  // Check for duplicate email
  const existing = await UserModel.findOne({ email: email.toLowerCase().trim() });
  if (existing) {
    throw conflict('A user with that email already exists');
  }

  // Generate a random temporary password
  const tempPassword = randomBytes(24).toString('hex');
  const passwordHash = await hashPassword(tempPassword);

  const user = await UserModel.create({
    email: email.toLowerCase().trim(),
    role,
    passwordHash,
    status: 'active',
    mfaEnabled: false,
  });

  // TODO: send invitation email via SES with tempPassword

  return toSafeUser(user);
}

// ---------------------------------------------------------------------------
// disableUser
// ---------------------------------------------------------------------------

export async function disableUser(userId: string): Promise<object> {
  const user = await UserModel.findById(userId);
  if (!user) {
    throw notFound('User not found');
  }

  user.status = 'disabled';
  user.refreshTokenHash = undefined;
  await user.save();

  // Sync linked PatientProfile status if one exists
  await PatientProfileModel.findOneAndUpdate(
    { userId },
    { status: 'inactive' }
  );

  return toSafeUser(user);
}

// ---------------------------------------------------------------------------
// enableUser
// ---------------------------------------------------------------------------

export async function enableUser(userId: string): Promise<object> {
  const user = await UserModel.findById(userId);
  if (!user) {
    throw notFound('User not found');
  }

  if (user.status !== 'disabled') {
    throw badRequest('User is not currently disabled');
  }

  user.status = 'active';
  await user.save();

  // Sync linked PatientProfile status if one exists
  await PatientProfileModel.findOneAndUpdate(
    { userId },
    { status: 'active' }
  );

  return toSafeUser(user);
}

// ---------------------------------------------------------------------------
// resetMfa
// ---------------------------------------------------------------------------

export async function resetMfa(userId: string): Promise<object> {
  const user = await UserModel.findById(userId);
  if (!user) {
    throw notFound('User not found');
  }

  user.mfaEnabled = false;
  user.mfaSecret = undefined;
  await user.save();

  return toSafeUser(user);
}

// ---------------------------------------------------------------------------
// queryAuditEvents
// ---------------------------------------------------------------------------

export async function queryAuditEvents(params: {
  patientId?: string;
  actorUserId?: string;
  actorEmail?: string;
  actionType?: string;
  from?: string;
  to?: string;
  limit: number;
  cursor?: string;
}): Promise<{ items: object[]; nextCursor: string | null }> {
  const { patientId, actorUserId, actorEmail, actionType, from, to, cursor } = params;
  const limit = Math.min(params.limit, 100);

  const filter: Record<string, unknown> = {};

  if (patientId) {
    filter['patientId'] = patientId;
  }

  if (actorUserId) {
    filter['actorUserId'] = actorUserId;
  }

  if (actorEmail) {
    const actorUser = await UserModel.findOne({ email: actorEmail }, { _id: 1 }).lean();
    if (actorUser) {
      filter['actorUserId'] = String(actorUser._id);
    } else {
      // No user matches this email — return empty results
      filter['actorUserId'] = 'nonexistent';
    }
  }

  if (actionType) {
    filter['actionType'] = actionType;
  }

  if (from || to) {
    const dateFilter: Record<string, Date> = {};
    if (from) dateFilter['$gte'] = new Date(from);
    if (to) dateFilter['$lte'] = new Date(to);
    filter['createdAt'] = dateFilter;
  }

  if (cursor) {
    const decodedId = decodeCursor(cursor);
    filter['_id'] = { $lt: new mongoose.Types.ObjectId(decodedId) };
  }

  const docs = await AuditEventModel.find(filter)
    .sort({ _id: -1 })
    .limit(limit + 1)
    .lean({ virtuals: false });

  const hasMore = docs.length > limit;
  const page = hasMore ? docs.slice(0, limit) : docs;

  const items = page.map((doc) => {
    const id = String(doc['_id']);
    return {
      auditId: id,
      actorUserId: doc['actorUserId'],
      actorRole: doc['actorRole'],
      actionType: doc['actionType'],
      resourceType: doc['resourceType'],
      resourceId: doc['resourceId'],
      patientId: doc['patientId'] ?? null,
      createdAt: doc['createdAt'],
    };
  });

  // Batch-lookup actor emails
  const actorIds = [...new Set(items.map((item) => (item as any).actorUserId).filter(Boolean))];
  if (actorIds.length > 0) {
    const users = await UserModel.find(
      { _id: { $in: actorIds.map((id) => new mongoose.Types.ObjectId(id)) } },
      { _id: 1, email: 1 }
    ).lean();
    const emailMap = new Map(users.map((u) => [String(u._id), u.email]));
    for (const item of items) {
      (item as any).actorEmail = emailMap.get((item as any).actorUserId) ?? null;
    }
  }

  const nextCursor =
    hasMore && page.length > 0
      ? encodeCursor(String(page[page.length - 1]!['_id']))
      : null;

  return { items, nextCursor };
}
