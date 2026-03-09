# 02 – Non-Functional Requirements (SOMI Treatment)

> **Scope**
> This document defines the non-functional requirements for the SOMI Treatment product suite:
> - **SOMI Home** (iOS & Android client apps)
> - **SOMI Clinic** (Therapist/Admin web app)
> - **SOMI Connect** (Backend services)
>
> These requirements establish security, performance, reliability, compliance, and operational constraints
> that must be met regardless of implementation details.

---

## 1. Security & Privacy (HIPAA Baseline)

### 1.1 Authentication & Authorization
- All users must authenticate using email/password.
- Multi-factor authentication (MFA) is required for:
  - therapists
  - admins
  - any role accessing PHI via web
- Role-based access control (RBAC) must be enforced server-side:
  - `client` → access to own data only
  - `therapist` → access to assigned patients only
  - `admin` → user management, taxonomy, audit
- Authorization must be enforced in **SOMI Connect**, never trusted from clients.

### 1.2 Data Encryption
- All data in transit must use TLS 1.2+.
- All data at rest must be encrypted using industry-standard encryption.
- Media (videos, images) must be stored in encrypted object storage.
- If a third-party vendor processes PHI, a **Business Associate Agreement (BAA)** is required.

### 1.3 PHI Handling & Notifications
- No PHI may appear in:
  - push notification payloads
  - SMS payloads
  - email subject lines
  - application logs
- Client apps must not cache PHI in plaintext.
- Test and staging environments must use **synthetic data only**.

- Push notification payloads (APNs / FCM) must **not** contain protected health information (PHI), including:
  - diagnoses or conditions
  - body parts or therapy types
  - therapist names or comments
  - specific exercise names, routines, or counts
  - adherence percentages or clinical assessments

- Push notifications **may** include **generic motivational or behavioral reminders** that do not disclose identifiable clinical information, such as:
  - “Only one more to go today!”
  - “You’re almost done for the day.”
  - “Don’t forget to keep up your routine.”

- Push notification content must be safe to display on:
  - lock screens
  - notification banners
  - notification centers

- Rich or non-neutral messaging that includes exercise details, progress counts, routines, or therapist feedback must only be displayed **within the secure application context after user authentication**.

- Background notification scheduling (e.g., end-of-day reminders or adherence nudges) is permitted provided:
  - the user has opted in
  - quiet hours and OS notification settings are respected
  - notification language remains non-identifying and non-clinical outside the app


---

## 2. Auditability & Compliance

### 2.1 Audit Logging
The system must generate immutable audit events for:
- authentication and MFA events
- PHI read/write operations
- exercise plan publication
- media uploads and access
- therapist feedback and notes
- role or permission changes

Audit logs must include:
- actor (user + role)
- action type
- timestamp
- affected resource
- correlation/request ID

### 2.2 Retention & Deletion
- Exercise completions, uploads, and messages must be retained per clinical policy.
- Soft-deleted resources (e.g., archived exercises) must remain available for historical plans.
- Data deletion requests must be supported for compliance purposes.

---

## 3. Performance & Responsiveness

### 3.1 Client App Performance (SOMI Home)
- **Today tab** should render in ≤1 second after data is available.
- Exercise completion actions must feel instantaneous (optimistic UI allowed).
- Video playback should start within reasonable streaming latency for HLS.
- Uploads must support background operation and retry on connectivity loss.

### 3.2 Clinic App Performance (SOMI Clinic)
- Patient search results should return in ≤2 seconds.
- Exercise library filtering/search should feel near-instant for typical datasets.
- Publishing a plan should reflect on client devices within 60 seconds (or on refresh).

### 3.3 Backend Performance (SOMI Connect)
- API endpoints should target p95 latency under 500ms for non-media requests.
- Media upload/download performance is delegated to object storage via signed URLs.

---

## 4. Reliability & Availability

### 4.1 Availability Targets
- Backend services should target **99.9% uptime**.
- Client apps must handle temporary backend outages gracefully:
  - show cached data where possible
  - queue actions for retry

### 4.2 Failure Handling
- Exercise completion events must be idempotent.
- Upload workflows must support resumable or retryable behavior.
- Messaging failures must be recoverable without data loss.

---

## 5. Data Consistency & Integrity

### 5.1 Exercise Completion Semantics
- Exercises are completed **per routine** (e.g., morning / afternoon / evening).
- Completion is binary per exercise per routine (no partial credit).
- Multiple completions of the same exercise on the same day must be tracked distinctly by routine.

### 5.2 Versioning Rules
- Exercises are versioned.
- Treatment plans reference a specific exercise version.
- Therapists may explicitly upgrade plans to newer exercise versions.
- Historical data must always reference the version active at the time of completion.

---

## 6. Scalability & Growth

- The system must support:
  - growth in number of patients
  - growth in number of therapists
  - expansion to multiple clinics
- Multi-tenant support must be possible without major architectural change.
- Heavy read paths (Today view, adherence summaries) must be optimizable independently.

---

## 7. Observability & Monitoring

### 7.1 Telemetry (Datadog)
All repos must emit:
- structured logs (no PHI)
- metrics (latency, error rate, upload success rate)
- distributed traces

### 7.2 Dashboards
At minimum:
- API health and error rates
- media upload success/failure
- message delivery health
- exercise completion ingestion rate

### 7.3 Alerts
Alerts must trigger on:
- elevated error rates
- sustained latency breaches
- authentication anomalies
- upload pipeline failures

---

## 8. CI/CD & Quality Gates

### 8.1 Testing Requirements
All repos must include:
- unit tests for core logic
- integration tests for backend services
- contract tests for REST APIs
- Playwright end-to-end tests driven by an AI agent for:
  - SOMI Home critical flows
  - SOMI Clinic critical flows

### 8.2 Deployment Pipeline
- Automated deployments:
  - Staging from `main`
  - Production from release branches
- Feature flags must be used for incomplete features.
- Rollback must be possible without data corruption.

---

## 9. Vendor & Dependency Constraints

- Any vendor handling PHI must:
  - sign a BAA
  - meet HIPAA security requirements
- Vendor lock-in should be minimized where possible.
- Messaging implementation (vendor vs in-house) remains intentionally flexible at this stage.

---

## 10. Non-Goals (Explicit)

- Real-time guarantees for messaging.
- Offline video playback.
- Client-visible clinical notes.
- Automated clinical decision-making.

---

## 11. Definition of Done (Non-Functional)

The system is considered compliant with this document when:
- Security controls are enforced and audited.
- Performance targets are met under normal load.
- CI/CD pipelines enforce testing gates.
- Observability dashboards and alerts are live.
- No PHI appears in logs, notifications, or non-secure channels.

