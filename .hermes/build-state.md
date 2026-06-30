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
   - 3.1b ✅ (b9e3942)
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
- **Ticket 3.1b — Aiming / soft lock-on** (b9e3942): `targeting.ts` (findNearestTarget — forward cone + max range), `lockOn.ts` (shared lockOnState), `LockOnIndicator.tsx` (rotating cyan reticle over locked target), homing steer added to `Projectile.tsx` (finite turn rate, falls back to straight flight if target despawns), `Player.tsx` re-acquires nearest target every frame (25° cone, 50m range) and passes `targetId` into `fireProjectile`. `getTarget(id)` lookup added to `targets.ts`.

## Open Issues / Blockers
- None

## Next Action
Implement **Ticket 3.2 — Cover states (siren + smoke)**: create/update a cover-state module (`src/game/systems/coverState.ts` or fold into `gameState.ts` — decide and document the choice per DEVELOPMENT_LOG.md notes), render `SmokeZone.tsx` from `config.smokeZones` (already typed in `types.ts`, parsed since Phase 0/2 but never rendered), and wire siren state to the razor hazard's `siren: true` flag (reconcile against the 3.3 suspicion model's "siren active = global cover multiplier" framing before deciding per-hazard vs. arena-wide). Keep `npm run build` green; commit + push.

## Pitfalls / Notes for Future Ticks
- `npm run build` must pass with zero TS errors (strict mode).
- Use `.getState()` for zustand inside `useFrame`; use refs for per-frame mutable state.
- Keep firing/projectile logic separate from flight math; reuse existing patterns.
- All physics-dependent components must be descendants of `<Physics>` in `Game.tsx`.
- Commit each green ticket before starting the next file.
- When adding new arena config fields, update `types.ts` with discriminated unions first.
- **Ticket 3.1 follow-up:** the `Projectiles` instanced mesh and `TARGETS` registry are the foundation for 3.1b targeting.
- **Ticket 3.1b notes:** lock-on uses module-scoped `lockOnState` (plain object, not zustand) shared between `Player.tsx` (writer) and `LockOnIndicator.tsx` (reader) — same pattern as `useWeapon`'s projectile list. Homing uses a finite turn rate (540°/s) via `Vector3.lerp` + `angleTo`, not instant snap, so it reads as assisted aim rather than a hitscan. `getTarget(id)` added to the registry so projectiles/indicator can resolve a target by id each frame without holding a stale reference (handles target despawn gracefully).
- **3.2 design-call reminder:** DEVELOPMENT_LOG.md flags that whether "siren" is per-hazard or arena-wide needs to be decided deliberately before building — don't guess silently, document the choice in the commit message / a code comment if it's ambiguous enough to warrant explanation.

**Last Updated:** 2026-06-30 — Ticket 3.1b shipped, Phase 3 continuing
