# The Jester — Living Task Board

Source of truth for the autonomous build loop. Derived from [`DEVELOPMENT_LOG.md`](../DEVELOPMENT_LOG.md).

## Phase 3 — Combat + Suspicion (current)
- [x] **3.1** Firing + projectiles
  - [x] Extend `useFlightInput.ts` with left-mouse fire tracking
  - [x] Create `src/game/combat/useWeapon.ts` (cooldown + active projectiles ref)
  - [x] Create `src/game/combat/Projectile.tsx` (forward-march, lifetime/range, hit detection)
  - [x] Wire `bus.emit("shotFired", { covered: false })` on each fire
  - [x] Add target dummy to `arena-01.json` (sensor + color-flash feedback)
  - [x] Verify: click fire spawns projectile, dummy flashes/logs on hit
- [x] **3.1b** Aiming / soft lock-on
  - [x] Add target registry for lockable objects
  - [x] Compute nearest valid target in forward cone + max range
  - [x] Render lock-on indicator
  - [x] Make projectile home toward locked target
  - [x] Verify: firing reliably hits marked target
- [ ] **3.2** Cover states (siren + smoke)
  - [ ] Create/update cover state module (`coverState.ts` or extend `gameState.ts`)
  - [ ] Render `smokeZones` from arena config (`SmokeZone.tsx`)
  - [ ] Implement siren active boolean tied to razor `siren: true`
  - [ ] Emit `sirenActive` / `smokeActive` events on transitions
  - [ ] Add cover readout to `DebugOverlay.tsx`
  - [ ] Verify: overlay shows cover on/off correctly
- [ ] **3.3** Suspicion system
  - [ ] Create `src/game/systems/suspicion.ts` with the spec'd model
  - [ ] Cover factor math: open ×1.0, siren ×0.1, smoke ×0.15, siren+smoke ×0.0–0.05
  - [ ] Spam surcharge via rolling window
  - [ ] Decay when not firing (baseline hidden/not-hidden)
  - [ ] Thresholds at 60 (warning) and 100 (detected)
  - [ ] Wire to `addSuspicion` / `decaySuspicion` store actions
  - [ ] Verify: open fire spikes fast, covered fire barely moves, decay works
- [ ] **3.4** Cheating-detected response
  - [ ] Fire `suspicionThreshold: {level: "detected"}` once per crossing
  - [ ] Add observable response (screen alert / forced siren / lockdown state)
  - [ ] Stub elite-guard spawn hook for Phase 4
  - [ ] Verify: unsafe spam reliably triggers observable response

## Phase 4 — Enemies
- [ ] **4.1** Arena Guard
- [ ] **4.2** Security Drone

## Phase 5 — AI Announcer
- [ ] **5.1** Bark system
- [ ] **5.2** Character arc flag
- [ ] **5.3** Voice / captions

## Phase 6 — Tutorial → Vertical Slice
- [ ] **6.1** Orientation arena tutorial flow

## Phase 7+
- [ ] Content multiplication (enemies, arenas, pickups, difficulty)
- [ ] Bosses
- [ ] Narrative wrappers
- [ ] Polish (HUD, audio, juice, performance)

## Done
- [x] Repo setup + build branch
- [x] Phase 0 scaffold
- [x] Phase 1 movement core
- [x] Phase 2 arena, hazards, survival
