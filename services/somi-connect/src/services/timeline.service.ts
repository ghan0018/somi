import { CompletionEventModel } from '../models/completion-event.model.js';
import { UploadModel } from '../models/upload.model.js';
import { FeedbackModel } from '../models/feedback.model.js';
import { NoteModel } from '../models/note.model.js';
import { ExerciseVersionModel } from '../models/exercise-version.model.js';
import { badRequest } from '../lib/errors.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TimelineItemType = 'completion' | 'upload' | 'feedback' | 'note';

export interface TimelineItem {
  type: TimelineItemType;
  timestamp: string;
  data: Record<string, unknown>;
}

export interface TimelineResult {
  items: TimelineItem[];
  nextCursor: string | null;
}

const VALID_TYPES: TimelineItemType[] = ['completion', 'upload', 'feedback', 'note'];
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

// ---------------------------------------------------------------------------
// Cursor helpers
// ---------------------------------------------------------------------------

interface CursorPayload {
  ts: string;
}

function encodeCursor(ts: Date): string {
  const payload: CursorPayload = { ts: ts.toISOString() };
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

function decodeCursor(cursor: string): Date {
  try {
    const raw = Buffer.from(cursor, 'base64').toString('utf8');
    const payload = JSON.parse(raw) as CursorPayload;
    if (!payload.ts) throw new Error('missing ts');
    return new Date(payload.ts);
  } catch {
    throw badRequest('Invalid pagination cursor');
  }
}

// ---------------------------------------------------------------------------
// Collection fetchers
// ---------------------------------------------------------------------------

async function fetchCompletions(
  patientId: string,
  before: Date | null,
  limit: number,
): Promise<TimelineItem[]> {
  const filter: Record<string, unknown> = { patientId };
  if (before !== null) {
    filter['completedAt'] = { $lt: before };
  }

  const docs = await CompletionEventModel.find(filter)
    .sort({ completedAt: -1 })
    .limit(limit)
    .lean();

  // Bulk-fetch exercise titles
  const versionIds = [...new Set(docs.map((d) => String(d.exerciseVersionId)))];
  const versions = await ExerciseVersionModel.find({ _id: { $in: versionIds } })
    .select('title')
    .lean();
  const titleMap = new Map<string, string>(
    versions.map((v) => [String(v._id), v.title]),
  );

  return docs.map((doc) => ({
    type: 'completion' as const,
    timestamp: doc.completedAt.toISOString(),
    data: {
      completionId: String(doc._id),
      exerciseTitle: titleMap.get(String(doc.exerciseVersionId)) ?? null,
      occurrence: doc.occurrence,
      dateLocal: doc.dateLocal,
    },
  }));
}

async function fetchUploads(
  patientId: string,
  before: Date | null,
  limit: number,
): Promise<TimelineItem[]> {
  const filter: Record<string, unknown> = { patientId };
  if (before !== null) {
    filter['createdAt'] = { $lt: before };
  }

  const docs = await UploadModel.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return docs.map((doc) => ({
    type: 'upload' as const,
    timestamp: doc.createdAt.toISOString(),
    data: {
      uploadId: String(doc._id),
      purpose: doc.purpose,
      contentType: doc.contentType,
    },
  }));
}

async function fetchFeedback(
  patientId: string,
  before: Date | null,
  limit: number,
): Promise<TimelineItem[]> {
  const filter: Record<string, unknown> = { patientId };
  if (before !== null) {
    filter['createdAt'] = { $lt: before };
  }

  const docs = await FeedbackModel.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return docs.map((doc) => ({
    type: 'feedback' as const,
    timestamp: doc.createdAt.toISOString(),
    data: {
      feedbackId: String(doc._id),
      therapistUserId: doc.therapistUserId,
      text: doc.text,
      uploadId: doc.uploadId ?? null,
    },
  }));
}

async function fetchNotes(
  patientId: string,
  before: Date | null,
  limit: number,
): Promise<TimelineItem[]> {
  const filter: Record<string, unknown> = { patientId };
  if (before !== null) {
    filter['createdAt'] = { $lt: before };
  }

  const docs = await NoteModel.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();

  return docs.map((doc) => ({
    type: 'note' as const,
    timestamp: doc.createdAt.toISOString(),
    data: {
      noteId: String(doc._id),
      authorUserId: doc.authorUserId,
      noteText: doc.noteText,
    },
  }));
}

// ---------------------------------------------------------------------------
// Main service function
// ---------------------------------------------------------------------------

export async function getTimeline(
  patientId: string,
  params: {
    types?: string; // comma-separated
    limit?: number;
    cursor?: string;
  },
): Promise<TimelineResult> {
  // Parse and validate types
  let requestedTypes: TimelineItemType[];
  if (params.types) {
    const parts = params.types.split(',').map((t) => t.trim()) as TimelineItemType[];
    const invalid = parts.filter((t) => !VALID_TYPES.includes(t));
    if (invalid.length > 0) {
      throw badRequest(`Invalid timeline type(s): ${invalid.join(', ')}`);
    }
    requestedTypes = parts;
  } else {
    requestedTypes = [...VALID_TYPES];
  }

  // Parse limit
  const limit = Math.min(
    params.limit != null ? params.limit : DEFAULT_LIMIT,
    MAX_LIMIT,
  );
  if (limit < 1) {
    throw badRequest('limit must be a positive integer');
  }

  // Parse cursor
  const before: Date | null = params.cursor ? decodeCursor(params.cursor) : null;

  // Fetch from each requested collection — fetch limit+1 to allow pagination detection
  const fetchSize = limit + 1;
  const fetches: Promise<TimelineItem[]>[] = [];

  if (requestedTypes.includes('completion')) {
    fetches.push(fetchCompletions(patientId, before, fetchSize));
  }
  if (requestedTypes.includes('upload')) {
    fetches.push(fetchUploads(patientId, before, fetchSize));
  }
  if (requestedTypes.includes('feedback')) {
    fetches.push(fetchFeedback(patientId, before, fetchSize));
  }
  if (requestedTypes.includes('note')) {
    fetches.push(fetchNotes(patientId, before, fetchSize));
  }

  const results = await Promise.all(fetches);
  const merged = results.flat();

  // Sort descending by timestamp
  merged.sort((a, b) => {
    const ta = new Date(a.timestamp).getTime();
    const tb = new Date(b.timestamp).getTime();
    return tb - ta;
  });

  // Apply limit and compute nextCursor
  const page = merged.slice(0, limit);
  const hasMore = merged.length > limit;

  const nextCursor =
    hasMore && page.length > 0
      ? encodeCursor(new Date(page[page.length - 1].timestamp))
      : null;

  return { items: page, nextCursor };
}
