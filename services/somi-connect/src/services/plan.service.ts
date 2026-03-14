import { TreatmentPlanModel, TreatmentPlanDocument, ISession, IAssignment } from '../models/treatment-plan.model.js';
import { ExerciseModel } from '../models/exercise.model.js';
import { ExerciseVersionModel } from '../models/exercise-version.model.js';
import { PatientProfileModel } from '../models/patient-profile.model.js';
import { notFound, unprocessable, badRequest } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface AssignmentInput {
  exerciseId: string;
  paramsOverride?: {
    reps?: number;
    sets?: number;
    seconds?: number;
  };
}

export interface SessionInput {
  title?: string;
  sessionNotes?: string;
  notesForTherapistOnly?: string;
  timesPerDay: number;
  assignments: AssignmentInput[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function padIndex(n: number): string {
  return String(n + 1).padStart(2, '0');
}

// ---------------------------------------------------------------------------
// resolveSessions
// Resolve exerciseVersionIds and generate keys for sessions/assignments.
// ---------------------------------------------------------------------------

export async function resolveSessions(inputSessions: SessionInput[]): Promise<ISession[]> {
  const sessions: ISession[] = [];

  for (let sIdx = 0; sIdx < inputSessions.length; sIdx++) {
    const input = inputSessions[sIdx];

    if (!input.assignments || input.assignments.length === 0) {
      throw badRequest(`Session at index ${sIdx} must have at least one assignment`);
    }

    const assignments: IAssignment[] = [];

    for (let aIdx = 0; aIdx < input.assignments.length; aIdx++) {
      const aInput = input.assignments[aIdx];

      if (!aInput.exerciseId) {
        throw badRequest(`Assignment at session ${sIdx}, index ${aIdx} is missing exerciseId`);
      }

      const exercise = await ExerciseModel.findById(aInput.exerciseId).lean();
      if (!exercise) {
        throw notFound(`Exercise '${aInput.exerciseId}' not found`);
      }

      assignments.push({
        assignmentKey: `asgn_${padIndex(aIdx)}`,
        exerciseId: aInput.exerciseId,
        exerciseVersionId: exercise.currentVersionId,
        index: aIdx,
        paramsOverride: aInput.paramsOverride,
      });
    }

    // Validate timesPerDay
    if (![1, 2, 3].includes(input.timesPerDay)) {
      throw badRequest(`Session at index ${sIdx} has invalid timesPerDay (must be 1, 2, or 3)`);
    }

    sessions.push({
      sessionKey: `sess_${padIndex(sIdx)}`,
      index: sIdx,
      title: input.title,
      sessionNotes: input.sessionNotes,
      notesForTherapistOnly: input.notesForTherapistOnly,
      timesPerDay: input.timesPerDay,
      assignments,
    });
  }

  return sessions;
}

// ---------------------------------------------------------------------------
// enrichPlan
// Enrich a plan with exercise snapshots and effectiveParams.
// stripTherapistNotes: true for client view, false for therapist view.
// ---------------------------------------------------------------------------

export async function enrichPlan(
  plan: TreatmentPlanDocument,
  stripTherapistNotes: boolean,
): Promise<object> {
  const plainPlan = plan.toJSON() as Record<string, unknown>;

  // Collect all unique exerciseVersionIds across all sessions
  const versionIds = new Set<string>();
  for (const session of plan.sessions) {
    for (const assignment of session.assignments) {
      versionIds.add(assignment.exerciseVersionId);
    }
  }

  // Batch-load all exercise versions
  const versions = await ExerciseVersionModel.find({
    _id: { $in: Array.from(versionIds) },
  }).lean();

  const versionMap = new Map<string, typeof versions[number]>();
  for (const v of versions) {
    versionMap.set(String(v._id), v);
  }

  // Build enriched sessions
  const enrichedSessions = plan.sessions.map((session) => {
    const sessionObj: Record<string, unknown> = {
      sessionKey: session.sessionKey,
      index: session.index,
      title: session.title,
      sessionNotes: session.sessionNotes,
      timesPerDay: session.timesPerDay,
    };

    if (!stripTherapistNotes) {
      sessionObj['notesForTherapistOnly'] = session.notesForTherapistOnly;
    }

    sessionObj['assignments'] = session.assignments.map((assignment) => {
      const version = versionMap.get(assignment.exerciseVersionId);

      const defaultParams = version?.defaultParams ?? {};
      const paramsOverride = assignment.paramsOverride ?? {};
      const effectiveParams: Record<string, number> = {};

      for (const key of ['reps', 'sets', 'seconds'] as const) {
        const val = paramsOverride[key] ?? (defaultParams as Record<string, number | undefined>)[key];
        if (val !== undefined) {
          effectiveParams[key] = val;
        }
      }

      const exerciseSnapshot = version
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
        index: assignment.index,
        paramsOverride: assignment.paramsOverride,
        exercise: exerciseSnapshot,
        effectiveParams,
      };
    });

    return sessionObj;
  });

  return {
    ...plainPlan,
    sessions: enrichedSessions,
  };
}

// ---------------------------------------------------------------------------
// createPlan
// ---------------------------------------------------------------------------

export async function createPlan(
  patientId: string,
  inputSessions: SessionInput[],
): Promise<object> {
  if (!inputSessions || inputSessions.length === 0) {
    throw badRequest('sessions array must not be empty');
  }

  const sessions = await resolveSessions(inputSessions);

  const plan = await TreatmentPlanModel.create({
    patientId,
    status: 'draft',
    remindersEnabled: false,
    sessions,
  });

  logger.info('Treatment plan created', { planId: String(plan._id), patientId });

  return plan.toJSON();
}

// ---------------------------------------------------------------------------
// replacePlan
// Replace the full sessions content of a draft plan.
// ---------------------------------------------------------------------------

export async function replacePlan(
  planId: string,
  inputSessions: SessionInput[],
): Promise<object> {
  if (!inputSessions || inputSessions.length === 0) {
    throw badRequest('sessions array must not be empty');
  }

  const plan = await TreatmentPlanModel.findById(planId);
  if (!plan) {
    throw notFound(`Treatment plan '${planId}' not found`);
  }

  if (plan.status !== 'draft') {
    throw unprocessable('Only draft plans can be updated. Archive this plan and create a new one if needed.');
  }

  const sessions = await resolveSessions(inputSessions);
  plan.sessions = sessions;
  await plan.save();

  logger.info('Treatment plan replaced', { planId, status: plan.status });

  return plan.toJSON();
}

// ---------------------------------------------------------------------------
// publishPlan
// ---------------------------------------------------------------------------

export async function publishPlan(planId: string, userId: string): Promise<object> {
  const plan = await TreatmentPlanModel.findById(planId);
  if (!plan) {
    throw notFound(`Treatment plan '${planId}' not found`);
  }

  if (plan.status !== 'draft') {
    throw unprocessable(`Plan is already '${plan.status}' and cannot be published`);
  }

  if (plan.sessions.length === 0 || plan.sessions.every((s) => s.assignments.length === 0)) {
    throw unprocessable('Plan must have at least one session with at least one assignment before publishing');
  }

  plan.status = 'published';
  plan.publishedAt = new Date();
  plan.publishedBy = userId;
  await plan.save();

  logger.info('Treatment plan published', { planId, publishedBy: userId });

  return plan.toJSON();
}

// ---------------------------------------------------------------------------
// archivePlan
// ---------------------------------------------------------------------------

export async function archivePlan(planId: string): Promise<object> {
  const plan = await TreatmentPlanModel.findById(planId);
  if (!plan) {
    throw notFound(`Treatment plan '${planId}' not found`);
  }

  plan.status = 'archived';
  await plan.save();

  logger.info('Treatment plan archived', { planId });

  return plan.toJSON();
}

// ---------------------------------------------------------------------------
// updatePlanSettings
// ---------------------------------------------------------------------------

export async function updatePlanSettings(
  planId: string,
  settings: { remindersEnabled?: boolean },
): Promise<object> {
  const plan = await TreatmentPlanModel.findById(planId);
  if (!plan) {
    throw notFound(`Treatment plan '${planId}' not found`);
  }

  if (settings.remindersEnabled !== undefined) {
    plan.remindersEnabled = settings.remindersEnabled;
  }

  await plan.save();

  logger.info('Treatment plan settings updated', { planId });

  return plan.toJSON();
}

// ---------------------------------------------------------------------------
// getTherapistPlan
// Get the most recent plan for a patient (therapist view — includes PHI notes).
// ---------------------------------------------------------------------------

export async function getTherapistPlan(patientId: string): Promise<object | null> {
  const plan = await TreatmentPlanModel.findOne({ patientId })
    .sort({ createdAt: -1 })
    .exec();

  if (!plan) {
    return null;
  }

  return enrichPlan(plan, false /* keep therapist notes */);
}

// ---------------------------------------------------------------------------
// getClientPlan
// Get the published plan for a patient (client view — strips PHI notes).
// ---------------------------------------------------------------------------

export async function getClientPlan(patientId: string): Promise<object | null> {
  const plan = await TreatmentPlanModel.findOne({ patientId, status: 'published' })
    .sort({ createdAt: -1 })
    .exec();

  if (!plan) {
    return null;
  }

  return enrichPlan(plan, true /* strip therapist notes */);
}

// ---------------------------------------------------------------------------
// getPlanById
// Load a plan by its ID and verify it belongs to the given patientId.
// ---------------------------------------------------------------------------

export async function getPlanById(
  planId: string,
  patientId: string,
): Promise<TreatmentPlanDocument> {
  const plan = await TreatmentPlanModel.findById(planId);
  if (!plan) {
    throw notFound(`Treatment plan '${planId}' not found`);
  }

  if (plan.patientId !== patientId) {
    throw notFound(`Treatment plan '${planId}' not found for this patient`);
  }

  return plan;
}

// ---------------------------------------------------------------------------
// getPatientIdByUserId
// Resolve a userId to a patientId via PatientProfile.
// ---------------------------------------------------------------------------

export async function getPatientIdByUserId(userId: string): Promise<string> {
  const profile = await PatientProfileModel.findOne({ userId }).lean();
  if (!profile) {
    throw notFound('No patient profile found for this user');
  }
  return String(profile._id);
}
