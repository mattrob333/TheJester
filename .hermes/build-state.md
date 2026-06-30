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
   - 3.2 ✅ (d25c380)
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
- **Ticket 3.2 — Cover states (siren + smoke)** (d25c380): `coverState.ts` (new) — module-scoped `sirenActive`/`smokeActive` booleans backed by a multi-source registry (`sirenSources`/`smokeSources` maps keyed by hazard/zone id) so any number of siren hazards or smoke zones can register without stomping each other; emits `sirenActive`/`smokeActive` bus events only on actual transitions. `RazorHazard.tsx` registers as a permanently-active siren source when `config.siren` is true. `SmokeZone.tsx` (new) renders `config.smokeZones` (parsed since Phase 0/2, never rendered until now) as a translucent sphere + sensor collider, registering/unregistering as a smoke source on player overlap. `ArenaLoader.tsx` wires `SmokeZones` in; `arena-01.json` got one smoke zone at (20,2,0) r=4 for manual verification. `DebugOverlay.tsx` got siren/smoke/covered readout rows. **Design call documented in commit**: siren modeled as a global registry-backed boolean (not a raw per-hazard flag) to reconcile the config schema (siren authored per-hazard) with 3.3's suspicion model (wants one global cover multiplier). Scope intentionally limited to detection + debug readout — the cover-factor math is 3.3's job.

## Open Issues / Blockers
- None

## Next Action
Implement **Ticket 3.3 — Suspicion system (the real one)**: replace the Phase 0 placeholder (`bus.on("shotFired", ...)` block at the bottom of `gameState.ts`) with the actual model from DEVELOPMENT_LOG.md PART 2 §3.3 — create `src/game/systems/suspicion.ts` (model logic kept separate from the zustand store so it's testable/readable independent of wiring). Implement: per-shot `+BASE` (~+12, reuse placeholder's number) × cover factor (open ×1.0 / siren ×0.1 / smoke ×0.15 / siren+smoke ×0.0–0.05 / out-of-view ×0.1 — read `coverState.sirenActive`/`smokeActive` from Ticket 3.2 to determine the factor), a spam surcharge via a rolling shot-window, and decay (−DECAY/sec when not firing, faster when hidden). Wire to `addSuspicion`/`decaySuspicion` store actions. Keep `npm run build` green; commit + push.

## Pitfalls / Notes for Future Ticks
- `npm run build` must pass with zero TS errors (strict mode).
- Use `.getState()` for zustand inside `useFrame`; use refs for per-frame mutable state.
- Keep firing/projectile logic separate from flight math; reuse existing patterns.
- All physics-dependent components must be descendants of `<Physics>` in `Game.tsx`.
- Commit each green ticket before starting the next file.
- When adding new arena config fields, update `types.ts` with discriminated unions first.
- **Ticket 3.1 follow-up:** the `Projectiles` instanced mesh and `TARGETS` registry are the foundation for 3.1b targeting.
- **Ticket 3.1b notes:** lock-on uses module-scoped `lockOnState` (plain object, not zustand) shared between `Player.tsx` (writer) and `LockOnIndicator.tsx` (reader) — same pattern as `useWeapon`'s projectile list. Homing uses a finite turn rate (540°/s) via `Vector3.lerp` + `angleTo`, not instant snap, so it reads as assisted aim rather than a hitscan. `getTarget(id)` added to the registry so projectiles/indicator can resolve a target by id each frame without holding a stale reference (handles target despawn gracefully).
- **3.2 design-call reminder:** RESOLVED — siren modeled as a global registry-backed boolean (`coverState.ts`, `sirenSources`/`smokeSources` maps), not a per-hazard flag the suspicion system reads directly. Any number of siren hazards / smoke zones can register; the global flag is true iff at least one source is active. 3.3 should read `coverState.sirenActive` / `coverState.smokeActive` (or call `isCovered()`) to pick the cover-factor multiplier — don't re-derive cover detection from hazard configs directly in the suspicion module.

**Last Updated:** 2026-06-30 — Ticket 3.2 shipped, Phase 3 continuing
