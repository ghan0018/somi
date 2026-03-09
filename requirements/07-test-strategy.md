# 07 – Test Strategy (SOMI Treatment)

> **Scope**
> Defines the testing approach, coverage expectations, and quality gates for:
> - **SOMI Connect** (Backend REST API)
> - **SOMI Clinic** (Therapist/Admin web app)
> - **SOMI Home** (iOS & Android — deferred; placeholder included)
>
> All test environments must use **synthetic data only** — no real PHI in any test.

---

## 1. Testing Layers

```
                            ┌──────────────────────┐
                            │   E2E (Playwright)   │   Fewer, slower, high-confidence
                            ├──────────────────────┤
                        ┌───┤  Integration Tests   ├───┐
                        │   ├──────────────────────┤   │
                    ┌───┤   │   Contract Tests     │   ├───┐
                    │   │   ├──────────────────────┤   │   │
                ┌───┤   │   │    Unit Tests        │   │   ├───┐   More, faster, focused
                └───┘   └───┘──────────────────────└───┘   └───┘
```

Each layer has distinct responsibilities. Tests at lower layers run faster and catch issues earlier.

---

## 2. Unit Tests

### 2.1 SOMI Connect

**Framework**: Jest + ts-jest

**What to test**:
- Service layer business logic (plan publishing rules, exercise version propagation, adherence calculation, completion idempotency, parameter merging)
- Utility functions (date handling, pagination helpers, error formatting)
- RBAC authorization logic (role checks, patient relationship checks)
- Input validation (request schema validation)
- Audit event construction

**What NOT to unit test**:
- Express route wiring (covered by integration tests)
- Mongoose model definitions (covered by integration tests)
- Third-party library internals

**Coverage target**: ≥ 80% line coverage on service layer files.

### 2.2 SOMI Clinic

**Framework**: Vitest + React Testing Library

**What to test**:
- Component rendering and interaction (form inputs, button clicks, state changes)
- Custom hooks (data fetching, form state, authentication context)
- Utility functions (date formatting, adherence percentage calculation, parameter display)
- Conditional rendering (role-based UI, empty states, loading states, error states)

**What NOT to unit test**:
- CSS styling details (use visual/E2E tests)
- Third-party component internals (e.g., video player library)

**Coverage target**: ≥ 70% line coverage on components and hooks.

---

## 3. Integration Tests (SOMI Connect)

### 3.1 Approach

- Test full request → response cycle through Express routes with a real MongoDB instance.
- Use **mongodb-memory-server** (in-process ephemeral MongoDB) for fast, isolated test runs.
- Each test suite gets a clean database (drop collections in `beforeEach` or use unique database names).

### 3.2 What to Test

For each endpoint group, test:

| Area | Example tests |
|---|---|
| **Auth** | Login returns tokens; invalid credentials return 401; MFA flow works; refresh token rotation |
| **Exercise Library** | CRUD cycle; edit creates new version; archive prevents new assignments; search/filter returns correct results |
| **Treatment Plans** | Create draft → add sessions/routines/assignments → publish; exercise version auto-propagation to draft/published but not archived |
| **Today View** | Returns merged assignments + completion state; handles missing completions; respects published plan only |
| **Completions** | Idempotent creation; uniqueness constraint enforced; rejects duplicate with same key |
| **Adherence** | Correct percentage calculation over date range; handles zero-completion periods; handles plans with varying session sizes |
| **Timeline** | Pagination works; type filtering; client view excludes notes; therapist view includes notes |
| **Messaging** | Thread creation; message ordering; attachment references |
| **Uploads** | Pre-signed URL generation (mock S3); complete marks upload available |
| **RBAC** | Client cannot access other patients; therapist cannot access unassigned patients; admin-only endpoints reject therapist/client |

### 3.3 Test Database Seeding

- Reusable seed factories for creating test entities (users, patients, exercises, plans, completions).
- Factories produce valid documents that match Mongoose schemas.
- Example: `createTestPlan({ patientId, sessions: 3, routinesPerSession: 2, assignmentsPerRoutine: 4 })`.

### 3.4 External Service Mocking

- **S3**: Mock `@aws-sdk/client-s3` — return fake pre-signed URLs, simulate upload success/failure.
- **SES**: Mock email sending — verify correct templates/recipients without sending.
- **Datadog**: Mock metrics emission — verify correct metric names and tags.

---

## 4. Contract Tests

### 4.1 Purpose

Verify that SOMI Connect API responses conform to the OpenAPI specification, and that SOMI Clinic API calls match expected request shapes.

### 4.2 OpenAPI Spec

- Maintain a single `openapi.yaml` (or generated from code annotations) as the contract source of truth.
- Located at `services/somi-connect/openapi.yaml`.

### 4.3 Server-Side Contract Tests

- After integration tests produce responses, validate response bodies against OpenAPI response schemas.
- Use a library like `jest-openapi` or custom schema validation.
- Ensures API doesn't drift from the documented contract.

### 4.4 Client-Side Contract Tests

- SOMI Clinic API client (e.g., generated types from OpenAPI) is validated against the same spec.
- TypeScript compilation catches type mismatches if API types are generated from OpenAPI.
- Optional: MSW (Mock Service Worker) tests verify that frontend code handles expected response shapes.

---

## 5. End-to-End Tests (Playwright)

### 5.1 Framework

- **Playwright** with TypeScript.
- Tests run against staging environment (or a dedicated E2E environment with synthetic data).

### 5.2 SOMI Clinic Critical Flows

| Flow | Steps |
|---|---|
| **Login + MFA** | Navigate to login → enter credentials → complete MFA → verify dashboard loads |
| **Exercise Library CRUD** | Create exercise with VOD → search for it → edit (verify new version) → archive → verify not assignable |
| **Create & Publish Plan** | Open patient → create plan → add sessions → add exercises → set parameters → save draft → publish → verify client-visible |
| **Review Patient Progress** | Open patient → Progress tab → verify adherence display → verify completion history |
| **Review Upload & Leave Feedback** | Navigate to patient upload → play video → leave feedback → verify feedback appears |
| **Search Exercises** | Filter by Function → filter by Age → text search → verify results |
| **Messaging** | Open patient messages → send text message → send attachment → verify delivery |
| **Admin: Invite Therapist** | Admin login → invite therapist → verify account created |

### 5.3 SOMI Home Critical Flows (Deferred)

When mobile apps are built:
- Login → Today tab loads → mark exercise complete → verify state persists
- Upload practice video → verify upload completes
- Send/receive message → verify message appears

### 5.4 Test Data Management

- E2E tests use dedicated synthetic test accounts.
- Test data seeded via API calls in test setup (not shared mutable state).
- Tests clean up after themselves where possible; otherwise, a periodic cleanup job resets the E2E dataset.

### 5.5 AI-Assisted E2E (Future)

- Per requirements doc 01/02: Playwright E2E with AI agent.
- AI agent can handle dynamic UI, recover from flaky selectors, and test exploratory paths.
- Implementation deferred to post-MVP stabilization.

---

## 6. Security Testing

### 6.1 Dependency Scanning

- `npm audit` runs in CI for every PR and deploy.
- Critical/high vulnerabilities block the pipeline.
- Weekly automated dependency update PRs (Dependabot or Renovate).

### 6.2 Secret Scanning

- Pre-commit hook (or CI check) scans for secrets, API keys, and credentials in code.
- Tools: `gitleaks`, `trufflehog`, or GitHub secret scanning.
- Any detected secret blocks the PR.

### 6.3 Container Image Scanning

- Docker images scanned for OS and library vulnerabilities before push to registry.
- Tools: Trivy (in CI) or ECR native scanning.
- Critical vulnerabilities block deployment.

### 6.4 OWASP Baseline

- Review API implementation against OWASP Top 10:
  - Injection (parameterized queries via Mongoose)
  - Broken authentication (JWT validation, MFA enforcement)
  - Sensitive data exposure (PHI encryption, signed URLs)
  - Broken access control (RBAC integration tests)
  - Security misconfiguration (security headers, CORS)
  - XSS (React escapes by default; CSP headers for Clinic)

---

## 7. Performance Testing (Lightweight)

### 7.1 Approach

- Not a formal load testing requirement for MVP.
- Monitor production latency via Datadog (see doc 06).
- If adherence, timeline, or Today View endpoints show p95 > 500ms in production, add targeted load tests.

### 7.2 Baseline Benchmarks

- Integration tests for aggregation-heavy endpoints should assert response time under reasonable limits (e.g., < 500ms for a plan with 12 sessions × 3 routines × 5 assignments).
- These serve as regression guards, not formal SLA tests.

---

## 8. Test Data Requirements

### 8.1 Synthetic Data Only

- **No real patient data** in any test environment (staging, CI, E2E).
- Test data generators produce realistic but entirely fictional data.
- PHI-like fields (names, messages) use obviously fake values (e.g., "Test Patient Alpha", "This is a test message").

### 8.2 Seed Data Scenarios

Maintain seed scripts that create:
- 1 admin user, 2 therapist users, 5 patient users
- 10 exercises with 2 versions each
- 3 patients with published plans (varying session counts)
- Completion events spanning 30 days (varying adherence rates)
- Message threads with sample conversations
- Upload records in various states (pending, available, failed)

---

## 9. Quality Gates (CI Pipeline)

Every PR and deploy must pass:

| Gate | Requirement |
|---|---|
| Lint | Zero errors (warnings allowed but tracked) |
| Type check | `tsc --noEmit` passes |
| Unit tests | All pass; coverage ≥ thresholds |
| Contract tests | API responses match OpenAPI spec |
| Integration tests | All pass against ephemeral MongoDB |
| Security scans | No critical/high vulnerabilities |
| Build | Docker image and/or Vite build succeeds |

E2E tests run post-deploy on staging (not blocking PR merge, but blocking production promotion).

---

## 10. Definition of Done (Test Strategy)

This document is satisfied when:
- Unit tests exist for service-layer business logic with ≥ 80% coverage (Connect) and ≥ 70% coverage (Clinic).
- Integration tests cover all endpoint groups against ephemeral MongoDB.
- Contract tests validate API responses against OpenAPI spec.
- Playwright E2E tests cover all critical SOMI Clinic flows.
- Security scanning (deps, secrets, container images) runs in CI and blocks on critical findings.
- All test environments use synthetic data only.
- Quality gates are enforced in the CI pipeline.
