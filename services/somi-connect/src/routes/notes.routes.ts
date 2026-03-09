/**
 * CRITICAL: Notes are therapist-only PHI.
 * They must NEVER be returned in any client-facing response.
 * Routes here are restricted to therapist and admin roles only.
 */
import { Router, RequestHandler } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { createAuditEvent } from '../middleware/auditLog.js';
import { loadAndAuthorizePatient } from '../services/patient.service.js';
import { NoteModel } from '../models/note.model.js';
import { badRequest } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

export const notesRouter = Router();

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
// POST /v1/clinic/patients/:patientId/notes
// Create a therapist-only note for a patient.
// Roles: therapist (assigned), admin
// ---------------------------------------------------------------------------
const createNoteHandler: RequestHandler = async (req, res, next) => {
  try {
    const { patientId } = req.params;
    const { noteText, planId, sessionKey } = req.body as {
      noteText?: string;
      planId?: string;
      sessionKey?: string;
    };

    await loadAndAuthorizePatient(
      patientId,
      req.userId!,
      req.role as 'therapist' | 'admin',
    );

    if (!noteText?.trim()) {
      throw badRequest('noteText is required and cannot be empty');
    }

    const note = await NoteModel.create({
      patientId,
      authorUserId: req.userId!,
      noteText: noteText.trim(),
      ...(planId != null && { planId }),
      ...(sessionKey != null && { sessionKey }),
    });

    const noteId = String(note._id);

    await createAuditEvent(req, {
      actionType: 'note.create',
      resourceType: 'note',
      resourceId: noteId,
      patientId,
    });

    logger.info('Note created', {
      correlationId: req.correlationId,
      userId: req.userId,
      patientId,
      noteId,
    });

    res.status(201).json(note.toJSON());
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// GET /v1/clinic/patients/:patientId/notes
// List notes for a patient (newest first, cursor pagination).
// Roles: therapist (assigned), admin — clients are NEVER permitted.
// ---------------------------------------------------------------------------
const listNotesHandler: RequestHandler = async (req, res, next) => {
  try {
    const { patientId } = req.params;
    const { limit: limitRaw, cursor } = req.query as Record<string, string | undefined>;

    const limit = limitRaw != null ? parseInt(limitRaw, 10) : DEFAULT_LIMIT;
    if (isNaN(limit) || limit <= 0) {
      res.status(400).json({ message: 'limit must be a positive integer' });
      return;
    }
    const effectiveLimit = Math.min(limit, MAX_LIMIT);

    await loadAndAuthorizePatient(
      patientId,
      req.userId!,
      req.role as 'therapist' | 'admin',
    );

    const query: Record<string, unknown> = { patientId };

    if (cursor) {
      const decodedId = decodeCursor(cursor);
      query['_id'] = { $lt: decodedId };
    }

    const docs = await NoteModel.find(query)
      .sort({ _id: -1 })
      .limit(effectiveLimit + 1)
      .lean();

    const hasMore = docs.length > effectiveLimit;
    const page = hasMore ? docs.slice(0, effectiveLimit) : docs;

    const items = page.map((doc) => ({
      noteId: String(doc._id),
      patientId: doc.patientId,
      authorUserId: doc.authorUserId,
      noteText: doc.noteText,
      planId: doc.planId,
      sessionKey: doc.sessionKey,
      createdAt: doc.createdAt.toISOString(),
    }));

    const nextCursor = hasMore ? encodeCursor(page[page.length - 1]._id) : null;

    await createAuditEvent(req, {
      actionType: 'note.read',
      resourceType: 'note',
      patientId,
    });

    logger.info('Notes listed', {
      correlationId: req.correlationId,
      userId: req.userId,
      patientId,
      count: items.length,
    });

    res.status(200).json({ items, nextCursor });
  } catch (err) {
    next(err);
  }
};

// ---------------------------------------------------------------------------
// Mount routes — therapist/admin only (clients are explicitly excluded)
// ---------------------------------------------------------------------------

notesRouter.post(
  '/:patientId/notes',
  authenticate,
  authorize('therapist', 'admin'),
  createNoteHandler,
);

notesRouter.get(
  '/:patientId/notes',
  authenticate,
  authorize('therapist', 'admin'),
  listNotesHandler,
);
