# SOMI — Speech, Ortho-Airway, Myofunctional Integration

## Project Structure

Monorepo with npm workspaces:

```
services/somi-connect/     Express + MongoDB backend (REST API)
apps/somi-clinic-web/      React + Vite + Ant Design v6 frontend
requirements/              Product & technical requirements docs
```

## Tech Stack

**Backend:** Node 20, Express, Mongoose/MongoDB, JWT auth, AWS S3 (media uploads)
**Frontend:** React 18, Vite, Ant Design v6, React Router v6, TypeScript
**Testing:** Backend: jest + supertest + mongodb-memory-server. Frontend: vitest + @testing-library/react, dual-viewport (1280px + 375px)

## Auth & Roles

- JWT: access token (1hr) + refresh token (7 days), stored in localStorage
- Roles: `client | therapist | admin`
- Therapists: **read-only** access to exercises (API + UI enforced)
- Therapists: **full access** to all patients in the clinic (no ownership restriction)
- Exercise write operations (create/edit/archive/restore): **admin-only**
- `authorize()` middleware in Express for route-level role checks
- `useAuth()` hook in React for UI-level role checks

## Design Conventions

- Brand palette: navy `#1B3A4B`, teal `#6DB6B0`, gold `#D4A843`
- Tag category colors: function (teal `#EAF5F4`/`#2C7A7B`), structure (slate `#E8EEF1`/`#1B3A4B`), age (gold `#F5EFE0`/`#9E7C2E`)
- Reusable UI components: `PageHeader`, `SectionCard`, `StatusTag`, `DataTable`, `FormModal`, `EmptyState`, `StatCard`, `VideoUpload`

## Key File Locations

### Backend (`services/somi-connect/src/`)
- `routes/` — Express routers (auth, patient, exercise, plan, timeline, messaging, etc.)
- `services/` — Business logic (one service per domain)
- `models/` — Mongoose schemas
- `middleware/` — authenticate, authorize, errorHandler, auditLog, rateLimiter
- `lib/` — Shared utilities (db, errors, logger, s3)
- `config/env.ts` — Environment variable schema with validation
- `__tests__/` — Integration tests (jest + supertest + mongodb-memory-server)

### Frontend (`apps/somi-clinic-web/src/`)
- `pages/` — Route-level page components
- `components/` — Reusable UI components
- `api/` — API client functions (one file per domain)
- `contexts/AuthContext.tsx` — Auth state management
- `hooks/` — Custom hooks (useIsMobile)
- `types/index.ts` — Shared TypeScript types
- `pages/__tests__/` — Page-level tests (vitest + @testing-library/react)
- `components/__tests__/` — Component tests

## Coding Conventions

- TypeScript strict mode, ESLint with `@typescript-eslint/recommended`
- Backend lint: `npm run lint -w somi-connect`
- Frontend lint: `npm run lint -w somi-clinic-web`
- Backend tests: `npm test -w somi-connect`
- Frontend tests: `npm test -w somi-clinic-web` (runs at both 1280px and 375px viewports)
- Prefix unused variables with `_` (ESLint `argsIgnorePattern: '^_'`)
- API routes: `readAuth` (therapist+admin) vs `writeAuth` (admin-only) pattern for role-based access

## Testing Rules

- **When adding UI behavior (modals, confirmations, toggles), always add dedicated tests** — don't just update existing tests to work around the new behavior
- For confirmation modals: test modal appears, cancel does NOT trigger action, confirm DOES trigger action
- Ant Design `Modal.confirm` renders duplicate DOM nodes — use `getAllByText` and `document.querySelector('.ant-modal-confirm-content')` instead of `getByText`
- For pages with breadcrumbs: use `getByRole('heading', { name: /text/i })` to avoid "Found multiple elements" errors
- Use mutable auth mock pattern (see existing tests) to test both admin and therapist views in one suite

## Agent Team File Ownership

When working as an agent team, respect these boundaries to avoid file conflicts:

| Teammate | Can write | Read only |
|---|---|---|
| **UX Designer** | Design docs and specs only | All source code |
| **Architect** | `services/somi-connect/src/` (non-test), `apps/somi-clinic-web/src/` (non-test) | Everything |
| **QA Engineer** | `**/__tests__/**`, `**/*.test.*` files only | All source code |

Architect must NOT write test files. QA Engineer must NOT write implementation code. This prevents merge conflicts.

## Acceptance Testing Patterns

When building features, proactively check for these common gaps BEFORE the user does acceptance testing:

### Empty states
- Every data-fetching component must handle: loading, empty (no data), error, and populated states
- Backend 404 for "not found" is different from "no data yet" — frontend must distinguish both
- Write tests for each state

### Form UX
- Input labels must be permanently visible (not placeholder-only) — use labels above inputs
- If a resource has media (video/image), provide inline preview capabilities in any builder/editor UI
- Number inputs should always show their unit (reps, sets, seconds, etc.)

### Data reuse
- Don't globally exclude items that should be reusable in different contexts (e.g., exercises across sessions)
- Scope exclusion lists to the narrowest applicable context

### Discoverability
- Features with non-obvious behavior need tooltips or help text (e.g., reminders toggle)
- New/unfamiliar UI patterns need onboarding affordances

### Workflow completeness
- If a resource has status transitions (draft → published → archived), consider:
  - Can each status be reached from every other relevant status? (e.g., published → draft for editing)
  - What is the "current" state indicator? (e.g., active session in a multi-session plan)
  - Can the user advance/progress through stages?
- Trace the full lifecycle: create → edit → publish → modify → archive → recreate

### Requirements cross-check
- Before marking a feature complete, re-read the requirements docs in `requirements/` and verify every capability is implemented
- Check for implied features: if a plan has sessions, there must be a way to track which session is active

## Build & Run

```bash
npm ci                              # Install all workspace dependencies
npm run dev -w somi-connect         # Backend dev server (port 3000)
npm run dev -w somi-clinic-web      # Frontend dev server (port 5173)
npm run build -w somi-connect       # Backend build (tsc)
npm run build -w somi-clinic-web    # Frontend build (tsc --noEmit && vite build)
npm run typecheck -w somi-connect   # Backend type check
npm run typecheck -w somi-clinic-web # Frontend type check
```
