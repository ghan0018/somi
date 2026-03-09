# 03 – Data Model & Security Requirements (SOMI Treatment)

> **Scope**
> Defines the data model (conceptual + Mongo-oriented) and security requirements for:
> - **SOMI Home** (iOS & Android client apps)
> - **SOMI Clinic** (Therapist/Admin web app)
> - **SOMI Connect** (REST backend)
>
> This document defines authoritative entities, relationships, PHI classification, and security controls.
> Deep REST payload details belong in the REST API design doc.

---

## 0. Guiding Principles

- **Minimize PHI**: store the minimum necessary to deliver treatment workflows.
- **Server-authoritative access**: all authorization is enforced by **SOMI Connect**.
- **Audit by default** for PHI read/write and administrative changes.
- **Version immutable content** that affects historical correctness (exercise definitions + media).
- **Embed plan structure** for MVP to minimize join complexity.
- **Measure performance** (Datadog) for any endpoint that must aggregate across collections.

---

## 1. Data Classification (PHI vs Non-PHI)

### 1.1 PHI
PHI includes any patient-identifying information and any patient-scoped treatment/progress/communications, including:
- Patient identity and contact info (name/email/phone if collected)
- Patient ↔ therapist relationship and case status
- Treatment plans and assigned exercises for a patient
- Exercise completion events (routine completion status by date/time)
- Patient practice uploads and therapist feedback
- Messages (content and metadata) between patient and therapist
- Therapist notes / meeting notes (therapist-only)
- Audit logs referencing PHI resources

### 1.2 Non-PHI
- Generic exercise library content intended for broad reuse (exercise title/description/VOD demo)
- Taxonomy (Function/Structure/Age)
- Feature flags, app configuration
- Operational metrics with no identifying fields

> **Rule:** Treat all **patient-scoped** data as PHI.

---

## 2. Storage Layout & Separation

### 2.1 MongoDB (structured data)
MongoDB stores:
- users and authentication state (non-exportable sensitive fields)
- patients + case status + therapist relationships
- exercise library (exercise + versions)
- patient treatment plans (embedded structure)
- completion events
- messages and message metadata
- uploads metadata (pointers to object storage)
- therapist feedback and therapist-only notes
- audit events

### 2.2 Object Storage (media)
All media is stored encrypted at rest and served over TLS, using short-lived signed URLs.

Logical separation (recommended):
- **Library Media (Non-PHI):** exercise VOD demos
- **Patient Media (PHI):** patient uploads, photos, and therapist video feedback

### 2.3 Logging/Telemetry (Datadog)
- **No PHI in logs**
- Logs are structured and use opaque IDs + correlation IDs
- Do not log request bodies for PHI endpoints
- Add endpoint-level metrics for aggregation-heavy reads (timeline, adherence)

---

## 3. Core Entities (Authoritative Data Model)

> IDs are opaque identifiers. The “entity” definitions below do not necessarily imply separate Mongo collections.
> Storage strategy is described explicitly (not assumed).

### 3.1 User
Represents any authenticated person.

**Fields (conceptual)**
- `userId`
- `role`: `client` | `therapist` | `admin`
- `email` (unique)
- `mfaEnabled`, `mfaMethods`
- `status`: `active` | `disabled`
- `createdAt`, `updatedAt`
- password hashes / MFA secrets stored securely and never exposed.

### 3.2 Patient Profile (Client)
Represents a patient record and case status.

**Fields**
- `patientId`
- `userId` (link to User)
- `displayName` (PHI)
- `status`: `active` | `inactive`
- `primaryTherapistId` (optional; see defaulting below)
- `clinicId` (implicit single clinic for MVP; server default)
- `createdAt`, `updatedAt`

**Defaulting behavior (Option A)**
- For MVP, if `primaryTherapistId` is not set, **SOMI Connect** must treat it as:
  - `defaultTherapistId` for the clinic (server config).
- This is intended to avoid added workflow when starting with one therapist.

**Active Caseload**
- Clinician “Active Case Load” should be supported by querying:
  - `patients where status = active`
  - and (when multiple therapists exist) `primaryTherapistId = therapistUserId` (or equivalent access rule).

### 3.3 Clinic / Tenant (MVP minimal)
- Single clinic initially.
- `clinicId` exists for forward compatibility but should be auto-assigned and hidden from MVP workflows.

### 3.4 Exercise (Library Identity)
Durable identity for an exercise (“Tongue Suction Hold”).

**Fields**
- `exerciseId` (stable identity)
- `currentVersionId`
- `archivedAt` (soft delete / not assignable to new plans)
- `createdByUserId`
- `createdAt`, `updatedAt`

### 3.5 Exercise Version (Immutable Snapshot)
Immutable snapshot used by plans and history.

**Fields**
- `exerciseVersionId`
- `exerciseId`
- `title`
- `description` (rich text)
- `tags` (taxonomy ids for Function/Structure/Age)
- `mediaId` (single pointer to a single library media object)
- `defaultParams` (see 3.9)
- `createdAt`
- `createdByUserId`

**Editing rule**
- Editing an exercise creates a new `ExerciseVersion`.
- `Exercise.currentVersionId` is updated to the new version.

**Version propagation rule (Approach B)**
- When an exercise version is updated, **SOMI Connect must automatically update** all plans with status:
  - `draft` or `published`
- Plans with status `archived` must not be automatically updated (history preservation).

> The “automatic update” replaces `exerciseVersionId` in affected plan assignments that reference that `exerciseId`.

---

## 4. Patient Treatment Plans (Embedded Storage)

### 4.1 Storage Strategy (MVP)
Treatment plans should be stored as a single Mongo document per plan, with embedded structure:

- TreatmentPlan document contains `sessions[]`
  - each session contains `routines[]`
    - each routine contains `assignments[]`

This reduces join complexity and supports:
- atomic publish
- single read for Today/Plan views

### 4.2 Treatment Plan
**Collection:** `treatment_plans`

**Fields**
- `planId`
- `patientId`
- `status`: `draft` | `published` | `archived`
- `publishedAt`, `publishedBy`
- `remindersEnabled`: boolean (adherence nudges; separate from message notifications)
- `createdAt`, `updatedAt`
- `sessions[]` (embedded)

### 4.3 Plan Session (embedded)
**Fields**
- `sessionKey` (stable identifier within the plan; can be opaque or derived)
- `index` (order)
- `title` (optional)
- `notesForTherapistOnly` (optional; PHI)
- `timesPerDay`: `number` (1, 2, or 3 — how many times per day the client repeats the full assignment list)
- `assignments[]`

> The same set of exercises is repeated at each occurrence. A session with `timesPerDay: 3` means the client does all assignments three times per day. The client labels occurrences as morning/afternoon/evening locally.

### 4.4 Session Exercise Assignment (embedded)
**Fields**
- `assignmentKey` (stable identifier within plan)
- `exerciseId`
- `exerciseVersionId` (pinned; auto-updated per Approach B except archived plans)
- `index` (order)
- `paramsOverride` (optional; see 3.9)

---

## 5. Exercise Parameters (Defaults + Overrides)

### 5.1 Parameter Model
To keep MVP flexible, parameters are represented using a small set of numeric fields:

- `reps?: number`
- `sets?: number`
- `seconds?: number`

These can represent:
- repetitions only
- sets + repetitions
- seconds only
- repetitions + seconds
- sets + repetitions + seconds

### 5.2 Defaults and Overrides
- `ExerciseVersion.defaultParams` provides default values (optional).
- `RoutineExerciseAssignment.paramsOverride` provides per-assignment customization (optional).
- Effective params = defaultParams merged with paramsOverride (override wins).

---

## 6. Completion Events (PHI)

### 6.1 Completion Event
**Collection:** `exercise_completions`

A completion event represents binary completion for a single exercise within a specific routine on a date.

**Fields**
- `completionId`
- `patientId`
- `planId` (for context; helps with debugging/history)
- `dateLocal` (YYYY-MM-DD in patient timezone)
- `occurrence`: `number` (1-based; e.g., 1, 2, or 3 — maps to the Nth repetition of the daily assignment list)
- `exerciseId`
- `exerciseVersionId` (historical correctness)
- `completedAt`
- `source`: `mobile_ios` | `mobile_android` | `web`
- `createdAt`

**Uniqueness constraint (MVP)**
- One completion per `(patientId, dateLocal, occurrence, exerciseVersionId)`.

### 6.2 Idempotency Requirement
- Completion writes must be idempotent to prevent double-counting due to retries.
- SOMI Connect must support idempotent completion creation using either:
  - a client-provided idempotency key, or
  - a server-enforced unique index on the uniqueness constraint above.

### 6.3 Performance Measurement
Endpoints that compute “routine state” or daily completion status must emit Datadog metrics:
- latency p50/p95
- query time and docs scanned
- error rates
This is required to validate whether further caching/denormalization is needed.

---

## 7. Messaging & Media Metadata (PHI)

### 7.1 Message Threads
**Collection:** `message_threads`

**Fields**
- `threadId`
- `patientId`
- `therapistUserId`
- `createdAt`, `updatedAt`
- `lastMessageAt`
- `status`: `active` | `archived`

### 7.2 Messages
**Collection:** `messages`

**Fields**
- `messageId`
- `threadId`
- `senderUserId`
- `senderRole`
- `text` (PHI)
- `attachments[]` (references to Upload objects)
- `createdAt`

### 7.3 Upload / Attachment
**Collection:** `uploads`

**Fields**
- `uploadId`
- `patientId` (always present for PHI uploads)
- `ownerRole`: `client` | `therapist`
- `purpose`: `practice_video` | `message_attachment` | `therapist_feedback` | `other`
- object storage key, content type, size, checksum
- `createdAt`, `createdByUserId`
- `status`: `pending` | `available` | `failed`

> Access to upload content must only be via signed URLs generated after authorization checks.

---

## 8. Feedback & Notes (PHI)

### 8.1 Therapist Feedback
**Collection:** `feedback`

**Fields**
- `feedbackId`
- `patientId`
- optional: `uploadId` or `completionId`
- `therapistUserId`
- `text` (PHI)
- optional: `feedbackMediaUploadId`
- `createdAt`

### 8.2 Therapist Notes / Meeting Notes (therapist-only)
**Collection:** `notes`

**Fields**
- `noteId`
- `patientId`
- optional: `planId`, `sessionKey`
- `authorUserId`
- `noteText` (PHI)
- `createdAt`

**Visibility requirement**
- Notes must never be visible to clients in any API response.

---

## 9. Patient Timeline (Normalized + Paginated)

### 9.1 MVP Approach (Normalized)
For MVP, the “timeline” is a paginated view generated by querying normalized collections, rather than maintaining a separate denormalized timeline collection.

The timeline is a merged, time-ordered feed that may include:
- completion events
- uploads
- therapist feedback
- therapist notes (therapist-only)
- optionally message events (policy decision; can be excluded to reduce noise)

### 9.2 Performance & UX Constraints
- Timeline must be paginated (cursor or time-based pagination).
- Timeline must not be the first/default view that loads in the patient experience.
- Datadog metrics must capture:
  - latency p50/p95
  - number of records fetched per collection
  - time spent merging/sorting
  - error rates

### 9.3 Visibility Rules
- Client timeline excludes therapist-only notes.
- Therapist timeline includes all patient activity + notes.

> If timeline performance becomes a problem, introduce a dedicated `timeline_events` collection as a fast follow.

---

## 10. Access Control Rules (RBAC + Patient Relationship)

### 10.1 Clients
- Access only resources scoped to their `patientId`:
  - plan, sessions, routines, assignments (read)
  - completions (read/write for self)
  - message threads/messages (read/write for self)
  - uploads (write for self; read for authorized viewing)
  - therapist feedback (read)

### 10.2 Therapists
- Access only patients on their active caseload.
- May:
  - create/edit/publish plans
  - view progress and adherence
  - view/respond to messages
  - view uploads, provide feedback
  - create internal notes

### 10.3 Admins
- May manage users and system configuration.
- Admin access to PHI should be restricted and audited (policy decision).

---

## 11. Audit Logging (Security Critical)

**Collection:** `audit_events` (or equivalent append-only store)

Audit events required for:
- auth and MFA events
- PHI read/write operations
- plan publishing
- media access requests (signed URL generation)
- exercise library create/edit/archive
- therapist feedback and notes creation
- administrative permission changes

Fields include:
- `auditId`
- `actorUserId`, `actorRole`
- `actionType`
- `resourceType`, `resourceId`
- `patientId` if patient-scoped
- `timestamp`
- `ip`, `userAgent` (if available)
- `correlationId`

> Audit event payloads must not include free-form PHI.

---

## 12. Secrets & Environments

- Environments: **staging** and **prod** only.
- Separate secrets per environment stored in a secrets manager.
- No secrets committed to code repos.
- Rotate secrets periodically and on suspected compromise.

---

## 13. Definition of Done (Data Model & Security)

This document is satisfied when:
- Entity boundaries and relationships are implemented consistently.
- Plan structure is embedded for MVP with `timesPerDay` and flat assignments (supports 1/day, 2/day, and 3/day).
- Exercise versioning + automatic updates apply to `draft|published` plans, not `archived`.
- Completion writes are idempotent and uniquely constrained.
- Media is encrypted at rest and only accessible via authorized signed URLs.
- Notes are therapist-only and never returned to clients.
- Audit logging exists for PHI access and system changes.
- Aggregation-heavy endpoints are measured in Datadog to guide future caching decisions.
