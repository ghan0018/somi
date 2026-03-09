# 06 – Telemetry & Observability Requirements (SOMI Treatment)

> **Scope**
> Defines the observability strategy for:
> - **SOMI Connect** (Backend REST API)
> - **SOMI Clinic** (Therapist/Admin web app)
> - **SOMI Home** (iOS & Android — deferred; placeholder requirements included)
>
> **Platform**: Datadog (logs, metrics, traces, dashboards, alerts).
>
> **Constraint**: No PHI may appear in logs, metrics labels, trace attributes, or dashboard displays.

---

## 1. Guiding Principles

- **No PHI in telemetry** — use opaque IDs (userId, patientId, planId) only. Never log names, email addresses, message content, note text, or clinical data.
- **Correlation IDs** — every request gets a unique `correlationId` (UUID) propagated through logs, traces, and audit events.
- **Structured logging** — JSON-formatted logs with consistent field names.
- **Measure what matters** — focus on endpoints that are aggregation-heavy or user-facing-critical.
- **Alert on symptoms, not causes** — alert on elevated error rates and latency, not on individual errors.

---

## 2. Structured Logging

### 2.1 Log Format

All SOMI Connect logs must be structured JSON with the following fields:

```json
{
  "timestamp": "2025-01-15T10:30:00.000Z",
  "level": "info",
  "message": "Request completed",
  "correlationId": "abc-123-def",
  "service": "somi-connect",
  "environment": "production",
  "method": "GET",
  "path": "/v1/patients/:patientId/today",
  "statusCode": 200,
  "durationMs": 42,
  "userId": "user_abc",
  "role": "client"
}
```

### 2.2 PHI Exclusion Rules

The following must **never** appear in logs:
- Request or response bodies for PHI endpoints (plans, completions, messages, notes, feedback, timeline, patient profile)
- Patient names, email addresses, phone numbers
- Message text or note content
- Exercise completion details beyond IDs
- Attachment content or filenames containing patient info

The following **may** appear in logs:
- Opaque IDs (userId, patientId, planId, exerciseId, threadId, etc.)
- HTTP method, path template (with `:paramName` placeholders, not actual IDs in path), status code, duration
- Error types and error codes (not error details that contain PHI)
- Correlation IDs

### 2.3 Log Levels

| Level | Usage |
|---|---|
| `error` | Unhandled exceptions, 5xx responses, external service failures |
| `warn` | Validation failures (4xx), rate limiting, deprecated usage |
| `info` | Request start/end, significant state transitions (plan published, upload completed) |
| `debug` | Detailed internal flow (disabled in production by default) |

### 2.4 Request Logging

- Log every request at `info` level with: method, path template, status code, duration, correlationId, userId, role.
- Do **not** log request/response bodies for PHI endpoints.
- Non-PHI endpoints (e.g., exercise library listing, healthz) may log query parameters.

---

## 3. Metrics

### 3.1 Standard Request Metrics

Emit for every API endpoint:

| Metric | Type | Tags |
|---|---|---|
| `http.request.duration` | histogram | `method`, `path_template`, `status_code`, `environment` |
| `http.request.count` | counter | `method`, `path_template`, `status_code`, `environment` |
| `http.error.count` | counter | `method`, `path_template`, `error_code`, `environment` |

### 3.2 Aggregation-Heavy Endpoint Metrics

These endpoints compute results across collections and require dedicated monitoring:

#### Today View (`GET /v1/patients/:patientId/today`)
| Metric | Type | Notes |
|---|---|---|
| `today_view.duration_ms` | histogram | Total endpoint latency |
| `today_view.plan_query_ms` | histogram | Time to fetch plan |
| `today_view.completions_query_ms` | histogram | Time to fetch completions |
| `today_view.merge_ms` | histogram | Time to merge plan + completions |

#### Adherence (`GET /v1/patients/:patientId/adherence`)
| Metric | Type | Notes |
|---|---|---|
| `adherence.duration_ms` | histogram | Total endpoint latency |
| `adherence.completions_scanned` | histogram | Number of completion docs queried |
| `adherence.plan_sessions_scanned` | histogram | Number of plan sessions evaluated |

#### Timeline (`GET /v1/patients/:patientId/timeline`)
| Metric | Type | Notes |
|---|---|---|
| `timeline.duration_ms` | histogram | Total endpoint latency |
| `timeline.collections_queried` | gauge | Number of collections hit |
| `timeline.records_fetched` | histogram | Total records fetched before merge |
| `timeline.merge_sort_ms` | histogram | Time spent merging and sorting |

### 3.3 Business Metrics

| Metric | Type | Notes |
|---|---|---|
| `completions.created` | counter | Completion events ingested |
| `uploads.started` | counter | Upload flows initiated |
| `uploads.completed` | counter | Upload flows finalized successfully |
| `uploads.failed` | counter | Upload flows that failed or timed out |
| `messages.sent` | counter | Messages created (tagged by sender role) |
| `plans.published` | counter | Treatment plans published |
| `auth.login.success` | counter | Successful logins |
| `auth.login.failure` | counter | Failed login attempts |
| `auth.mfa.failure` | counter | Failed MFA verifications |

### 3.4 Infrastructure Metrics

Captured automatically by Datadog integrations:
- ECS Fargate: CPU, memory, task count, restarts
- MongoDB Atlas: connections, query latency, opcounters, replication lag
- ALB: request count, target response time, 4xx/5xx rates, active connections
- S3: request count, errors, bytes transferred
- CloudFront: cache hit rate, origin latency, error rates

---

## 4. Distributed Tracing

### 4.1 Trace Propagation

- Use Datadog APM with `dd-trace` Node.js library.
- Propagate trace context via standard headers (`x-datadog-trace-id`, `x-datadog-parent-id`).
- Correlate logs with traces via `dd.trace_id` and `dd.span_id` in log output.

### 4.2 Span Structure

Key spans per request:
- `http.request` — top-level span (method, path, status)
- `mongodb.query` — auto-instrumented by dd-trace for Mongoose operations
- `s3.presign` — custom span for signed URL generation
- `auth.verify` — custom span for JWT verification + RBAC check
- `adherence.compute` — custom span for adherence calculation
- `timeline.merge` — custom span for timeline merge/sort logic

### 4.3 Sensitive Data

- Do not attach PHI as span tags or trace attributes.
- Resource names should use path templates (`:patientId`) not actual IDs.

---

## 5. Dashboards

### 5.1 API Health Dashboard

- Request rate (by endpoint, by status code family)
- p50 / p95 / p99 latency (by endpoint)
- Error rate (5xx and 4xx separately)
- Active ECS task count
- MongoDB connection pool utilization

### 5.2 Upload Pipeline Dashboard

- Upload start rate vs. completion rate
- Upload failure rate and failure reasons
- Average upload duration (start → complete)
- S3 error rates

### 5.3 Message Delivery Dashboard

- Messages sent per hour (by sender role)
- Thread creation rate
- Attachment upload rate

### 5.4 Adherence & Progress Dashboard

- Adherence endpoint latency (p50/p95)
- Completion ingestion rate
- Completions per patient per day distribution
- Today View endpoint latency

### 5.5 Auth & Security Dashboard

- Login success/failure rates
- MFA verification failure rate
- Failed authorization attempts (403 responses)
- Rate limiting trigger rate

---

## 6. Alerts

### 6.1 Critical Alerts (Page)

| Condition | Threshold | Window |
|---|---|---|
| 5xx error rate elevated | > 5% of requests | 5 min |
| API p95 latency sustained | > 2 seconds | 5 min |
| ECS task count at 0 | Any task group has 0 running tasks | 1 min |
| MongoDB connection failures | > 0 per minute sustained | 3 min |
| Auth failure spike | > 50 failed logins in window | 5 min |

### 6.2 Warning Alerts (Notify)

| Condition | Threshold | Window |
|---|---|---|
| 4xx error rate elevated | > 20% of requests | 10 min |
| Adherence endpoint latency | p95 > 1 second | 10 min |
| Timeline endpoint latency | p95 > 1 second | 10 min |
| Upload failure rate elevated | > 10% of started uploads | 15 min |
| ECS CPU utilization high | > 80% average | 10 min |

### 6.3 Informational Alerts

| Condition | Notes |
|---|---|
| Deployment completed | Notification on staging/production deploys |
| Feature flag toggled | Track feature flag changes |
| Completion ingestion rate drops to 0 | May indicate client-side issue |

---

## 7. Client-Side Telemetry (SOMI Clinic)

### 7.1 Browser Metrics

- Page load time (LCP, FID, CLS — Core Web Vitals)
- API call latency from browser perspective
- JavaScript error tracking (Datadog RUM or equivalent)
- Route navigation timing

### 7.2 Key User Flows to Instrument

- Login → dashboard load time
- Patient search → results rendered
- Plan editor → save/publish latency
- Exercise library search → results rendered
- Message send → confirmation

### 7.3 PHI in Client Logs

- Same rules apply: no PHI in client-side telemetry.
- Datadog RUM must be configured to scrub sensitive fields.
- Do not capture DOM snapshots of PHI-containing views.

---

## 8. SOMI Home Telemetry (Deferred — Placeholder)

When mobile apps are built:
- Datadog Mobile SDK for iOS/Android
- Metrics: app launch time, Today View render time, video playback start time, upload duration, offline sync latency
- Crash reporting integration
- Same PHI exclusion rules

---

## 9. Definition of Done (Telemetry)

This document is satisfied when:
- All API requests emit structured JSON logs with correlationId and no PHI.
- Standard request metrics (duration, count, error count) are emitted for all endpoints.
- Aggregation-heavy endpoints (Today View, Adherence, Timeline) emit dedicated query performance metrics.
- Distributed tracing is active with MongoDB and custom spans.
- All five dashboards are live in Datadog.
- Critical and warning alerts are configured and routed to the on-call channel.
- No PHI appears in any telemetry output (logs, metrics tags, trace attributes, dashboard displays).
