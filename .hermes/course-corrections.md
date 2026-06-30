# Course Corrections — Outer Loop -> Inner Loop

The OUTER loop appends prioritized directives here on detecting drift, guardrail violations, quality regressions, or off-task work. The INNER loop reads this FIRST every tick and resolves OPEN corrections as top priority before normal work.

**Protocol:**
- Outer APPENDS corrections as OPEN; never edits build-state.md (avoids write races).
- Inner addresses each OPEN item, then marks it RESOLVED (commit <sha>) and moves it to Resolved. After resolving all OPEN items, **clean up the Open section** by writing `_(none — inner loop in alignment as of last audit)_` — do not leave empty bullet headers.
- Severity: BLOCKER (stop normal work, fix now) / HIGH (this tick) / MEDIUM (within 2 ticks) / LOW (when convenient).
- **Batching multiple corrections:** When multiple OPEN items exist, resolve them all in severity order within the same tick before moving to normal work. Update the Resolved section once with all items, then clean the Open section.

## Overlap Lock (mandatory — read before doing ANY work)
Both the inner builder (every 10m) and outer supervisor (every 30m) write to this repo. To prevent two ticks running concurrently and corrupting state or git history:
1. At the very start of the run, check for `.hermes/run.lock`.
   - If it EXISTS and is **less than 20 minutes old** (compare file mtime to current UTC time): another tick is still active. **Do nothing else** — do not touch git, do not edit files — just exit/end the run immediately. This is not a stop condition, just a skip; the next scheduled tick will try again.
   - If it EXISTS and is **older than 20 minutes**: treat it as stale (a previous run crashed/timed out). Delete it and proceed — log this in your tick report.
   - If it does NOT exist: proceed.
2. Immediately create `.hermes/run.lock` containing `<role>:<UTC timestamp>` (role = "builder" or "supervisor"), e.g. `builder:2026-06-30T21:05:00Z`. Do this as a plain file write, NOT a git commit (keep it out of version control noise — add `.hermes/run.lock` to `.gitignore` if not already present).
3. Do your normal work (corrections, build, code, commits, audits).
4. At the very end of the run (success, stop, or escalation), **delete `.hermes/run.lock`** before finishing. This must happen even if you hit an error mid-run — wrap your core work so the lock is cleared on the way out.
5. Never proceed with git/file work while skipping due to a fresh lock. Never delete a lock younger than 20 minutes just because you want to run.

---

## Open Corrections
_(none — inner loop in alignment as of last audit)_

## Resolved Corrections
_(history appended below)_
