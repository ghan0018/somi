# Lessons Learned

This is a **staging area** for failures found during acceptance testing.
When a lesson is validated or recurring, promote it to `CLAUDE.md` and remove it here.

## Lifecycle

- **New failure** → Add an entry below
- **Recurring or confirmed pattern** → Promote to `CLAUDE.md`, remove from here
- **Rule was violated** → Add `**CRITICAL:**` entry + strengthen the rule in `CLAUDE.md`
- **Rule was improved** → Edit in place (this file is not append-only)

## Entry Format

```markdown
### [YYYY-MM-DD] [Area: e.g. Auth, Exercise UI, Patient API]
**What broke:** [What the user found during acceptance testing]
**What would have caught it:** [The specific test, check, or review that was missing]
**Rule going forward:** [The concrete rule the team must follow — be specific]
**Status:** Staging | Promoted to CLAUDE.md on YYYY-MM-DD | CRITICAL
```

---

<!-- Add lessons below this line -->
