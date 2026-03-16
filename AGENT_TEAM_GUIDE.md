# SOMI Agent Team Guide

How to work with the Claude Code agent team on this project. The team operates autonomously and is designed to require your input only at two points: **requirements definition** and **acceptance testing**.

---

## The Team

| Agent | What they do |
|---|---|
| **Team Lead** | The agent you talk to. Reads requirements, plans, asks architecture and clinical questions, delegates to specialists, validates all gates, creates the PR. |
| **Backend Architect** | Implements Node/Express/Mongoose backend. Never writes tests. |
| **Web Architect** | Implements React/Vite/Ant Design web app. Never writes tests. |
| **iOS Architect** | Implements native Swift/SwiftUI iOS app. Never writes tests. |
| **Android Architect** | Implements Kotlin/Compose Android app. Never writes tests. |
| **QA Engineer** | Writes all tests across all platforms. Runs all validation gates. Never writes implementation code. |
| **Design Reviewer** | Reviews built UI visually against the style guide using screenshots. Read-only advisory. |
| **Clinical Advisor** | Reviews plans and built behavior from the perspective of a certified SLP/myofunctional therapist. Read-only advisory. |

The Team Lead only spawns the specialists needed for a given batch — not all agents run every session.

---

## The Workflow

```
You write requirements
        ↓
Start the Team Lead
        ↓
Team Lead orients: reads CLAUDE.md, LESSONS_LEARNED.md, REQUIREMENTS.md, requirements/ docs
        ↓
Team Lead drafts plan → Clinical Advisor reviews for clinical accuracy
        ↓
Team Lead asks you architecture questions (if any) — one focused exchange
        ↓
Team executes: Backend → then Web/iOS/Android in parallel → QA writes tests in parallel
        ↓
Design Reviewer + Clinical Advisor review what was built
        ↓
All Definition of Done gates pass
        ↓
PR created → you acceptance test → log failures → repeat
```

---

## Step 1 — Write Your Requirements

Drop a file in `requirements/intake/`. The filename is your label — use something descriptive:

```
requirements/intake/messaging-read-receipts.md
requirements/intake/ios-offline-sync-bug.pdf
requirements/intake/admin-exercise-bulk-archive.md
```

Both `.md` and `.pdf` files are supported. One file per cohesive piece of work — a full feature, a small bug fix, or anything in between. The Team Lead reads everything it finds in that folder.

**Spec file format:**

```markdown
# [Short name]

## Context
Why this is needed. Clinical or product motivation.

## Scope
Platforms: backend | web | ios | android (list only what applies)
Roles affected: admin | therapist | client (list only what applies)

## Acceptance Criteria
- [ ] ...
- [ ] ...

## Notes
Edge cases, related requirements doc sections, API contract references, clinical constraints.
```

**Tips for good acceptance criteria:**
- Write *what* the user can do, not *how* to build it
- Each criterion must be independently testable
- For role restrictions, list which roles can AND cannot perform the action
- Reference specific sections of `requirements/` docs if the feature touches an existing contract

**Where to write requirements:** Use **Claude Chat** (not Claude Code) for drafting. Set up a Claude Chat Project with these files attached for context:
- `requirements/00-purpose-and-user-requirements.md`
- `requirements/01-functional-requirements.md`
- `requirements/03-data-model-and-security-requirements.md`
- `requirements/04-rest-api.md`

This lets Claude Chat catch conflicts with existing features and write accurate acceptance criteria. Use Claude Code only if you want to validate a draft against the existing codebase before handing it off.

---

## Step 2 — Start the Team Lead

Open Claude Code in this repo and send this message:

```
Read REQUIREMENTS.md and LESSONS_LEARNED.md, then execute all pending requirements
following the operating procedure in CLAUDE.md. Use bypassPermissions mode for all
sub-agents.
```

The Team Lead takes over from there.

**For overnight / unattended runs:** Start Claude Code with the `--dangerously-skip-permissions` flag, or set the session to `bypassPermissions` mode before sending the message. This ensures no permission prompts interrupt the run. All file reads, writes, web fetches, and common dev commands are pre-authorized for this project.

---

## Step 3 — Answer Architecture and Clinical Questions (if any)

The Team Lead will surface questions before delegating if the batch touches:

**Architecture questions:**
- New database models or schema changes
- New or changed API contracts (especially ones shared across web + iOS + Android)
- New auth/role patterns
- UI patterns not covered by existing components
- Anything deviating from the `requirements/` docs

**Clinical questions:**
- Workflow or terminology that the Clinical Advisor flagged as potentially incorrect
- Proposed flows that don't match how therapists/patients actually work

These come as a **single list** at the start of the session. Answer them and the team proceeds. The team will not ask mid-execution.

**Cross-platform API contracts** are the most common reason for an architecture question. When a batch touches the backend API *and* iOS *and* Android, the Team Lead will confirm the API shape with you before any client work starts. This prevents the Architects from building against inconsistent contracts.

If you get no questions, the team found everything it needs in existing docs and proceeds directly.

---

## Step 4 — Wait (or Sleep)

The Team Lead coordinates:
1. Backend Architect implements any API changes
2. Web, iOS, and Android Architects implement in parallel (once API is settled)
3. QA writes tests in parallel with implementation
4. Design Reviewer and Clinical Advisor review the result
5. All Definition of Done gates run — the team fixes any failures itself
6. PR is created

---

## Step 5 — Review the PR

The PR will include:
- Each requirement ID mapped to what was built
- Confirmation that all lint, typecheck, and test gates passed
- Which test files cover which acceptance criteria
- Design Reviewer sign-off
- Clinical Advisor sign-off

Review the diff. The team has already verified it against all automated gates.

---

## Step 6 — Acceptance Test

Run the app and test the features against the acceptance criteria in the spec files. You are the final quality gate.

**Things to check that automated tests can't:**
- Does the UX feel right for a therapist using this daily?
- Does the clinical terminology match how the field actually talks?
- Do role restrictions behave correctly across all platforms?
- Does the mobile layout feel natural on a real device?
- Do error states communicate clearly to patients?

---

## Step 7 — Log Failures as Lessons

When you find a bug or gap during acceptance testing, open `LESSONS_LEARNED.md` and add an entry:

```markdown
### 2026-03-16 [Platform/Area — e.g. iOS: Today View, Web: Patient Messaging]
**What broke:** [Specific description of what you found]
**What would have caught it:** [The test, check, or review step that was missing]
**Rule going forward:** [Concrete, specific rule — be precise, not vague]
**Status:** Staging
```

The Team Lead reads this at the start of every future session. The rule is active immediately.

---

## Managing the Lessons Learned File

### Promoting a lesson to a permanent rule

When a lesson is proven (came up more than once, or you want it permanently enforced):

1. Copy the rule into the relevant section of `CLAUDE.md` (Testing Rules, Coding Conventions, etc.)
2. In `LESSONS_LEARNED.md`, replace the full entry with: `Promoted to CLAUDE.md on [date]`

Rules in `CLAUDE.md` carry more weight — the Team Lead reads CLAUDE.md fully every session.

### When a rule was violated

1. Add a `**CRITICAL:**` entry to `LESSONS_LEARNED.md`:
   ```markdown
   ### 2026-03-20 [CRITICAL — Rule violated: iOS role restriction]
   **What broke:** iOS still showed the resolved button to clients despite rule from 2026-03-16.
   **Root cause:** Rule was only in LESSONS_LEARNED.md, not CLAUDE.md.
   **Action taken:** Promoted to CLAUDE.md. Rule strengthened with explicit iOS example.
   **Status:** Promoted to CLAUDE.md on 2026-03-20
   ```
2. Promote the rule to `CLAUDE.md` immediately
3. Rewrite it to be more specific — vague rules get violated, specific rules get followed

### When a rule was improved

Edit in place. Neither file is append-only. Delete the old version and write the better one.

---

## The Requirements Folder

`requirements/` is the product and architecture source of truth. The Team Lead reads the relevant docs each session.

| File | Contents |
|---|---|
| `00-purpose-and-user-requirements.md` | Product vision, user goals, clinical context |
| `01-functional-requirements.md` | Feature-level requirements |
| `02-nonfunctional-requirements.md` | Performance, security, reliability |
| `03-data-model-and-security-requirements.md` | Data model, auth rules |
| `04-rest-api.md` | API contract (shared across all clients) |
| `07-test-strategy.md` | Testing expectations per platform |
| `08-design-style-guide.md` | UI/UX rules, brand palette, components |

When architecture evolves — a new API endpoint, a schema change, a new role — update the relevant doc in `requirements/` so the team's source of truth stays current.

---

## Quick Reference

| I want to… | I do… |
|---|---|
| Add new work | Create a file in `requirements/intake/` |
| Start the team | Send: *"Scan requirements/intake/ and LESSONS_LEARNED.md, then execute all pending specs following the operating procedure in CLAUDE.md."* |
| Run unattended overnight | Start Claude Code with `--dangerously-skip-permissions` before sending the start message |
| Report a bug found in testing | Add entry to `LESSONS_LEARNED.md` |
| Make a rule permanent | Copy to `CLAUDE.md`, mark as promoted in `LESSONS_LEARNED.md` |
| Escalate a violated rule | Add `**CRITICAL:**` entry, promote to `CLAUDE.md`, strengthen wording |
| Update the architecture | Edit the relevant `requirements/` doc |
| See what was built | Read the PR created at end of session |
| Add a new platform | Add build/test commands to `CLAUDE.md` Build & Run and Definition of Done sections |
