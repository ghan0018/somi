// ============================================================================
// Auth
// ============================================================================

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
}

export interface MfaChallengeResponse {
  challengeId: string;
  mfaRequired: true;
}

export interface User {
  userId: string;
  email: string;
  role: 'client' | 'therapist' | 'admin';
  status: 'active' | 'disabled';
  mfaEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Pagination
// ============================================================================

export interface PaginatedResponse<T> {
  items: T[];
  nextCursor: string | null;
}

// ============================================================================
// Patient
// ============================================================================

export interface Patient {
  patientId: string;
  userId: string;
  displayName: string;
  status: 'active' | 'inactive';
  primaryTherapistId?: string;
  clinicId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePatientParams {
  email: string;
  displayName: string;
  primaryTherapistId?: string;
}

export interface UpdatePatientParams {
  displayName?: string;
  status?: 'active' | 'inactive';
  primaryTherapistId?: string;
}

// ============================================================================
// Exercise
// ============================================================================

export interface ExerciseVersion {
  exerciseVersionId: string;
  exerciseId: string;
  title: string;
  description: string;
  tags: { tagId: string; label: string }[];
  mediaId?: string;
  defaultParams: {
    reps?: number;
    sets?: number;
    seconds?: number;
  };
  createdByUserId: string;
  createdAt: string;
}

export interface Exercise {
  exerciseId: string;
  currentVersionId: string;
  title: string;
  description: string;
  tags: { tagId: string; label: string }[];
  mediaId?: string;
  defaultParams: {
    reps?: number;
    sets?: number;
    seconds?: number;
  };
  archivedAt?: string | null;
  createdByUserId?: string;
  createdAt: string;
  updatedAt?: string;
  versions?: { exerciseVersionId: string; createdAt: string }[];
}

export interface CreateExerciseParams {
  title: string;
  description: string;
  tagIds?: string[];
  defaultParams?: {
    reps?: number;
    sets?: number;
    seconds?: number;
  };
  mediaId?: string;
}

export interface UpdateExerciseParams {
  title?: string;
  description?: string;
  tagIds?: string[];
  defaultParams?: {
    reps?: number;
    sets?: number;
    seconds?: number;
  };
  mediaId?: string;
}

// ============================================================================
// Treatment Plan
// ============================================================================

export interface Assignment {
  assignmentKey: string;
  exerciseId: string;
  exerciseVersionId: string;
  index: number;
  paramsOverride?: {
    reps?: number;
    sets?: number;
    seconds?: number;
  };
  exercise?: ExerciseVersion;
  /** Merged defaults + overrides — returned by the enrichPlan endpoint */
  effectiveParams?: {
    reps?: number;
    sets?: number;
    seconds?: number;
  };
}

export interface Session {
  sessionKey: string;
  index: number;
  title?: string;
  sessionNotes?: string;
  timesPerDay: 1 | 2 | 3;
  assignments: Assignment[];
}

export interface TreatmentPlan {
  planId: string;
  patientId: string;
  status: 'draft' | 'published' | 'archived';
  remindersEnabled: boolean;
  activeSessionIndex?: number;
  publishedAt?: string;
  publishedBy?: string;
  sessions: Session[];
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Plan Input Types (used when creating/updating plans)
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
  timesPerDay: number;
  assignments: AssignmentInput[];
}

// ============================================================================
// Completions
// ============================================================================

export interface CompletionEvent {
  completionId: string;
  patientId: string;
  planId: string;
  dateLocal: string;
  occurrence: 1 | 2 | 3;
  exerciseId: string;
  exerciseVersionId: string;
  completedAt: string;
  source: 'mobile_ios' | 'mobile_android' | 'web';
}

export interface TodayAssignment {
  assignmentKey: string;
  exerciseVersionId: string;
  exercise: ExerciseVersion;
  paramsOverride?: {
    reps?: number;
    sets?: number;
    seconds?: number;
  };
  completions: {
    occurrence: number;
    completedAt: string;
  }[];
}

export interface TodaySession {
  sessionKey: string;
  title?: string;
  timesPerDay: number;
  assignments: TodayAssignment[];
}

export interface TodayViewResponse {
  planId: string;
  dateLocal: string;
  sessions: TodaySession[];
}

// ============================================================================
// Adherence
// ============================================================================

export interface DayAdherence {
  date: string;
  assigned: number;
  completed: number;
}

export interface WeeklyAdherenceResult {
  patientId: string;
  weekStart: string;
  days: DayAdherence[];
}

export interface OverallAdherenceResult {
  patientId: string;
  totalAssigned: number;
  totalCompleted: number;
  rate: number;
  activeSinceDays: number;
}

// ============================================================================
// Timeline
// ============================================================================

export interface TimelineItem {
  type: 'completion' | 'upload' | 'feedback' | 'note';
  id: string;
  timestamp: string;
  data: Record<string, unknown>;
}

export interface TimelineResult {
  items: TimelineItem[];
  nextCursor: string | null;
}

// ============================================================================
// Messaging
// ============================================================================

export interface MessageThread {
  threadId: string;
  patientId: string;
  therapistUserId: string;
  status: 'active' | 'archived';
  lastMessageAt?: string;
  createdAt: string;
}

export interface Message {
  messageId: string;
  threadId: string;
  senderUserId: string;
  senderRole: 'client' | 'therapist' | 'admin';
  text: string;
  attachments: {
    uploadId: string;
    contentType: string;
    purpose: string;
  }[];
  createdAt: string;
}

// ============================================================================
// Feedback
// ============================================================================

export interface Feedback {
  feedbackId: string;
  patientId: string;
  therapistUserId: string;
  text: string;
  uploadId?: string;
  feedbackMediaUploadId?: string;
  createdAt: string;
}

// ============================================================================
// Notes
// ============================================================================

export interface Note {
  noteId: string;
  patientId: string;
  authorUserId: string;
  noteText: string;
  planId?: string;
  sessionKey?: string;
  createdAt: string;
}

// ============================================================================
// Uploads
// ============================================================================

export interface Upload {
  uploadId: string;
  uploadUrl: string;
}

export interface UploadAccess {
  accessUrl: string;
}

// ============================================================================
// Taxonomy
// ============================================================================

export interface TaxonomyTag {
  tagId: string;
  category: 'function' | 'structure' | 'age';
  label: string;
  createdAt: string;
  inUse?: boolean;
}

// ============================================================================
// Admin
// ============================================================================

export interface AuditEvent {
  auditId: string;
  actorUserId: string;
  actorEmail?: string;
  actorRole: string;
  actionType: string;
  resourceType: string;
  resourceId: string;
  patientId?: string;
  ip?: string;
  createdAt: string;
}

// ============================================================================
// Error
// ============================================================================

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}
