import { TreatmentPlanModel } from '../models/treatment-plan.model.js';
import { ExerciseVersionModel } from '../models/exercise-version.model.js';
import { PatientProfileModel } from '../models/patient-profile.model.js';
import { CompletionEventModel } from '../models/completion-event.model.js';
import { notFound, badRequest, conflict } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

export interface CompletionEntry {
  occurrence: number;
  completed: boolean;
  completedAt: string | null;
}

export interface AssignmentTodayView {
  assignmentKey: string;
  exerciseId: string;
  exerciseVersionId: string;
  exercise: {
    title: string;
    description: string;
    mediaId?: string;
  } | null;
  effectiveParams: Record<string, number>;
  completions: CompletionEntry[];
}

export interface TodayViewResponse {
  dateLocal: string;
  sessionKey: string;
  sessionTitle?: string;
  timesPerDay: number;
  assignments: AssignmentTodayView[];
  overallCompletionRate: number;
}

export interface CompletionResult {
  completionId: string;
  patientId: string;
  dateLocal: string;
  occurrence: number;
  exerciseId: string;
  exerciseVersionId: string;
  completedAt: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

const DATE_LOCAL_RE = /^\d{4}-\d{2}-\d{2}$/;

// ---------------------------------------------------------------------------
// getPatientIdByUserId
// ---------------------------------------------------------------------------

export async function getPatientIdByUserId(userId: string): Promise<string> {
  const profile = await PatientProfileModel.findOne({ userId }).lean();
  if (!profile) throw notFound('Patient profile not found');
  return String(profile._id);
}

// ---------------------------------------------------------------------------
// getTodayView
// Get client's exercise assignments for a specific date merged with completions.
// ---------------------------------------------------------------------------

export async function getTodayView(
  patientId: string,
  dateLocal: string,
): Promise<TodayViewResponse> {
  // Validate dateLocal format
  if (!DATE_LOCAL_RE.test(dateLocal)) {
    throw badRequest('dateLocal must be in YYYY-MM-DD format');
  }

  // Find published plan for this patient
  const plan = await TreatmentPlanModel.findOne({
    patientId,
    status: 'published',
  })
    .sort({ createdAt: -1 })
    .exec();

  if (!plan) {
    throw notFound('No published treatment plan found for this patient');
  }

  // MVP: use the first session (index 0 / sort by index ascending)
  const sortedSessions = [...plan.sessions].sort((a, b) => a.index - b.index);
  const session = sortedSessions[0];

  if (!session) {
    throw notFound('Treatment plan has no sessions');
  }

  const { sessionKey, title: sessionTitle, timesPerDay, assignments } = session;
  const planId = String(plan._id);

  // Batch-fetch all exercise versions used in this session
  const versionIds = assignments.map((a) => a.exerciseVersionId);
  const versions = await ExerciseVersionModel.find({
    _id: { $in: versionIds },
  }).lean();

  const versionMap = new Map<string, (typeof versions)[number]>();
  for (const v of versions) {
    versionMap.set(String(v._id), v);
  }

  // Query all completion events for (patientId, dateLocal) in one shot
  const completionEvents = await CompletionEventModel.find({
    patientId,
    dateLocal,
  }).lean();

  // Build a quick lookup: "exerciseVersionId:occurrence" -> completedAt
  const completionLookup = new Map<string, Date>();
  for (const ev of completionEvents) {
    const key = `${ev.exerciseVersionId}:${ev.occurrence}`;
    completionLookup.set(key, ev.completedAt);
  }

  // Build assignment views
  let totalCompleted = 0;
  const totalSlots = assignments.length * timesPerDay;

  const assignmentViews: AssignmentTodayView[] = assignments.map((assignment) => {
    const version = versionMap.get(assignment.exerciseVersionId);

    // Merge defaultParams with paramsOverride
    const defaultParams = (version?.defaultParams ?? {}) as Record<string, number | undefined>;
    const paramsOverride = (assignment.paramsOverride ?? {}) as Record<string, number | undefined>;
    const effectiveParams: Record<string, number> = {};

    for (const key of ['reps', 'sets', 'seconds'] as const) {
      const val = paramsOverride[key] ?? defaultParams[key];
      if (val !== undefined) {
        effectiveParams[key] = val;
      }
    }

    // Build completions array for occurrences 1..timesPerDay
    const completions: CompletionEntry[] = [];
    for (let occ = 1; occ <= timesPerDay; occ++) {
      const lookupKey = `${assignment.exerciseVersionId}:${occ}`;
      const completedAt = completionLookup.get(lookupKey);
      const completed = completedAt !== undefined;
      if (completed) totalCompleted++;

      completions.push({
        occurrence: occ,
        completed,
        completedAt: completedAt ? completedAt.toISOString() : null,
      });
    }

    const exercise = version
      ? {
          title: version.title,
          description: version.description,
          mediaId: version.mediaId,
        }
      : null;

    return {
      assignmentKey: assignment.assignmentKey,
      exerciseId: assignment.exerciseId,
      exerciseVersionId: assignment.exerciseVersionId,
      exercise,
      effectiveParams,
      completions,
    };
  });

  const overallCompletionRate =
    totalSlots > 0 ? totalCompleted / totalSlots : 0;

  logger.debug('Today view built', {
    patientId,
    dateLocal,
    planId,
    sessionKey,
    totalCompleted,
    totalSlots,
  });

  return {
    dateLocal,
    sessionKey,
    sessionTitle,
    timesPerDay,
    assignments: assignmentViews,
    overallCompletionRate,
  };
}

// ---------------------------------------------------------------------------
// recordCompletion
// Record a single exercise completion for the authenticated client.
// ---------------------------------------------------------------------------

export async function recordCompletion(params: {
  patientId: string;
  dateLocal: string;
  occurrence: number;
  exerciseVersionId: string;
  idempotencyKey: string;
  source?: 'mobile_ios' | 'mobile_android' | 'web';
}): Promise<{ completion: CompletionResult; isIdempotentReturn: boolean }> {
  const { patientId, dateLocal, occurrence, exerciseVersionId, idempotencyKey, source = 'web' } = params;

  // Validate dateLocal format
  if (!DATE_LOCAL_RE.test(dateLocal)) {
    throw badRequest('dateLocal must be in YYYY-MM-DD format');
  }

  // Validate occurrence value
  if (![1, 2, 3].includes(occurrence)) {
    throw badRequest('occurrence must be 1, 2, or 3');
  }

  // Idempotency check: if a completion with this key already exists, return it
  const existingByKey = await CompletionEventModel.findOne({ idempotencyKey }).lean();
  if (existingByKey) {
    logger.debug('Idempotent completion return', { idempotencyKey, patientId });
    return {
      completion: {
        completionId: String(existingByKey._id),
        patientId: existingByKey.patientId,
        dateLocal: existingByKey.dateLocal,
        occurrence: existingByKey.occurrence,
        exerciseId: existingByKey.exerciseId,
        exerciseVersionId: existingByKey.exerciseVersionId,
        completedAt: existingByKey.completedAt.toISOString(),
      },
      isIdempotentReturn: true,
    };
  }

  // Get the published plan for this patient
  const plan = await TreatmentPlanModel.findOne({
    patientId,
    status: 'published',
  })
    .sort({ createdAt: -1 })
    .exec();

  if (!plan) {
    throw notFound('No published treatment plan found for this patient');
  }

  // Find the session and verify the exerciseVersionId exists in plan assignments
  // MVP: use first session (sorted by index)
  const sortedSessions = [...plan.sessions].sort((a, b) => a.index - b.index);
  const session = sortedSessions[0];

  if (!session) {
    throw notFound('Treatment plan has no sessions');
  }

  const matchingAssignment = session.assignments.find(
    (a) => a.exerciseVersionId === exerciseVersionId,
  );

  if (!matchingAssignment) {
    throw badRequest(
      `exerciseVersionId '${exerciseVersionId}' does not exist in the active session's assignments`,
    );
  }

  // Verify occurrence doesn't exceed timesPerDay
  if (occurrence > session.timesPerDay) {
    throw badRequest(
      `occurrence ${occurrence} exceeds timesPerDay (${session.timesPerDay}) for the current session`,
    );
  }

  // Check uniqueness: (patientId, dateLocal, occurrence, exerciseVersionId)
  const existing = await CompletionEventModel.findOne({
    patientId,
    dateLocal,
    occurrence,
    exerciseVersionId,
  }).lean();

  if (existing) {
    throw conflict(
      `Completion already recorded for occurrence ${occurrence} of exerciseVersionId '${exerciseVersionId}' on ${dateLocal}`,
    );
  }

  // Create the completion event
  const planId = String(plan._id);
  const completedAt = new Date();

  const doc = await CompletionEventModel.create({
    patientId,
    planId,
    dateLocal,
    occurrence,
    exerciseId: matchingAssignment.exerciseId,
    exerciseVersionId,
    completedAt,
    source,
    idempotencyKey,
  });

  const completionId = String(doc._id);

  logger.info('Completion recorded', {
    completionId,
    patientId,
    dateLocal,
    occurrence,
    exerciseVersionId,
  });

  return {
    completion: {
      completionId,
      patientId,
      dateLocal,
      occurrence,
      exerciseId: matchingAssignment.exerciseId,
      exerciseVersionId,
      completedAt: completedAt.toISOString(),
    },
    isIdempotentReturn: false,
  };
}

// ---------------------------------------------------------------------------
// listCompletions
// List completions for a patient (therapist/admin view) with cursor pagination.
// ---------------------------------------------------------------------------

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

export async function listCompletions(params: {
  patientId: string;
  dateFrom?: string;
  dateTo?: string;
  occurrence?: number;
  limit: number;
  cursor?: string;
}): Promise<{ items: object[]; nextCursor: string | null }> {
  const { patientId, dateFrom, dateTo, occurrence, cursor } = params;

  const limit = Math.min(
    params.limit > 0 ? params.limit : DEFAULT_LIMIT,
    MAX_LIMIT,
  );

  // Validate optional date filters
  if (dateFrom && !DATE_LOCAL_RE.test(dateFrom)) {
    throw badRequest('dateFrom must be in YYYY-MM-DD format');
  }
  if (dateTo && !DATE_LOCAL_RE.test(dateTo)) {
    throw badRequest('dateTo must be in YYYY-MM-DD format');
  }

  // Build query
  const query: Record<string, unknown> = { patientId };

  if (dateFrom || dateTo) {
    const dateFilter: Record<string, string> = {};
    if (dateFrom) dateFilter['$gte'] = dateFrom;
    if (dateTo) dateFilter['$lte'] = dateTo;
    query['dateLocal'] = dateFilter;
  }

  if (occurrence !== undefined) {
    if (![1, 2, 3].includes(occurrence)) {
      throw badRequest('occurrence must be 1, 2, or 3');
    }
    query['occurrence'] = occurrence;
  }

  // Cursor-based pagination on _id
  if (cursor) {
    const decodedId = decodeCursor(cursor);
    query['_id'] = { $gt: decodedId };
  }

  const docs = await CompletionEventModel.find(query)
    .sort({ _id: 1 })
    .limit(limit + 1)
    .lean();

  const hasMore = docs.length > limit;
  const page = hasMore ? docs.slice(0, limit) : docs;

  const items = page.map((doc) => ({
    completionId: String(doc._id),
    dateLocal: doc.dateLocal,
    occurrence: doc.occurrence,
    exerciseId: doc.exerciseId,
    exerciseVersionId: doc.exerciseVersionId,
    completedAt: doc.completedAt.toISOString(),
  }));

  const nextCursor = hasMore ? encodeCursor(page[page.length - 1]._id) : null;

  return { items, nextCursor };
}
