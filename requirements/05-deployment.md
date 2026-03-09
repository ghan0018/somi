# 05 – Deployment & Infrastructure Requirements (SOMI Treatment)

> **Scope**
> Defines the deployment pipeline, infrastructure, environment strategy, and operational requirements for:
> - **SOMI Home** (iOS & Android — deferred; included here for completeness)
> - **SOMI Clinic** (Therapist/Admin web app)
> - **SOMI Connect** (Backend REST API)
>
> This document is the authoritative reference for CI/CD, hosting, secrets, and release management.

---

## 1. Environments

### 1.1 Environment Definitions

| Environment | Purpose | Deploy trigger | Data |
|---|---|---|---|
| **Staging** | Integration testing, QA, demo | Auto-deploy from `main` | Synthetic only |
| **Production** | Live traffic | Auto-deploy from release branches | Real patient data (PHI) |

- No shared "dev" environment. Developers run services locally against local or ephemeral MongoDB instances.
- Staging and production are fully isolated — separate AWS accounts (or at minimum separate VPCs), separate MongoDB Atlas clusters, separate secrets.

### 1.2 Environment Parity

- Staging must mirror production configuration as closely as possible: same Docker images, same environment variable shape, same MongoDB version, same S3 bucket policies.
- Differences limited to: secret values, domain names, scaling parameters, feature flag overrides.

---

## 2. Cloud Infrastructure (AWS)

### 2.1 Compute

| Component | Service | Notes |
|---|---|---|
| SOMI Connect (API) | AWS ECS Fargate | Containerized Node.js; auto-scaling on CPU/memory |
| SOMI Clinic (Web) | AWS S3 + CloudFront | Static SPA hosting; CDN for global edge delivery |

- SOMI Connect runs as a stateless container behind an Application Load Balancer (ALB).
- ALB handles TLS termination (ACM-managed certificates).
- Fargate tasks run in private subnets; ALB in public subnets.

### 2.2 Database

| Component | Service | Notes |
|---|---|---|
| MongoDB | MongoDB Atlas (AWS-hosted) | HIPAA-eligible tier; BAA signed; encryption at rest + in transit |

- Atlas cluster hosted in the same AWS region as ECS tasks to minimize latency.
- Dedicated clusters per environment (staging, production).
- Automated backups with point-in-time recovery enabled.
- Network access restricted to VPC peering from the ECS VPC.

### 2.3 Object Storage (Media)

| Bucket | Content | Classification |
|---|---|---|
| `somi-library-media-{env}` | Exercise VOD demos | Non-PHI |
| `somi-patient-media-{env}` | Patient uploads, therapist feedback videos | PHI |

- All buckets: encryption at rest (SSE-S3 or SSE-KMS), versioning enabled, public access blocked.
- PHI bucket: additional access logging enabled; lifecycle rules for compliance retention.
- Media served via CloudFront with signed URLs (short-lived, generated server-side after authorization).
- CORS configured to allow uploads from SOMI Clinic and SOMI Home origins.

### 2.4 CDN

- CloudFront distributions:
  - **SOMI Clinic SPA**: static assets with cache headers.
  - **Library media**: exercise demo VODs (non-PHI, longer cache TTL).
  - **Patient media**: signed URLs only, no public caching.

### 2.5 Email

- AWS SES for transactional email (password reset, MFA codes, account invitations).
- No PHI in email subject lines or bodies.
- Verified sender domain with SPF/DKIM/DMARC.

### 2.6 Secrets Management

- AWS Secrets Manager for all secrets (database credentials, JWT signing keys, S3 access keys, SES credentials, third-party API keys).
- Separate secrets per environment.
- No secrets committed to code repositories — enforced by secret scanning in CI.
- Secrets rotated periodically and immediately on suspected compromise.
- Application reads secrets at startup (not baked into images).

### 2.7 Networking

- VPC per environment with public and private subnets across 2+ AZs.
- ECS tasks in private subnets; NAT gateway for outbound internet (Atlas, SES, Datadog).
- ALB in public subnets with HTTPS only (HTTP redirects to HTTPS).
- Security groups: ALB → ECS on application port only; ECS → Atlas via VPC peering; ECS → S3 via VPC endpoint.

---

## 3. CI/CD Pipeline

### 3.1 Pipeline Stages

```
Push to main or PR:

  ┌─────────┐    ┌────────────┐    ┌───────────────┐    ┌───────┐    ┌───────────────────┐    ┌─────────────┐
  │  Lint    │ →  │ Unit Tests │ →  │ Contract Tests│ →  │ Build │ →  │ Integration Tests │ →  │  Deploy     │
  │          │    │            │    │ (OpenAPI)     │    │       │    │ (against test DB) │    │ (staging)   │
  └─────────┘    └────────────┘    └───────────────┘    └───────┘    └───────────────────┘    └─────────────┘
```

- **Lint**: ESLint + Prettier for TypeScript; type-checking (`tsc --noEmit`).
- **Unit Tests**: Jest; covers business logic, utilities, and service layer.
- **Contract Tests**: Validate API responses against OpenAPI spec.
- **Build**: Docker image build for SOMI Connect; Vite production build for SOMI Clinic.
- **Integration Tests**: SOMI Connect against ephemeral MongoDB (mongodb-memory-server or testcontainers).
- **Deploy**: Auto-deploy to staging on merge to `main`.

### 3.2 Production Deploys

- Production deployments triggered by merging/tagging a release branch (e.g., `release/1.2.0`).
- Same pipeline stages run against the release branch before deploy.
- Deploy to production requires pipeline green — no manual bypasses.

### 3.3 Pull Request Checks

- All pipeline stages (lint through integration tests) run on every PR.
- PRs require passing checks before merge.
- PRs require at least one approval (policy, not tooling-enforced for MVP).

### 3.4 CI Platform

- GitHub Actions (preferred) or equivalent.
- Workflows defined in `.github/workflows/`.
- Separate workflows for SOMI Connect and SOMI Clinic to allow independent deploy cadence.

---

## 4. Container Strategy (SOMI Connect)

### 4.1 Docker Image

- Multi-stage build: build stage (install deps, compile TypeScript) → production stage (Node.js Alpine, compiled JS only).
- Non-root user inside container.
- Health check endpoint (`GET /healthz`) for ALB and ECS health probes.
- Image tagged with git SHA and semantic version.

### 4.2 ECS Task Definition

- CPU/memory sized for expected load (start small: 0.5 vCPU / 1 GB; scale based on metrics).
- Environment variables injected from Secrets Manager and SSM Parameter Store.
- Log driver: `awslogs` → CloudWatch (forwarded to Datadog).
- Graceful shutdown: handle SIGTERM, drain in-flight requests.

### 4.3 Auto-Scaling

- ECS Service auto-scaling on CPU utilization (target: 60%).
- Minimum 2 tasks in production for availability.
- Minimum 1 task in staging.

---

## 5. Static Hosting (SOMI Clinic)

- Vite production build output deployed to S3.
- CloudFront distribution with:
  - Default root object: `index.html`.
  - SPA routing: custom error response returning `index.html` for 403/404.
  - Cache-Control: hashed assets get long TTL; `index.html` gets short TTL or `no-cache`.
- Deploy: sync build output to S3; invalidate CloudFront distribution.

---

## 6. Release Management

### 6.1 Branching Strategy

- `main` → always deployable to staging.
- Feature branches → PR to `main`.
- `release/*` branches → cut from `main` when ready for production.
- Hotfix branches → PR to `release/*` and back-merged to `main`.

### 6.2 Feature Flags

- Incomplete or experimental features must be behind feature flags.
- Feature flags stored in application config (environment variables or a simple flags collection in MongoDB).
- No feature-flag SaaS vendor required for MVP.

### 6.3 Rollback

- ECS: rollback by redeploying the previous task definition revision (previous Docker image).
- SOMI Clinic: rollback by redeploying the previous S3 build + CloudFront invalidation.
- Rollbacks must not cause data corruption — database migrations must be backward-compatible (additive only; no destructive migrations without a deprecation window).
- MongoDB schema changes must be additive (new fields with defaults, not renames or removals of active fields).

---

## 7. Database Operations

### 7.1 Migrations

- Schema changes applied via migration scripts (run at deploy time or via a separate migration step).
- Migrations must be idempotent and backward-compatible.
- Index creation must use `background: true` for production.

### 7.2 Backups

- MongoDB Atlas continuous backups with point-in-time recovery.
- Backup retention per Atlas tier defaults (minimum 7 days for staging, 30 days for production).
- Restore procedures documented and tested periodically.

### 7.3 Connection Management

- Connection pooling via Mongoose defaults (tuned if needed based on Datadog metrics).
- Read preference: `primaryPreferred` for most queries; `primary` for writes.
- Connection string stored in Secrets Manager.

---

## 8. Domain & TLS

- Custom domains for:
  - `api.somi.health` (or similar) → ALB → SOMI Connect
  - `clinic.somi.health` → CloudFront → SOMI Clinic SPA
- TLS certificates managed by AWS ACM (auto-renewing).
- HSTS headers enforced.
- Staging uses separate subdomains (e.g., `api.staging.somi.health`).

---

## 9. Security Hardening

- **Container scanning**: Docker images scanned for vulnerabilities in CI (e.g., Trivy or Snyk).
- **Dependency scanning**: `npm audit` or equivalent in CI pipeline.
- **Secret scanning**: Pre-commit hooks or CI checks to prevent secrets in code.
- **WAF**: AWS WAF on ALB for rate limiting and common attack patterns (optional for MVP; recommended for production).
- **Least privilege IAM**: ECS task roles scoped to specific S3 buckets, SES, Secrets Manager — no wildcard policies.

---

## 10. Definition of Done (Deployment)

This document is satisfied when:
- Staging and production environments are isolated with separate secrets and databases.
- CI/CD pipeline enforces lint, test, and build gates before deploy.
- Staging auto-deploys from `main`; production deploys from release branches.
- Rollback is possible without data corruption.
- No secrets are committed to code repositories.
- Container images are scanned for vulnerabilities.
- TLS is enforced on all endpoints.
- Media buckets enforce encryption at rest and signed-URL-only access.
