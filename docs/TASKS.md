# The Jester — Living Task Board

Source of truth for the autonomous build loop. Derived from [`DEVELOPMENT_LOG.md`](../DEVELOPMENT_LOG.md).

## Phase 3 — Combat + Suspicion (complete)
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
- [x] **3.2** Cover states (siren + smoke)
  - [x] Create/update cover state module (`coverState.ts` or extend `gameState.ts`)
  - [x] Render `smokeZones` from arena config (`SmokeZone.tsx`)
  - [x] Implement siren active boolean tied to razor `siren: true`
  - [x] Emit `sirenActive` / `smokeActive` events on transitions
  - [x] Add cover readout to `DebugOverlay.tsx`
  - [x] Verify: overlay shows cover on/off correctly
- [x] **3.3** Suspicion system
  - [x] Create `src/game/systems/suspicion.ts` with the spec'd model
  - [x] Cover factor math: open ×1.0, siren ×0.1, smoke ×0.15, siren+smoke ×0.0–0.05
  - [x] Spam surcharge via rolling window
  - [x] Decay when not firing (baseline hidden/not-hidden)
  - [x] Thresholds at 60 (warning) and 100 (detected)
  - [x] Wire to `addSuspicion` / `decaySuspicion` store actions
  - [x] Verify: open fire spikes fast, covered fire barely moves, decay works
- [x] **3.4** Cheating-detected response
  - [x] Fire `suspicionThreshold: {level: "detected"}` once per crossing
  - [x] Add observable response (screen alert / forced siren / lockdown state)
  - [x] Stub elite-guard spawn hook for Phase 4
  - [x] Verify: unsafe spam reliably triggers observable response

## Phase 4 — Enemies (complete)
- [x] **4.1** Arena Guard
- [x] **4.2** Security Drone

## Phase 5 — AI Announcer (complete)
- [x] **5.1** Bark system
- [x] **5.2** Character arc flag
- [x] **5.3** Voice / captions (text captions satisfy this per spec; TTS not pursued — explicit stretch goal)

## Phase 6 — Tutorial → Vertical Slice
- [ ] **6.1** Orientation arena tutorial flow (in progress)
  - [x] Tutorial beacon system (`TutorialBeacon.tsx` + `triggerBark()`) — reusable one-shot bark trigger
  - [x] Beat 1: movement (beacon at x=3, `tut_movement`)
  - [x] Beat 2: jetpack (beacon at x=6, `tut_jetpack`)
  - [x] Beat 3: hazards (beacon at x=8.5, `tut_hazards`)
  - [x] Beat 4: "no ammunition" weapon gag (beacon at x=12, `tut_no_ammo`)
  - [x] Beat 5: sirens (beacon at x=15, `tut_sirens`)
  - [x] Beat 6: smoke (beacon at x=16.5, `tut_smoke`)
  - [x] Beat 7: suspicion (beacon at x=22, `tut_suspicion`)
  - [x] Beat 8: exit (beacon at x=36, `tut_exit`)
  - [ ] Verify: full done-when loop in one session (DEVELOPMENT_LOG.md lines ~615-623) — content composition complete (all 8 beats, both enemies, checkpoint/respawn, exit all present in arena-01.json). **Update 2026-06-30:** Matt + a separate AI session fixed a real input bug (pointer lock failing silently in embedded/in-app browsers, blocking mouse-look/fire there) — mouse-look now falls back to cursor tracking, fire is a queued one-shot-per-click, RMB added as focus-look-without-firing. Verified manually: movement/mouse-look/fire (2 clicks → 2 `shotFired`) all work without pointer lock. This removes a real blocker to testing in more environments but does **not** itself satisfy the full done-when (hazard/enemy/checkpoint/exit/announcer loop + "is this fun" pacing check) — still pending.

## Repo Consolidation (2026-06-30)
- [x] Merged `thejester-autopilot` → `main` (commit `24c41c5`)
- [x] `main` set as GitHub default branch / remote HEAD
- [x] Input-robustness fix landed on `main` (`7d9467f`): pointer-lock fallback, one-shot queued fire, RMB focus-look, optional-GLB HEAD-check fix, README updated
- [x] Both cron jobs (builder `f5e4b0dae651`, supervisor `edd7a15537da`) repointed to build against `main`
- [x] `npm install` + `npm run build` re-verified green on `main`

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
- [x] Phase 3 combat + suspicion (firing, lock-on, cover, suspicion model, lockdown response)
- [x] Phase 4 enemies (Arena Guard, Security Drone)
- [x] Phase 5 AI announcer (bark system, story-tier lines, text captions)
