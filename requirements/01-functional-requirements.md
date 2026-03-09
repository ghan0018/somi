# 01 – Functional Requirements (SOMI Treatment)

> **Scope**
> - Covers functional behavior for **SOMI Home** (client mobile apps), **SOMI Clinic** (therapist/admin web), and **SOMI Connect** (backend).
> - Expressed as: user journeys → role features → app-specific requirements → user stories & acceptance criteria → API contracts (outline).
> - HIPAA note: no PHI in push/SMS/email payloads; audit all PHI access.

---

## 0. Shared Concepts

- **Session**: one therapist-defined step in a plan (e.g., 12 sessions), each containing 5–9 exercises.
- **Exercise**: VOD + text/image instructions + parameters (reps, sets, duration, intensity).
- **Treatment Plan**: ordered list of sessions for a patient; can be advanced, paused, or edited.
- **Progress**: adherence/completion logs, timestamps, optional notes, and therapist feedback.
- **Messaging**: 1:1 asynchronous, attachments permitted (video/image).
- **Notifications**: device push + in-app banners; payloads contain only neutral text.

---

## 1. User Journeys (high level)

### 1.1 Client journey within Treatment (SOMI Home focus)
1) Open **Today** → see today’s exercises → open an exercise → watch VOD/read steps → perform → (optionally) record & upload → mark complete.  
2) Ask a question or submit a practice video in **Messages**.  
3) Review **Treatment Plan** to see past sessions completed and what’s next.

### 1.2 Therapist journey within Treatment (SOMI Clinic focus)
1) Create/curate **Treatment Exercises** (library with VOD).  
2) Open **Patient View** → review progress → edit plan (session by session) → send feedback.  
3) Check **Inbox** for new client messages/uploads → respond → optionally adjust plan.

---

## 2. SOMI Home (Client Apps)

### 2.1 Navigation (3 tabs)
- **Today** (default): list of today’s exercises; open exercise; mark complete.
- **Treatment Plan**: session-by-session view with completion status to date.
- **Messages**: 1:1 chat with therapist, including video/image upload.

### 2.2 Today – Requirements
- R1. Show **today’s exercise list** with name and completion state.
- R2. Tap item → **Exercise Detail**:
  - VOD player (online-only streaming of HLS video).
  - Instructions (rich text), parameters (reps/sets/duration).
  - “Mark Complete” (single tap).
  - “Upload Practice Video” (records in-app or selects from gallery).
- R3. Completion persists locally if offline and syncs when online.
- R4. If plan updates server-side, **Today** list refreshes next launch or via pull-to-refresh.

### 2.3 Treatment Plan – Requirements
- R5. Session list with progress (e.g., Session 1 ✓, Session 2 in progress).
- R6. Drilling into a session shows its exercises and completion history.
- R7. Read-only display of sessions.

### 2.4 Messages – Requirements
- R8. 1:1 threaded chat with therapist; supports text + attachments (image/video).
- R9. “Upload Exercise Video” from thread (reuses same upload flow).
- R10. Shows delivery status; indicates therapist identity and last seen (no PHI in push).
- R11. Large file uploads: background upload + retry on connectivity restore.

### 2.5 Notifications & Reminders
- R12. Client can opt-in to daily reminders at chosen time(s).
- R13. Push/in-app notifications for new therapist messages/feedback.
- R14. Notification text respects privacy (e.g., “Good job completing your exercises!”).

### 2.6 Accessibility & Localization (initial)
- R15. Dynamic Type/text scaling; VoiceOver/TalkBack focus order.
- R16. English only initially; copy pulled from strings for future i18n.

### 2.7 Client App User Stories (sample)
- US-HOME-01: *As a client, I can view today’s exercises and mark each as done.*  
  **AC:** list renders ≤1s after data available; tapping complete toggles state; state persists offline.
- US-HOME-02: *As a client, I can watch the exercise VOD and read instructions.*  
  **AC:** video plays without PHI overlays.
- US-HOME-03: *As a client, I can upload a practice video for therapist feedback.*  
  **AC:** accepts up to configured size; shows progress; resumes on reconnect; success banner on completion.
- US-HOME-04: *As a client, I can send and receive messages with my therapist.*  
  **AC:** messages appear in order; push arrives (if enabled) within 30s; no PHI in push body.

---

## 3. SOMI Clinic (Therapist/Admin Web)

### 3.1 Treatment Exercises (Library)
- R17. CRUD for exercises: create, edit, archive/restore (soft delete).
- R18. Upload/manage VOD, set title/description, labels/tags (Function, Structure, Age).
- R19. Versioning: editing creates a new version; plans reference a specific version.
- R20. Search/filter by tag, label, age group, text.

### 3.2 Inbox
- R21. Stream of actionable notifications: new client messages, new uploads.
- R22. Clicking an item opens **Patient → Messages** anchored to the relevant thread/upload.
- R23. (Later) Surface completion anomalies (e.g., missed exercises 3 days).

### 3.3 Patient View (locked context)
Tabs: **General Info**, **Treatment Plan**, **Progress**, **Messages** (Billing later), **Notes**.

- **General Info**
  - R24. Demographics (limited), therapist assignment, plan status, last activity.
- **Treatment Plan**
  - R25. Create/edit plan: ordered sessions; each session: add exercises (from library), set parameters.
  - R26. Re-order sessions; pause/advance plan; per-session notes.
  - R27. Save draft vs. publish; publishing queues client refresh.
- **Progress**
  - R28. View adherence over time: % completion by day/session; list of submitted videos; therapist feedback log.
  - R29. Export CSV/PDF (no PHI in filename; PHI inside protected export).
- **Messages**
  - R30. Threaded chat with the client; respond with text/video; reference exercises.
- **Notes (Meeting Notes)**
  - R31. Free-form clinical note area per session/date; visible to clinicians only; time-stamped.

### 3.4 Admin functions (initial, simple)
- R32. Invite therapist user; enable/disable user accounts; reset MFA; assign patients.
- R33. Manage exercise labels taxonomy (Function, Structure, Age groups). Tags in use by exercises cannot be deleted. Duplicate labels show specific error messages.
- R34. View audit events for a patient (read/write actions). Actor column shows email (not raw ID). Filter by user.
- R35. Patient reactivation: when creating a patient with an email matching an inactive patient, prompt to reactivate instead. Active/inactive toggle on patient list.
- R36. MFA via authenticator app (TOTP). See `09-mfa-authenticator-todo.md` for backlog details.
- R37. Every exercise requires exactly one video (MP4 or MOV, max 500 MB). Video is required when creating or editing an exercise. Videos are stored in S3 with pre-signed URLs for secure, direct browser upload.
- R38. Exercise media (non-PHI) is stored in a separate S3 bucket from patient media (PHI). Staging and production environments use separate buckets.
- R39. Clicking an exercise row in the Exercise Library opens a read-only detail view showing: title, description, tags, default parameters, status, and a playable video. Edit mode is accessed via an "Edit" button on the detail page.
- R40. Exercise create/edit validation: title, description, and video are all required; at least one default parameter (reps, sets, or seconds) must be specified.
- R41. Exercise videos can be deleted and replaced. Replacing a video uploads a new file and updates the exercise's media reference.
- R42. Age-category taxonomy tags sort numerically by the leading number in the label (e.g., "0-5" before "6-12" before "13-18"), not alphabetically.

### 3.5 Clinic User Stories (sample)
- US-CLINIC-01: *As a therapist, I can create a 12-session plan using exercises from the library and publish it to a patient.*  
  **AC:** plan saved → publish pushes plan to client; appears on client within 60s or app refresh.
- US-CLINIC-02: *As a therapist, I can review a client’s upload and leave feedback.*  
  **AC:** video plays; comment saved; client receives notification; audit log records action.
- US-CLINIC-03: *As a therapist, I can search exercises by Function/Structure/Age and update an exercise’s description and video.*  
  **AC:** new version generated; existing plans remain pinned to prior version unless explicitly updated.

---

## 4. SOMI Connect (Backend – REST)

### 4.1 Services
- **Auth & Identity**: email/password, MFA; roles: `client`, `therapist`, `admin`.
- **Patients & Plans**: patient profiles; plan CRUD; session & exercise assignments.
- **Exercises Library**: exercise CRUD, tags, versions, media management.
- **Progress & Feedback**: completion logs, therapist feedback, exports.
- **Messaging**: threads, messages, attachments.
- **Notifications**: push scheduling (no PHI in payload).
- **Audit**: append-only audit events for PHI access and changes.
- **Telemetry**: request logs (no PHI), metrics, traces.

### 4.2 REST API (outline, representative)

All endpoints are prefixed with `/v1` and require authentication.
Role-based authorization is enforced server-side for all requests.

#### Authentication & Identity
```http
POST /v1/auth/login
POST /v1/auth/mfa/verify
GET  /v1/me
```

#### Patients & Treatment Plans
```http
GET  /v1/patients/{patientId}
GET  /v1/patients/{patientId}/plan
POST /v1/patients/{patientId}/plan
POST /v1/patients/{patientId}/plan/publish
```

#### Exercise Completion & Progress (Conceptual)

Progress is tracked across multiple dimensions and time ranges. The API distinguishes between
event-level data ingestion and aggregated progress views.

##### Daily Exercise Completion
```http
POST /v1/patients/{patientId}/exercise-completions
GET  /v1/patients/{patientId}/exercise-completions
```
##### Adherence & Progress Summaries
```http
GET /v1/patients/{patientId}/adherence
```

##### Clinical Timeline
```http
GET  /v1/patients/{patientId}/timeline
POST /v1/patients/{patientId}/timeline/notes
POST /v1/patients/{patientId}/timeline/feedback
```

#### Exercise Library
```http
GET    /v1/exercises
POST   /v1/exercises

GET    /v1/exercises/{exerciseId}
PATCH  /v1/exercises/{exerciseId}
POST /v1/exercises/{exerciseId}/archive
POST /v1/exercises/{exerciseId}/restore

POST   /v1/exercises/{exerciseId}/media
```

#### Messaging
```http
GET  /v1/messages/threads?patientId={patientId}
POST /v1/messages/threads
GET  /v1/messages/{threadId}
POST /v1/messages/{threadId}
POST /v1/messages/{threadId}/attach
```

#### Upload Management (Pre-Signed URLs)
```http
POST /v1/uploads/start
POST /v1/uploads/complete
```

#### Inbox & Audit
```http
GET /v1/inbox
GET /v1/audit?patientId={patientId}
```

#### API Notes
- All uploads return **pre-signed URLs** for direct object-storage upload.
- Media retrieval uses **short-lived signed URLs**.
- No PHI is ever returned in push notification payloads.
- All PHI reads/writes generate **audit events**.


---

## 5. Testing & CI/CD

### 5.1 Strategy (all repos)
- CI pipeline: lint → unit tests → API contract tests → build → integration tests → artifact.
- **Playwright E2E with AI agent**:
  - SOMI Home: login, Today completion, upload, message.
  - SOMI Clinic: create/edit plan, review upload, search exercises.
- Contract tests between apps and SOMI Connect (OpenAPI).
- Security scans: deps, secrets, images.

### 5.2 Environments
- Staging (automatically deployed from main) → Prod (automatically deployed from release branches); feature flags.
- Synthetic data only.

---

## 6. Telemetry & Health (Datadog)

- Metrics: latency, error rate, upload success %, message deliverability.
- Tracing: distributed APM.
- Logs: structured, **no PHI**.
- Alerts: SLO breaches, elevated auth failures.

---

## 7. Vendor/Build Decisions

- **Chat**: build in-house vs HIPAA-eligible vendor (BAA required).
- **Video**: client-side capture vs HIPAA media pipeline.
- **Push**: APNs/FCM (neutral text only).
- **Auth**: in-house vs HIPAA-eligible IdP.

---

## 8. Permissions

- Clients: own data only.
- Therapists: assigned patients.
- Admins: user mgmt, taxonomy, audit.

---

## 9. Definition of Done

- End-to-end flows pass on iOS/Android/Web.
- Notifications function without PHI.
- Datadog dashboards live.
- CI/CD green with E2E coverage.
