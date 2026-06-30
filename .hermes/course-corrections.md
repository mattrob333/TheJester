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
### NEW (this tick, builder, MEDIUM) — Narrative-beat decision needed for storyProgress advancement
Ticket 5.2 (Character arc flag) is implemented and shipped (commit 0ca0c9a): the announcer correctly resolves bark text per `storyProgress` tier (`believer`/`doubter`/`ally`) via `getBarkLine(id, tier)`, with fallback-to-believer for unoverridden ids. `setStory(...)` (the zustand action that changes the tier) already existed since Phase 0 and works correctly when called.

**What's NOT decided, per the ticket's own explicit instruction not to invent it:** which in-game events/conditions should actually CALL `setStory(...)` to advance the player from believer → doubter → ally as the game progresses. This is a product/narrative decision (e.g. "after N successful arena clears," "after the player sides with/against some character," "scripted at specific story beats in specific arenas") that isn't specified anywhere in `DEVELOPMENT_LOG.md`.

**Impact:** None on Phase 6 (tutorial arena is early-game, believer-tier default is correct and sufficient). Will become relevant once Phase 6+/7+ introduces "late-game arenas" that are meant to demonstrate ally-tier announcer lines for real (rather than only via manual/dev `setStory("ally")` calls) — at that point the build will need either (a) a user/product decision on the actual narrative trigger conditions, or (b) explicit permission for the inner loop to propose+implement a reasonable placeholder trigger.

**Suggested resolution path:** no action needed now. Surface this to the user/supervisor for a narrative decision before any ticket that depends on `storyProgress` actually changing during real gameplay (likely Phase 7+ "narrative wrappers"). Not a blocker for current/next work.

## Resolved Corrections
_(history appended below)_
