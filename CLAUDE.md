# SOMI — Speech, Ortho-Airway, Myofunctional Integration

## Project Structure

Monorepo with npm workspaces (web) and native mobile apps:

```
services/somi-connect/     Express + MongoDB backend (REST API)
apps/somi-clinic-web/      React + Vite + Ant Design v6 (therapist/admin web app)
apps/somi-home-ios/        Native Swift iOS client (patient-facing)
apps/somi-home-android/    Native Kotlin Android client (patient-facing)
requirements/              Product & technical requirements docs
REQUIREMENTS.md            Active work intake backlog (Team Lead reads this)
LESSONS_LEARNED.md         Failure log and rule staging area (Team Lead reads this)
```

## Tech Stack

**Backend:** Node 20, Express, Mongoose/MongoDB, JWT auth, AWS S3 (media uploads)
**Web Frontend:** React 18, Vite, Ant Design v6, React Router v6, TypeScript
**iOS:** Native Swift, iOS 17+, MVVM + `@MainActor` ViewModels, URLSession async/await, Core Data (offline queue), JWT in Keychain, XcodeGen, XCTest
**Android:** Kotlin, Jetpack Compose, Material 3, MVVM + Hilt DI, Retrofit + Moshi, Room (offline queue), WorkManager, ExoPlayer, EncryptedSharedPreferences, JUnit4 + Espresso

**Testing:**
- Backend: jest + supertest + mongodb-memory-server
- Web: vitest + @testing-library/react, dual-viewport (1280px + 375px)
- iOS: XCTest unit tests in `SOMIHomeTests/`; XCUITest for E2E UI
- Android: JUnit4 unit tests in `src/test/`; Espresso instrumented tests in `src/androidTest/`

## Auth & Roles

- JWT: access token (1hr) + refresh token (7 days), stored in localStorage (web) / Keychain (iOS) / EncryptedSharedPreferences (Android)
- Roles: `client | therapist | admin`
- Therapists: **read-only** access to exercises (API + UI enforced)
- Therapists: **full access** to all patients in the clinic (no ownership restriction)
- Exercise write operations (create/edit/archive/restore): **admin-only**
- `authorize()` middleware in Express for route-level role checks
- `useAuth()` hook in React for UI-level role checks

## Design Conventions

- Brand palette: navy `#1B3A4B`, teal `#6DB6B0`, gold `#D4A843`
- Tag category colors: function (teal `#EAF5F4`/`#2C7A7B`), structure (slate `#E8EEF1`/`#1B3A4B`), age (gold `#F5EFE0`/`#9E7C2E`)
- Web reusable components: `PageHeader`, `SectionCard`, `StatusTag`, `DataTable`, `FormModal`, `EmptyState`, `StatCard`, `VideoUpload`
- iOS reusable views: `apps/somi-home-ios/SOMIHome/Shared/Views/`
- Android reusable components: `apps/somi-home-android/app/src/main/java/com/somi/home/ui/components/`

## Key File Locations

### Backend (`services/somi-connect/src/`)
- `routes/` — Express routers (auth, patient, exercise, plan, timeline, messaging, etc.)
- `services/` — Business logic (one service per domain)
- `models/` — Mongoose schemas
- `middleware/` — authenticate, authorize, errorHandler, auditLog, rateLimiter
- `lib/` — Shared utilities (db, errors, logger, s3)
- `config/env.ts` — Environment variable schema with validation
- `__tests__/` — Integration tests (jest + supertest + mongodb-memory-server)

### Web Frontend (`apps/somi-clinic-web/src/`)
- `pages/` — Route-level page components
- `components/` — Reusable UI components
- `api/` — API client functions (one file per domain)
- `contexts/AuthContext.tsx` — Auth state management
- `hooks/` — Custom hooks (useIsMobile)
- `types/index.ts` — Shared TypeScript types
- `pages/__tests__/` — Page-level tests
- `components/__tests__/` — Component tests

### iOS (`apps/somi-home-ios/`)
- `SOMIHome/App/` — App entry point
- `SOMIHome/Core/` — Auth, Models, Networking, Persistence, Sync, UI utilities
- `SOMIHome/Features/` — Auth, Messages, Plan, Profile, Today (MVVM per feature)
- `SOMIHome/Shared/Views/` — Reusable SwiftUI views
- `SOMIHomeTests/` — XCTest unit tests
- `project.yml` — XcodeGen project spec (edit this, not the .xcodeproj directly)

### Android (`apps/somi-home-android/app/src/main/java/com/somi/home/`)
- `core/` — auth, connectivity, database, models, network, sync
- `features/` — auth, messages, plan, today (MVVM per feature)
- `ui/` — components, theme (Color, Theme, Typography)
- `di/` — Hilt modules (App, Network, Database)
- `src/test/` — JUnit4 unit tests
- `src/androidTest/` — Espresso instrumented tests

## Coding Conventions

- TypeScript strict mode, ESLint with `@typescript-eslint/recommended` (backend + web)
- Swift: follow existing MVVM + `@MainActor` patterns; no third-party dependencies unless already present
- Kotlin: follow existing Hilt DI + Compose patterns; use existing modules (Retrofit, Room, etc.)
- Prefix unused variables with `_` (ESLint `argsIgnorePattern: '^_'`)
- API routes: `readAuth` (therapist+admin) vs `writeAuth` (admin-only) pattern for role-based access

## Testing Rules

- **When adding UI behavior (modals, confirmations, toggles), always add dedicated tests** — don't just update existing tests to work around the new behavior
- For confirmation modals: test modal appears, cancel does NOT trigger action, confirm DOES trigger action
- Ant Design `Modal.confirm` renders duplicate DOM nodes — use `getAllByText` and `document.querySelector('.ant-modal-confirm-content')` instead of `getByText`
- For pages with breadcrumbs: use `getByRole('heading', { name: /text/i })` to avoid "Found multiple elements" errors
- Use mutable auth mock pattern (see existing tests) to test both admin and therapist views in one suite


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
# Web
npm ci                               # Install all workspace dependencies
npm run dev -w somi-connect          # Backend dev server (port 3000)
npm run dev -w somi-clinic-web       # Frontend dev server (port 5173)
npm run build -w somi-connect        # Backend build (tsc)
npm run build -w somi-clinic-web     # Frontend build (tsc --noEmit && vite build)
npm run typecheck -w somi-connect    # Backend type check
npm run typecheck -w somi-clinic-web # Frontend type check
npm run lint -w somi-connect         # Backend lint
npm run lint -w somi-clinic-web      # Frontend lint
npm test -w somi-connect             # Backend tests
npm test -w somi-clinic-web          # Frontend tests (both viewports)

# iOS (run from repo root or apps/somi-home-ios/)
cd apps/somi-home-ios && xcodegen generate   # Regenerate .xcodeproj from project.yml
xcodebuild build -scheme SOMIHome \
  -destination 'platform=iOS Simulator,name=iPhone 16,OS=latest'
xcodebuild test -scheme SOMIHome \
  -destination 'platform=iOS Simulator,name=iPhone 16,OS=latest'

# Android (run from apps/somi-home-android/)
cd apps/somi-home-android
./gradlew assembleDebug              # Build
./gradlew lint                       # Lint
./gradlew test                       # Unit tests
./gradlew connectedAndroidTest       # Instrumented tests (requires running emulator)
```

---

## Agent Team Operating Procedure

### Roles

| Role | Responsibility | Can write |
|---|---|---|
| **Team Lead** | Session coordinator: orients, plans, asks architecture questions, delegates, validates, creates PR | `REQUIREMENTS.md`, `LESSONS_LEARNED.md`, `CLAUDE.md` (rules only) |
| **Backend Architect** | Node/Express/Mongoose implementation only (no test files) | `services/somi-connect/src/` (non-test) |
| **Web Architect** | React/Vite/Ant Design implementation only (no test files) | `apps/somi-clinic-web/src/` (non-test) |
| **iOS Architect** | Swift/SwiftUI/MVVM implementation only (no test files) | `apps/somi-home-ios/SOMIHome/`, `apps/somi-home-ios/project.yml` |
| **Android Architect** | Kotlin/Compose/Hilt implementation only (no test files) | `apps/somi-home-android/app/src/main/` |
| **QA Engineer** | All test files across all platforms, runs all validation gates | `**/__tests__/**`, `**/*.test.*`, `apps/somi-home-ios/SOMIHomeTests/`, `apps/somi-home-android/app/src/test/`, `apps/somi-home-android/app/src/androidTest/` |
| **Design Reviewer** | Phase 4 visual/consistency review against style guide using Preview tools | Read-only (reports violations to Team Lead) |
| **Clinical Advisor** | Phase 2 clinical workflow review; Phase 4 final clinical sense-check | Read-only (advisory only) |

**Hard rules — no exceptions:**
- Architect roles must NOT write test files
- QA Engineer must NOT write implementation code
- Design Reviewer and Clinical Advisor must NOT write source code
- These boundaries prevent merge conflicts and maintain role clarity

### Clinical Advisor Persona

The Clinical Advisor embodies a certified speech-language pathologist (CCC-SLP) with myofunctional therapy specialization. In Phase 2, it reviews implementation plans for clinical workflow fit and terminology accuracy. In Phase 4, it reviews built behavior against `requirements/00-purpose-and-user-requirements.md` and `requirements/01-functional-requirements.md`. It asks: "Does this make sense for how a therapist or patient actually works?" It does not review code — it reviews behavior, copy, flows, and clinical logic.

### Team Lead — Session Startup (do this every session, in order)

**Phase 1 — Orient (always do this first)**

1. Read `CLAUDE.md` fully (you are reading it now)
2. Read `LESSONS_LEARNED.md` — internalize all rules, note any `**CRITICAL:**` entries
3. Scan `requirements/intake/` for pending work — every `.md` or `.pdf` file directly in that folder (not in `done/`) is a pending spec. Read each one in full.
4. Read the relevant docs in `requirements/` for the pending work. These are the product and architectural source of truth. Key files:
   - `00-purpose-and-user-requirements.md` — product vision and user goals
   - `01-functional-requirements.md` — feature-level requirements
   - `02-nonfunctional-requirements.md` — performance, security, reliability constraints
   - `03-data-model-and-security-requirements.md` — data model and auth rules
   - `04-rest-api.md` — API contract
   - `07-test-strategy.md` — testing expectations
   - `08-design-style-guide.md` — UI/UX rules
   - Read others only if directly relevant to pending work

**Phase 2 — Architecture gate and clinical review (do this before delegating)**

5. Draft an implementation plan: which requirements map to which files, routes, models, and components — and which specialist Architects are needed
6. Identify any architectural decisions the plan requires — specifically:
   - New Mongoose models or schema changes
   - New API routes or changes to existing contracts in `requirements/04-rest-api.md`
   - New auth patterns or role permissions not already established
   - New cross-platform API contracts (if iOS/Android work is involved, the backend API must be defined before client work begins)
   - UI patterns not covered by existing reusable components on any platform
   - Anything that would deviate from the `requirements/` docs
7. Spawn **Clinical Advisor** (mode: `bypassPermissions`) with the implementation plan and relevant requirements docs. Ask: "Does this plan accurately represent clinical workflow? Are any terms, flows, or behaviors clinically incorrect or misleading?"
8. If architectural decisions exist OR if the Clinical Advisor raises concerns: present all issues to the user as a single focused list. Wait for alignment before proceeding. Do NOT ask about implementation details — only decisions that affect structure, contracts, clinical correctness, or constraints.
9. If no issues: proceed immediately to Phase 3.

**Phase 3 — Execute**

10. Mark pending requirements as `[~] In Progress` in `REQUIREMENTS.md`
11. If the work touches the API contract: spawn **Backend Architect** first. Wait for it to complete the API layer before spawning client architects.
12. Spawn the relevant client architects in parallel (only those needed for this batch):
    - **Web Architect** (mode: `bypassPermissions`) — for clinic web app changes
    - **iOS Architect** (mode: `bypassPermissions`) — for iOS app changes
    - **Android Architect** (mode: `bypassPermissions`) — for Android app changes
13. Spawn **QA Engineer** (mode: `bypassPermissions`) with the full implementation plan — QA writes tests for every acceptance criterion across all affected platforms. QA can begin writing tests in parallel with Architect work where tests don't depend on implementation details.

**Phase 4 — Review, validate, and close**

14. Spawn **Design Reviewer** (mode: `bypassPermissions`) — reviews all new/changed UI against `requirements/08-design-style-guide.md`. Uses Preview MCP tools (screenshots) to visually inspect web UI. Checks: correct brand colors, correct components used, mobile layout at 375px, consistency with existing pages.
15. Spawn **Clinical Advisor** (mode: `bypassPermissions`) — final review of built behavior against clinical requirements. Reviews UI copy, flows, and logic for clinical accuracy.
16. If Design Reviewer or Clinical Advisor raises issues: delegate fixes to the appropriate Architect, then re-run the reviewer.
17. Run all Definition of Done gates (see below)
18. If any gate fails: diagnose, delegate fix to appropriate Architect or QA, re-run gates — do NOT mark work done until all pass
19. For each completed spec file:
    - Merge its content into the relevant `requirements/` docs: `01-functional-requirements.md` (always), `04-rest-api.md` (if routes changed), `03-data-model-and-security-requirements.md` (if schema changed)
    - Move the spec file (`.md` or `.pdf`) from `requirements/intake/` to `requirements/intake/done/`
20. Create a PR with a summary that maps each spec file to what was built and tested

### Team Lead — Spawning Sub-agents

Always spawn sub-agents with `mode: "bypassPermissions"`. The user has granted blanket permissions for this project at the settings level.

**When spawning any Architect, include:**
- The full implementation plan for their platform/layer
- Which specific files to create or modify
- The relevant acceptance criteria from `REQUIREMENTS.md`
- Any applicable rules from `LESSONS_LEARNED.md`
- The API contract if their work depends on it

**When spawning QA, include:**
- The full implementation plan across all platforms
- Every acceptance criterion that needs test coverage
- Which test files to create or modify per platform
- Existing test patterns to follow (point to similar existing tests by file path)

**When spawning Design Reviewer, include:**
- Which pages/screens/components were changed
- The relevant sections of `requirements/08-design-style-guide.md`
- The URL of the running dev server (port 5173) for web screenshot review

**When spawning Clinical Advisor, include:**
- The implementation plan (Phase 2) or a summary of what was built (Phase 4)
- `requirements/00-purpose-and-user-requirements.md` and `requirements/01-functional-requirements.md`
- Specific clinical questions to evaluate

### Definition of Done — ALL applicable gates must pass before work is complete

This is a blocking checklist. Only run gates for platforms touched by the current batch.

**Web — run if any web files changed:**
- [ ] `npm run lint -w somi-connect` — zero errors
- [ ] `npm run lint -w somi-clinic-web` — zero errors
- [ ] `npm run typecheck -w somi-connect` — zero errors
- [ ] `npm run typecheck -w somi-clinic-web` — zero errors
- [ ] `npm test -w somi-connect` — all pass
- [ ] `npm test -w somi-clinic-web` — all pass at both 1280px and 375px viewports
- [ ] Every new user-facing web behavior has at least one test written by QA

**iOS — run if any iOS files changed:**
- [ ] `xcodegen generate` succeeds (run from `apps/somi-home-ios/`)
- [ ] `xcodebuild build` succeeds — zero errors
- [ ] `xcodebuild test` (XCTest unit tests in `SOMIHomeTests/`) — all pass
- [ ] Every new ViewModel behavior has a unit test

**Android — run if any Android files changed:**
- [ ] `./gradlew assembleDebug` succeeds — zero errors (run from `apps/somi-home-android/`)
- [ ] `./gradlew lint` — zero warnings or errors
- [ ] `./gradlew test` (JUnit4 unit tests) — all pass
- [ ] `./gradlew connectedAndroidTest` (Espresso instrumented tests) — all pass (requires running emulator)
- [ ] Every new ViewModel behavior has a unit test

**Always:**
- [ ] No new `// TODO` or `// FIXME` comments introduced
- [ ] No `console.log` / `print()` / `Log.d()` statements left in production code paths
- [ ] Design Reviewer sign-off: no style guide violations
- [ ] Clinical Advisor sign-off: no clinical workflow violations

---

## Lessons Learned Lifecycle

`LESSONS_LEARNED.md` is a **staging area**, not a permanent archive. Its purpose is to capture recent failures before they are distilled into permanent rules.

### When to add a lesson
Add an entry whenever the user reports a bug found during acceptance testing that the team should have caught. Include: what broke, what test/check would have caught it, and the rule going forward.

### Promotion to CLAUDE.md
When a lesson has been validated — referenced more than once, confirmed as a recurring pattern, or flagged as critical — it must be:
1. Added to the relevant section of `CLAUDE.md` as a permanent rule
2. Removed from `LESSONS_LEARNED.md` (or reduced to a one-line "promoted to CLAUDE.md on [date]" reference)

This keeps `LESSONS_LEARNED.md` from growing unboundedly.

### When a rule is violated
If the user reports that an established rule (in CLAUDE.md or LESSONS_LEARNED.md) was not followed:
1. Add a `**CRITICAL:**` prefixed entry to LESSONS_LEARNED.md noting the violation and date
2. Move the rule into CLAUDE.md if it was only in LESSONS_LEARNED.md
3. Strengthen the wording in CLAUDE.md — vague rules get violated; specific rules get followed

### When a rule is improved
Edit the rule in place in both files. Neither file is append-only. Delete the stale version and replace it with the better version.
