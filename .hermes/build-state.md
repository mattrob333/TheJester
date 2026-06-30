# Build State: The Jester

**Spec source:** [`DEVELOPMENT_LOG.md`](../DEVELOPMENT_LOG.md)
**Repo:** https://github.com/mattrob333/TheJester
**Workspace:** `C:\Users\mrobe\TheJester`
**Branch:** `thejester-autopilot`
**Status:** Phase 3 combat + suspicion system in progress

## Architecture: Two-Tier Build Loop
- Inner Loop (cron `f5e4b0dae651`) — every 10m: Check -> Test -> Advance -> Repeat. Self-pauses both crons at a genuine stopping point.
- Outer Loop (cron `edd7a15537da`) — every 30m: active supervisor (audits + writes corrections + trivial fixes + escalation).

## Phases / Waves
1. [x] Phase 0 — Scaffold (tickets 0.1, 0.3, 0.4)
2. [x] Phase 1 — Movement core (tickets 1.1, 1.2, 1.3)
3. [x] Phase 2 — Arena, hazards, survival (tickets 2.1, 2.2, 2.3, 2.4)
4. [ ] Phase 3 — Combat + Suspicion (tickets 3.1, 3.1b, 3.2, 3.3, 3.4) — **CURRENT**
   - 3.1 ✅ (c60c3d0)
5. [ ] Phase 4 — Enemies (tickets 4.1, 4.2)
6. [ ] Phase 5 — AI Announcer (tickets 5.1, 5.2, 5.3)
7. [ ] Phase 6 — Tutorial → vertical slice (ticket 6.1)
8. [ ] Phase 7+ — Content, bosses, narrative, polish

## Completed Tasks
- Repo cloned to `C:\Users\mrobe\TheJester`
- Build branch `thejester-autopilot` created and pushed
- `npm install` succeeded
- `npm run build` passes with zero TS errors
- Baseline verified: Vite + React 19 + R3F 9 + Rapier 2 + TypeScript strict
- **Ticket 3.1 — Firing + projectiles** (c60c3d0): LMB fire input, `useWeapon` + `Projectile.tsx`, `TargetDummy` in arena config, wired to Player

## Open Issues / Blockers
- None

## Next Action
Implement **Ticket 3.1b — Aiming / soft lock-on**: add a global target registry (extend `src/game/combat/targets.ts`), compute nearest valid target in the player's forward cone + max range, render a lock-on indicator, and make spawned projectiles home toward the locked target. Keep `npm run build` green; commit + push.

## Pitfalls / Notes for Future Ticks
- `npm run build` must pass with zero TS errors (strict mode).
- Use `.getState()` for zustand inside `useFrame`; use refs for per-frame mutable state.
- Keep firing/projectile logic separate from flight math; reuse existing patterns.
- All physics-dependent components must be descendants of `<Physics>` in `Game.tsx`.
- Commit each green ticket before starting the next file.
- When adding new arena config fields, update `types.ts` with discriminated unions first.
- **Ticket 3.1 follow-up:** the `Projectiles` instanced mesh and `TARGETS` registry are the foundation for 3.1b targeting.

**Last Updated:** 2026-06-30 — Ticket 3.1 shipped, Phase 3 continuing
