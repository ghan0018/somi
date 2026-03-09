# 04 – REST API Design (SOMI Connect)

## Scope

This document defines the REST API surface for **SOMI Connect**, supporting:

- **SOMI Home** (iOS & Android client apps)
- **SOMI Clinic** (Therapist/Admin web app)

This API is aligned with:
- Embedded treatment plan structure (sessions → routines → assignments)
- Exercise versioning with automatic propagation (draft/published update; archived frozen)
- Daily completion tracking (morning/afternoon/evening)
- Derived adherence calculations (computed on demand)
- Normalized, paginated patient timeline
- HIPAA-safe notification constraints

---

# 0. Global API Conventions

## 0.1 Versioning

All endpoints are prefixed with `/v1`.

## 0.2 Content Type

Requests and responses use `application/json` unless otherwise noted.

## 0.3 Authentication

- Login uses HTTP Basic Auth: the client sends `Authorization: Basic <base64(email:password)>`.
- Login returns a JWT access token and refresh token.
- MFA required for `therapist` and `admin` roles. Login returns a `challengeId` instead of tokens if MFA is required.
- All other authenticated endpoints require `Authorization: Bearer <accessToken>`.
- Authorization is enforced server-side based on role and resource ownership.

## 0.4 Roles

| Role | Description |
|------|-------------|
| `client` | Patient using SOMI Home. Access limited to own data. |
| `therapist` | Clinician using SOMI Clinic. Access limited to assigned patients. |
| `admin` | Practice staff. User management, taxonomy, audit access. |

## 0.5 Pagination

Paginated endpoints accept:
- `limit` — number of items per page (default 25, max 100)
- `cursor` — opaque string for next page (omit for first page)

Paginated response shape:
```json
{
  "items": [],
  "nextCursor": "opaque_string_or_null"
}
```

## 0.6 Error Format

All errors use a consistent shape:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable description",
    "details": {}
  }
}
```

### Standard Error Codes

| HTTP Status | Code | When |
|-------------|------|------|
| 400 | `VALIDATION_ERROR` | Invalid request body or query params |
| 401 | `UNAUTHORIZED` | Missing or invalid token |
| 403 | `FORBIDDEN` | Valid token but insufficient role/access |
| 404 | `NOT_FOUND` | Resource does not exist or caller lacks access |
| 409 | `CONFLICT` | Duplicate resource (e.g., idempotency collision) |
| 422 | `UNPROCESSABLE_ENTITY` | Semantically invalid (e.g., publish empty plan) |
| 429 | `RATE_LIMITED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Unexpected server error |

## 0.7 Audit

All endpoints that read or write PHI generate audit events. See `03-data-model-and-security-requirements.md` Section 11.

---

# 1. Authentication

## POST /v1/auth/login

Authenticate a user with email and password.

**Roles:** public (no auth required)

**Authentication:** HTTP Basic Auth header — `Authorization: Basic <base64(email:password)>`

**Request body:** empty (no JSON body required)

**Response (no MFA required):**
```json
{
  "accessToken": "jwt_string",
  "refreshToken": "jwt_string",
  "expiresIn": 3600,
  "user": {
    "userId": "usr_123",
    "role": "client",
    "email": "user@example.com"
  }
}
```

**Response (MFA required — therapist/admin):**
```json
{
  "mfaRequired": true,
  "challengeId": "mfa_456",
  "methods": ["totp"]
}
```

**Errors:** `UNAUTHORIZED` (invalid credentials), `VALIDATION_ERROR`

---

## POST /v1/auth/mfa/verify

Complete MFA verification after login.

**Roles:** public (uses challengeId from login)

**Request:**
```json
{
  "challengeId": "mfa_456",
  "code": "123456"
}
```

**Response:**
```json
{
  "accessToken": "jwt_string",
  "refreshToken": "jwt_string",
  "expiresIn": 3600,
  "user": {
    "userId": "usr_123",
    "role": "therapist",
    "email": "therapist@somi.com"
  }
}
```

**Errors:** `UNAUTHORIZED` (invalid code or expired challenge)

---

## POST /v1/auth/refresh

Exchange a valid refresh token for a new access token.

**Roles:** public (uses refresh token)

**Request:**
```json
{
  "refreshToken": "jwt_string"
}
```

**Response:**
```json
{
  "accessToken": "jwt_string",
  "expiresIn": 3600
}
```

**Errors:** `UNAUTHORIZED` (invalid or expired refresh token)

---

## POST /v1/auth/logout

Invalidate the current refresh token.

**Roles:** any authenticated user

**Request:**
```json
{
  "refreshToken": "jwt_string"
}
```

**Response:** `204 No Content`

---

# 2. Current User

## GET /v1/me

Return the authenticated user's profile.

**Roles:** `client`, `therapist`, `admin`

**Response (client):**
```json
{
  "userId": "usr_123",
  "role": "client",
  "email": "jane@example.com",
  "patientId": "pat_456",
  "displayName": "Jane Doe"
}
```

**Response (therapist/admin):**
```json
{
  "userId": "usr_789",
  "role": "therapist",
  "email": "therapist@somi.com",
  "mfaEnabled": true
}
```

---

# 3. Patients (Therapist/Admin)

## GET /v1/clinic/patients

List patients. Supports filtering by status.

**Roles:** `therapist`, `admin`

**Query params:**
- `status` — `active` | `inactive` (default: `active`)
- `search` — case-insensitive search on `displayName` (optional)
- `limit`, `cursor` — pagination

**Response:**
```json
{
  "items": [
    {
      "patientId": "pat_456",
      "displayName": "Jane Doe",
      "status": "active",
      "primaryTherapistId": "usr_789",
      "lastActivityAt": "2026-01-15T14:30:00Z",
      "createdAt": "2025-11-01T10:00:00Z"
    }
  ],
  "nextCursor": null
}
```

**Access rule:** Therapists see only their assigned patients. Admins see all.

---

## POST /v1/clinic/patients

Create a new patient record. Also creates a linked `User` with role `client`.

**Roles:** `therapist`, `admin`

**Request:**
```json
{
  "displayName": "Jane Doe",
  "email": "jane@example.com",
  "primaryTherapistId": "usr_789"
}
```

`primaryTherapistId` is optional. If omitted, defaults to the clinic's configured default therapist.

**Response:** `201 Created`
```json
{
  "patientId": "pat_456",
  "userId": "usr_123",
  "displayName": "Jane Doe",
  "email": "jane@example.com",
  "status": "active",
  "primaryTherapistId": "usr_789",
  "createdAt": "2026-01-20T10:00:00Z"
}
```

**Errors:**
- `VALIDATION_ERROR` — missing required fields
- `CONFLICT` (duplicate email) — if the email belongs to an active user
- `CONFLICT` with `details.code: "INACTIVE_PATIENT_EXISTS"` — if the email belongs to a user with an inactive patient profile. Response includes `details.existingPatientId` so the client can offer reactivation via `PATCH /v1/clinic/patients/{patientId}` with `{ "status": "active" }`.

---

## GET /v1/clinic/patients/{patientId}

Get a single patient's profile.

**Roles:** `therapist` (assigned only), `admin`

**Response:**
```json
{
  "patientId": "pat_456",
  "userId": "usr_123",
  "displayName": "Jane Doe",
  "email": "jane@example.com",
  "status": "active",
  "primaryTherapistId": "usr_789",
  "createdAt": "2026-01-20T10:00:00Z",
  "updatedAt": "2026-01-20T10:00:00Z"
}
```

---

## PATCH /v1/clinic/patients/{patientId}

Update patient fields.

**Roles:** `therapist` (assigned), `admin`

**Request:** (partial update — include only fields to change)
```json
{
  "displayName": "Jane Smith",
  "status": "inactive",
  "primaryTherapistId": "usr_999"
}
```

**Response:** Updated patient object.

---

# 4. Exercise Library

## GET /v1/exercises

List exercises with optional filtering.

**Roles:** `therapist`, `admin`

**Query params:**
- `q` — text search on title/description
- `tagIds` — comma-separated taxonomy IDs (Function/Structure/Age)
- `archived` — `true` to include archived (default: `false`)
- `limit`, `cursor` — pagination

**Response:**
```json
{
  "items": [
    {
      "exerciseId": "ex_001",
      "currentVersionId": "exv_003",
      "title": "Tongue Suction Hold",
      "description": "Place tongue on palate...",
      "tags": [
        { "tagId": "tag_breathing", "label": "Breathing" }
      ],
      "mediaId": "lib_media_123",
      "defaultParams": { "reps": 10, "sets": 2 },
      "archivedAt": null,
      "createdAt": "2025-12-01T08:00:00Z"
    }
  ],
  "nextCursor": null
}
```

---

## GET /v1/exercises/{exerciseId}

Get exercise detail including current version.

**Roles:** `therapist`, `admin`; `client` may access exercises in their plan (read-only, via Today View)

**Response:**
```json
{
  "exerciseId": "ex_001",
  "currentVersionId": "exv_003",
  "title": "Tongue Suction Hold",
  "description": "Place tongue on palate and hold suction for the specified duration.",
  "tags": [
    { "tagId": "tag_breathing", "label": "Breathing" },
    { "tagId": "tag_tongue", "label": "Tongue" }
  ],
  "mediaId": "lib_media_123",
  "defaultParams": { "reps": 10, "sets": 2, "seconds": 5 },
  "archivedAt": null,
  "versions": [
    { "exerciseVersionId": "exv_003", "createdAt": "2026-01-10T09:00:00Z" },
    { "exerciseVersionId": "exv_002", "createdAt": "2025-12-15T09:00:00Z" },
    { "exerciseVersionId": "exv_001", "createdAt": "2025-12-01T08:00:00Z" }
  ],
  "createdAt": "2025-12-01T08:00:00Z",
  "updatedAt": "2026-01-10T09:00:00Z"
}
```

---

## POST /v1/exercises

Create a new exercise. Creates both the `Exercise` identity and the initial `ExerciseVersion`.

**Roles:** `therapist`, `admin`

**Request:**
```json
{
  "title": "Tongue Suction Hold",
  "description": "Place tongue on palate and hold suction.",
  "tagIds": ["tag_breathing", "tag_tongue"],
  "defaultParams": { "reps": 10, "sets": 2 },
  "mediaId": "lib_media_123"
}
```

`mediaId` references a library media object uploaded via the upload flow. Optional at creation time.

**Response:** `201 Created` — exercise object with initial version.

---

## PATCH /v1/exercises/{exerciseId}

Edit an exercise. Creates a **new ExerciseVersion** and updates `currentVersionId`.

**Roles:** `therapist`, `admin`

**Request:** (include only fields to change)
```json
{
  "title": "Tongue Suction Hold (Updated)",
  "description": "Updated instructions...",
  "tagIds": ["tag_breathing", "tag_tongue", "tag_swallowing"],
  "defaultParams": { "reps": 12, "sets": 3 },
  "mediaId": "lib_media_456"
}
```

**Side effect:** SOMI Connect automatically updates `exerciseVersionId` in all `draft` and `published` treatment plan assignments that reference this `exerciseId`. Plans with status `archived` are not modified.

**Response:** Updated exercise object with new `currentVersionId`.

---

## POST /v1/exercises/{exerciseId}/archive

Soft-delete an exercise. Archived exercises cannot be assigned to new plans but remain in existing plans.

**Roles:** `therapist`, `admin`

**Response:** `200 OK` — updated exercise with `archivedAt` timestamp.

---

## POST /v1/exercises/{exerciseId}/restore

Restore a previously archived exercise.

**Roles:** `therapist`, `admin`

**Response:** `200 OK` — updated exercise with `archivedAt: null`.

---

## POST /v1/exercises/{exerciseId}/media

Initiate a pre-signed upload for exercise library media (non-PHI).

**Roles:** `therapist`, `admin`

**Request:**
```json
{
  "contentType": "video/mp4",
  "sizeBytes": 52428800
}
```

**Response:**
```json
{
  "mediaId": "lib_media_456",
  "uploadUrl": "https://s3.amazonaws.com/...",
  "expiresAt": "2026-01-20T11:00:00Z"
}
```

The client uploads directly to S3 using the pre-signed URL, then calls `POST /v1/uploads/{uploadId}/complete` to finalize.

---

# 5. Treatment Plans

## GET /v1/me/plan

Get the authenticated client's published treatment plan.

**Roles:** `client`

**Response:**
```json
{
  "planId": "plan_001",
  "patientId": "pat_456",
  "status": "published",
  "remindersEnabled": true,
  "publishedAt": "2026-01-15T10:00:00Z",
  "sessions": [
    {
      "sessionKey": "sess_01",
      "index": 0,
      "title": "Week 1-2: Foundation",
      "timesPerDay": 3,
      "assignments": [
        {
          "assignmentKey": "asgn_01",
          "exerciseId": "ex_001",
          "exerciseVersionId": "exv_003",
          "index": 0,
          "exercise": {
            "title": "Tongue Suction Hold",
            "description": "Place tongue on palate...",
            "mediaId": "lib_media_123"
          },
          "effectiveParams": { "reps": 10, "sets": 2, "seconds": 5 }
        }
      ]
    }
  ]
}
```

Notes:
- `timesPerDay` indicates how many times per day the client repeats the full assignment list (1, 2, or 3). The client labels occurrences as morning/afternoon/evening locally.
- `exercise` is an inline snapshot from the referenced `ExerciseVersion` for client rendering.
- `effectiveParams` is the merge of `ExerciseVersion.defaultParams` + `paramsOverride`.
- `notesForTherapistOnly` is **never included** in client responses.

---

## GET /v1/clinic/patients/{patientId}/plan

Get the patient's current plan (any status) for the therapist view.

**Roles:** `therapist` (assigned), `admin`

**Response:** Same shape as above, but includes `notesForTherapistOnly` fields in sessions.

---

## POST /v1/clinic/patients/{patientId}/plan

Create a new treatment plan in `draft` status.

**Roles:** `therapist` (assigned), `admin`

**Request:**
```json
{
  "sessions": [
    {
      "title": "Week 1-2: Foundation",
      "notesForTherapistOnly": "Focus on tongue posture",
      "timesPerDay": 3,
      "assignments": [
        {
          "exerciseId": "ex_001",
          "paramsOverride": { "reps": 12 }
        },
        {
          "exerciseId": "ex_002",
          "paramsOverride": { "seconds": 30 }
        }
      ]
    }
  ]
}
```

Notes:
- `timesPerDay` specifies how many times per day the client repeats all assignments (1, 2, or 3). Defaults to 1 if omitted.
- `exerciseVersionId` is automatically resolved to the current version of each `exerciseId`.
- `assignmentKey` and `sessionKey` are server-generated.
- If a `published` plan already exists, it must be archived first (or this creates a new draft alongside).

**Response:** `201 Created` — full plan object with status `draft`.

---

## PUT /v1/clinic/patients/{patientId}/plan/{planId}

Replace the full plan content (for draft plans only).

**Roles:** `therapist` (assigned), `admin`

**Request:** Same shape as POST (full sessions array).

**Errors:** `UNPROCESSABLE_ENTITY` if plan status is not `draft`.

---

## POST /v1/clinic/patients/{patientId}/plan/{planId}/publish

Publish a draft plan. Makes it visible to the client.

**Roles:** `therapist` (assigned), `admin`

**Request:** empty body

**Response:** Updated plan object with `status: "published"` and `publishedAt`.

**Side effects:**
- Sets `publishedAt` and `publishedBy`.
- Plan becomes visible to the client on next app refresh.
- If reminders are enabled, push scheduling begins.

**Errors:** `UNPROCESSABLE_ENTITY` if plan has no sessions or is already published.

---

## POST /v1/clinic/patients/{patientId}/plan/{planId}/archive

Archive a plan. Archived plans are frozen and not affected by exercise version propagation.

**Roles:** `therapist` (assigned), `admin`

**Response:** Updated plan with `status: "archived"`.

---

## PATCH /v1/clinic/patients/{patientId}/plan/{planId}

Update plan-level settings.

**Roles:** `therapist` (assigned), `admin`

**Request:**
```json
{
  "remindersEnabled": false
}
```

**Response:** Updated plan object.

---

# 6. Today View

## GET /v1/me/today

Get the client's exercise assignments for a specific date, merged with completion state for all occurrences.

**Roles:** `client`

**Query params:**
- `dateLocal` — `YYYY-MM-DD` (required)

**Response:**
```json
{
  "dateLocal": "2026-01-20",
  "sessionKey": "sess_01",
  "sessionTitle": "Week 1-2: Foundation",
  "timesPerDay": 3,
  "assignments": [
    {
      "assignmentKey": "asgn_01",
      "exerciseId": "ex_001",
      "exerciseVersionId": "exv_003",
      "exercise": {
        "title": "Tongue Suction Hold",
        "description": "Place tongue on palate...",
        "mediaId": "lib_media_123"
      },
      "effectiveParams": { "reps": 10, "sets": 2, "seconds": 5 },
      "completions": [
        { "occurrence": 1, "completed": true, "completedAt": "2026-01-20T07:45:00Z" },
        { "occurrence": 2, "completed": false, "completedAt": null },
        { "occurrence": 3, "completed": false, "completedAt": null }
      ]
    },
    {
      "assignmentKey": "asgn_02",
      "exerciseId": "ex_002",
      "exerciseVersionId": "exv_010",
      "exercise": {
        "title": "Lip Seal Hold",
        "description": "Close lips gently...",
        "mediaId": "lib_media_789"
      },
      "effectiveParams": { "seconds": 30 },
      "completions": [
        { "occurrence": 1, "completed": true, "completedAt": "2026-01-20T07:50:00Z" },
        { "occurrence": 2, "completed": false, "completedAt": null },
        { "occurrence": 3, "completed": false, "completedAt": null }
      ]
    }
  ],
  "overallCompletionRate": 0.33
}
```

**Behavior:**
- SOMI Connect determines the current session from the published plan based on plan progression logic.
- Merges assignments from the plan with completion events for `(patientId, dateLocal)` across all occurrences.
- Each assignment includes a `completions` array with one entry per occurrence (based on `timesPerDay`).
- `overallCompletionRate` = total completed / (assignments × timesPerDay).
- Returns inline exercise details for rendering (no additional calls needed).

---

# 7. Completions

## POST /v1/me/completions

Record an exercise completion.

**Roles:** `client`

**Headers:**
- `Idempotency-Key: <uuid>` — required. Prevents duplicate completions on retry.

**Request:**
```json
{
  "dateLocal": "2026-01-20",
  "occurrence": 1,
  "exerciseVersionId": "exv_003"
}
```

`occurrence` is 1-based (1, 2, or 3) and represents which repetition of the daily assignment list is being completed. Must not exceed the session's `timesPerDay`.

**Response:** `201 Created`
```json
{
  "completionId": "cmp_789",
  "patientId": "pat_456",
  "dateLocal": "2026-01-20",
  "occurrence": 1,
  "exerciseId": "ex_001",
  "exerciseVersionId": "exv_003",
  "completedAt": "2026-01-20T07:45:00Z"
}
```

**Idempotency:** If the same `Idempotency-Key` is resubmitted, the server returns `200 OK` with the original completion record (no duplicate created).

**Uniqueness constraint:** One completion per `(patientId, dateLocal, occurrence, exerciseVersionId)`. Attempting a second completion for the same combination returns `409 CONFLICT`.

---

## GET /v1/clinic/patients/{patientId}/completions

List completions for a patient.

**Roles:** `therapist` (assigned), `admin`

**Query params:**
- `dateFrom` — `YYYY-MM-DD` (optional)
- `dateTo` — `YYYY-MM-DD` (optional)
- `occurrence` — filter by occurrence number (optional)
- `limit`, `cursor` — pagination

**Response:**
```json
{
  "items": [
    {
      "completionId": "cmp_789",
      "dateLocal": "2026-01-20",
      "occurrence": 1,
      "exerciseId": "ex_001",
      "exerciseVersionId": "exv_003",
      "completedAt": "2026-01-20T07:45:00Z"
    }
  ],
  "nextCursor": null
}
```

---

# 8. Adherence

## GET /v1/clinic/patients/{patientId}/adherence/weekly

Get weekly adherence for a patient.

**Roles:** `therapist` (assigned), `admin`

**Query params:**
- `weekStart` — `YYYY-MM-DD` (Monday of the week; default: current week)

**Response:**
```json
{
  "patientId": "pat_456",
  "weekStart": "2026-01-13",
  "weekEnd": "2026-01-19",
  "days": [
    { "date": "2026-01-13", "assigned": 6, "completed": 6 },
    { "date": "2026-01-14", "assigned": 6, "completed": 4 },
    { "date": "2026-01-15", "assigned": 6, "completed": 0 }
  ],
  "summary": {
    "totalAssigned": 42,
    "totalCompleted": 30,
    "rate": 0.71
  }
}
```

**Notes:**
- `assigned` = total exercise assignments across all routines for that day (derived from published plan).
- Computed on demand from completion events; not stored.
- Endpoint must emit Datadog metrics (latency, query time, doc scan count).

---

## GET /v1/clinic/patients/{patientId}/adherence/overall

Get overall adherence across the patient's treatment.

**Roles:** `therapist` (assigned), `admin`

**Response:**
```json
{
  "patientId": "pat_456",
  "planId": "plan_001",
  "weeks": [
    { "weekStart": "2026-01-06", "rate": 0.85, "successful": true },
    { "weekStart": "2026-01-13", "rate": 0.71, "successful": false }
  ],
  "summary": {
    "totalWeeks": 2,
    "successfulWeeks": 1,
    "overallRate": 0.78
  }
}
```

**Notes:**
- `successful` is defined as `rate >= 0.80` (configurable server-side).
- Computed on demand.
- Endpoint must emit Datadog metrics.

---

# 9. Timeline

## GET /v1/clinic/patients/{patientId}/timeline

Get a paginated, time-ordered feed of patient activity.

**Roles:** `therapist` (assigned), `admin`

**Query params:**
- `types` — comma-separated filter: `completion`, `upload`, `feedback`, `note` (default: all)
- `limit`, `cursor` — pagination

**Response:**
```json
{
  "items": [
    {
      "type": "completion",
      "timestamp": "2026-01-20T07:45:00Z",
      "data": {
        "completionId": "cmp_789",
        "exerciseTitle": "Tongue Suction Hold",
        "occurrence": 1,
        "dateLocal": "2026-01-20"
      }
    },
    {
      "type": "upload",
      "timestamp": "2026-01-20T08:00:00Z",
      "data": {
        "uploadId": "upl_456",
        "purpose": "practice_video",
        "contentType": "video/mp4"
      }
    },
    {
      "type": "feedback",
      "timestamp": "2026-01-20T14:30:00Z",
      "data": {
        "feedbackId": "fb_111",
        "therapistUserId": "usr_789",
        "text": "Great tongue placement — try slowing down reps 3-5.",
        "uploadId": "upl_456"
      }
    },
    {
      "type": "note",
      "timestamp": "2026-01-20T14:35:00Z",
      "data": {
        "noteId": "note_222",
        "authorUserId": "usr_789",
        "noteText": "Patient showing improvement in suction hold."
      }
    }
  ],
  "nextCursor": "cursor_abc"
}
```

**Visibility rules:**
- `note` type items are **only returned for therapist/admin** callers.
- Client-facing timeline (future) would exclude `note` items.

**Performance:**
- Queries normalized collections (completions, uploads, feedback, notes) and merges by timestamp.
- Must be paginated.
- Must not be the first/default view loaded in any app.
- Must emit Datadog metrics: latency, records fetched per collection, merge time, error rate.

---

# 10. Messaging

## GET /v1/me/messages/thread

Get the authenticated client's message thread with their therapist.

**Roles:** `client`

**Response:**
```json
{
  "threadId": "thr_001",
  "patientId": "pat_456",
  "therapistUserId": "usr_789",
  "lastMessageAt": "2026-01-20T14:00:00Z",
  "status": "active"
}
```

**Notes:** For MVP, each patient has a single thread with their primary therapist. Thread is auto-created on first message or patient creation.

---

## GET /v1/messages/threads/{threadId}/messages

Get messages in a thread.

**Roles:** `client` (own thread), `therapist` (assigned patient), `admin`

**Query params:**
- `limit`, `cursor` — pagination (newest first)

**Response:**
```json
{
  "items": [
    {
      "messageId": "msg_001",
      "threadId": "thr_001",
      "senderUserId": "usr_123",
      "senderRole": "client",
      "text": "I had trouble with the suction hold today.",
      "attachments": [],
      "createdAt": "2026-01-20T12:00:00Z"
    },
    {
      "messageId": "msg_002",
      "threadId": "thr_001",
      "senderUserId": "usr_789",
      "senderRole": "therapist",
      "text": "Try holding for 3 seconds first, then build up.",
      "attachments": [
        {
          "uploadId": "upl_999",
          "contentType": "video/mp4",
          "purpose": "therapist_feedback"
        }
      ],
      "createdAt": "2026-01-20T14:00:00Z"
    }
  ],
  "nextCursor": null
}
```

---

## POST /v1/messages/threads/{threadId}/messages

Send a message in a thread.

**Roles:** `client` (own thread), `therapist` (assigned patient)

**Request:**
```json
{
  "text": "Here is my practice video for today.",
  "attachmentUploadIds": ["upl_123"]
}
```

`attachmentUploadIds` references uploads that have been completed via the upload flow (status `available`).

**Response:** `201 Created` — the new message object.

---

## GET /v1/clinic/patients/{patientId}/messages/thread

Get the message thread for a specific patient (therapist perspective).

**Roles:** `therapist` (assigned), `admin`

**Response:** Same as `GET /v1/me/messages/thread` but looked up by `patientId`.

---

# 11. Upload Flow

Uploads follow a 3-step pre-signed URL pattern:

1. **Start** — client requests a pre-signed upload URL from SOMI Connect
2. **Upload** — client uploads directly to S3 using the pre-signed URL
3. **Complete** — client notifies SOMI Connect that the upload finished

## POST /v1/uploads

Request a pre-signed upload URL.

**Roles:** `client`, `therapist`, `admin`

**Request:**
```json
{
  "purpose": "practice_video",
  "contentType": "video/mp4",
  "sizeBytes": 52428800
}
```

Valid `purpose` values:
- `practice_video` — client practice recording (PHI)
- `message_attachment` — image/video in a message (PHI)
- `therapist_feedback` — therapist video feedback (PHI)
- `exercise_media` — exercise library VOD (non-PHI)

**Response:** `201 Created`
```json
{
  "uploadId": "upl_123",
  "uploadUrl": "https://s3.amazonaws.com/somi-uploads/...",
  "expiresAt": "2026-01-20T11:00:00Z",
  "status": "pending"
}
```

**Validation:**
- `contentType` must be in allowed list: `video/mp4`, `video/quicktime`, `image/jpeg`, `image/png`
- `sizeBytes` must not exceed configured max (e.g., 500MB for video, 10MB for images)

---

## POST /v1/uploads/{uploadId}/complete

Notify that the file has been uploaded to S3.

**Roles:** owner of the upload

**Request:** empty body

**Response:**
```json
{
  "uploadId": "upl_123",
  "status": "available",
  "contentType": "video/mp4",
  "sizeBytes": 52428800
}
```

**Idempotency:** Multiple calls return the same result. Status transitions: `pending` → `available`. If already `available`, returns `200 OK`.

---

## POST /v1/uploads/{uploadId}/access

Generate a short-lived signed URL to access/view an uploaded file.

**Roles:** `client` (own uploads + feedback media), `therapist` (assigned patient uploads), `admin`

**Response:**
```json
{
  "uploadId": "upl_123",
  "accessUrl": "https://s3.amazonaws.com/...",
  "expiresAt": "2026-01-20T11:15:00Z"
}
```

**Notes:**
- Signed URL is scoped to a single object and time-limited (e.g., 15 minutes).
- Access is only granted after authorization checks.
- Generates an audit event.

---

# 12. Therapist Notes & Feedback

## POST /v1/clinic/patients/{patientId}/notes

Create a therapist-only note.

**Roles:** `therapist` (assigned), `admin`

**Request:**
```json
{
  "noteText": "Patient showing improvement in tongue elevation. Recommend advancing to Session 3 next week.",
  "planId": "plan_001",
  "sessionKey": "sess_02"
}
```

`planId` and `sessionKey` are optional — notes can be free-form or linked to a plan session.

**Response:** `201 Created`
```json
{
  "noteId": "note_222",
  "patientId": "pat_456",
  "authorUserId": "usr_789",
  "noteText": "Patient showing improvement...",
  "planId": "plan_001",
  "sessionKey": "sess_02",
  "createdAt": "2026-01-20T14:35:00Z"
}
```

**Critical:** Notes are never returned in any client-facing API response.

---

## GET /v1/clinic/patients/{patientId}/notes

List notes for a patient.

**Roles:** `therapist` (assigned), `admin`

**Query params:**
- `limit`, `cursor` — pagination (newest first)

**Response:** Paginated list of note objects.

---

## POST /v1/clinic/patients/{patientId}/feedback

Create therapist feedback, optionally tied to an upload or completion.

**Roles:** `therapist` (assigned), `admin`

**Request:**
```json
{
  "text": "Great tongue placement — try slowing down on reps 3-5.",
  "uploadId": "upl_456",
  "feedbackMediaUploadId": "upl_789"
}
```

- `uploadId` — the patient upload being reviewed (optional)
- `feedbackMediaUploadId` — a video feedback recording from the therapist (optional)

**Response:** `201 Created` — feedback object.

---

## GET /v1/clinic/patients/{patientId}/feedback

List feedback for a patient.

**Roles:** `therapist` (assigned), `admin`; `client` (own feedback, read-only)

**Query params:**
- `limit`, `cursor` — pagination

**Response:** Paginated list of feedback objects.

---

# 13. Admin

## GET /v1/admin/users

List all users.

**Roles:** `admin`

**Query params:**
- `role` — filter by role (optional)
- `status` — `active` | `disabled` (optional)
- `limit`, `cursor` — pagination

**Response:** Paginated list of user objects (userId, role, email, status, mfaEnabled, createdAt).

---

## POST /v1/admin/users

Invite a new therapist or admin user.

**Roles:** `admin`

**Request:**
```json
{
  "email": "newtherapist@somi.com",
  "role": "therapist"
}
```

**Response:** `201 Created` — user object. Sends invitation email.

---

## POST /v1/admin/users/{userId}/disable

Disable a user account.

**Roles:** `admin`

**Response:** `200 OK` — updated user with `status: "disabled"`.

---

## POST /v1/admin/users/{userId}/enable

Re-enable a previously disabled user account.

**Roles:** `admin`

**Response:** `200 OK` — updated user with `status: "active"`.

**Errors:** `VALIDATION_ERROR` (user is not currently disabled), `NOT_FOUND`

---

## POST /v1/admin/users/{userId}/reset-mfa

Reset MFA for a user (e.g., lost device).

**Roles:** `admin`

**Response:** `200 OK`

---

## GET /v1/admin/audit

Query audit events.

**Roles:** `admin`

**Query params:**
- `patientId` — filter by patient (optional)
- `actorUserId` — filter by actor (optional)
- `actionType` — filter by action (optional)
- `from` — ISO 8601 timestamp (optional)
- `to` — ISO 8601 timestamp (optional)
- `limit`, `cursor` — pagination

**Response:**
```json
{
  "items": [
    {
      "auditId": "aud_001",
      "actorUserId": "usr_789",
      "actorEmail": "therapist@somi.com",
      "actorRole": "therapist",
      "actionType": "plan.publish",
      "resourceType": "treatment_plan",
      "resourceId": "plan_001",
      "patientId": "pat_456",
      "createdAt": "2026-01-15T10:00:00Z"
    }
  ],
  "nextCursor": null
}
```

---

## GET /v1/admin/taxonomy

List taxonomy tags (Function, Structure, Age). Each tag includes an `inUse` flag indicating whether it is referenced by any exercise version.

**Roles:** `therapist`, `admin`

**Response:**
```json
{
  "items": [
    { "tagId": "tag_breathing", "category": "function", "label": "Breathing", "inUse": true },
    { "tagId": "tag_tongue", "category": "structure", "label": "Tongue", "inUse": false },
    { "tagId": "tag_infant", "category": "age", "label": "Infant", "inUse": false }
  ]
}
```

---

## POST /v1/admin/taxonomy

Create a new taxonomy tag.

**Roles:** `admin`

**Request:**
```json
{
  "category": "function",
  "label": "Sleep"
}
```

**Response:** `201 Created` — tag object.

---

## DELETE /v1/admin/taxonomy/{tagId}

Remove a taxonomy tag. Tags that are currently referenced by exercise versions cannot be deleted.

**Errors:** `CONFLICT` (tag is in use by exercises), `NOT_FOUND`

**Roles:** `admin`

**Response:** `204 No Content`

---

# 14. Observability

All endpoints must emit:
- Request count
- p50/p95 latency
- Error rate (by status code)

Aggregation-heavy endpoints (adherence, timeline, completions queries) must additionally emit:
- Query execution time
- Document scan count
- Result set size

No PHI may appear in any metric label, tag, or log message.

---

# 15. Security Summary

- Authentication required for all endpoints except `/v1/auth/login`, `/v1/auth/mfa/verify`, and `/v1/auth/refresh`.
- Role-based access enforced server-side on every request.
- Therapists can only access patients on their active caseload.
- Clients can only access their own data.
- Notes are never returned to clients.
- No PHI in logs or push notification payloads.
- Signed URLs for media are generated only after authorization checks.
- All PHI reads/writes generate audit events.
