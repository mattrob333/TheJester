# The Jester — Living Task Board

Source of truth for the autonomous build loop. Derived from [`DEVELOPMENT_LOG.md`](../DEVELOPMENT_LOG.md).

## Phase 3 — Combat + Suspicion (complete)
- [x] **3.1** Firing + projectiles
  - [x] Extend `useFlightInput.ts` with left-mouse fire tracking
  - [x] Create `src/game/combat/useWeapon.ts` (cooldown + active projectiles ref)
  - [x] Create `src/game/combat/Projectile.tsx` (forward-march, lifetime/range, hit detection)
  - [x] Wire `bus.emit("shotFired", { covered, owner })` on each accepted shot
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
  - [x] Cleanup 2026-07-01: `shotFired` now carries `owner`, suspicion/drone spotting ignore enemy fire, player shots report live siren/smoke cover, and LMB no longer queues an extra shot from both `mousedown` and `click`.
  - [ ] Next: structured Phase 6 play-test pass on `arena-01` with pass/fail notes per beat, plus tuning fixes for flight feel, hazard spacing, enemy pressure, suspicion pacing, and announcer timing.

## Repo Consolidation (2026-06-30)
- [x] Merged `thejester-autopilot` → `main` (commit `24c41c5`)
- [x] `main` set as GitHub default branch / remote HEAD
- [x] Input-robustness fix landed on `main` (`7d9467f`): pointer-lock fallback, one-shot queued fire, RMB focus-look, optional-GLB HEAD-check fix, README updated
- [x] Both cron jobs (builder `f5e4b0dae651`, supervisor `edd7a15537da`) repointed to build against `main`
- [x] `npm install` + `npm run build` re-verified green on `main`

## Overnight Agent Queue — Controls + Feel First
- [x] **6.2 Fix mouse-look capture** (commit `9900422`)
  - [x] Normal browser/desktop path still enters pointer lock on canvas click, unchanged — cursor fallback only activates on `pointerlockerror`/deny.
  - [x] Cursor fallback replaced with drag-to-look (mousedown sets an origin, continuous clamped offset-from-origin drives turn rate, not raw `movementX/Y`) — this is what removes the screen-edge turn cap the fallback previously had. Pointer lock remains primary; drag-to-look is fallback-only.
  - [x] Debug overlay readout added: `input mode` row shows `pointer locked` / `drag-to-look` / `inactive`.
  - [ ] Verify (needs a human/browser-automation play-test, not code review alone): player can rotate 360 degrees left and right without the cursor hitting the screen edge, in an actual browser session.
  - [x] Esc / blur / re-lock all clear drag state correctly (code-reviewed: `onKeyDown` Escape handler, `onBlur`, `onLockChange` all reset `dragActive`/`dragTurnX`/`dragTurnY`); LMB fire remains a queued one-shot-per-click (unchanged from the prior fix, not touched by this ticket).
- [x] **6.3 Add a non-PC-gamer control option** (commit pending — this tick)
  - [x] Added an explicit keyboard turn mode: press **T** to toggle; while active, Arrow Left/Right/Up/Down drive continuous yaw/pitch turn (same continuous-rate model as 6.2's drag-to-look, just keyboard-sourced instead of mouse-position-sourced). Works independently of pointer-lock/drag-to-look state.
  - [x] Exposed in the Debug Overlay: new `control mode` row shows `keyboard-turn (T)` / `mouse-look (T)`; controls hint line added (`press T to toggle keyboard-turn (arrow keys)`). README controls section updated.
  - [ ] Verify: a player can turn fully around, fly forward, ascend/descend, and fire without needing FPS-style pointer lock comfort — code-reviewed as correct (keyboard-turn uses the same yaw/pitch clamp math as mouse-look and drag-to-look, WASD/Space/Ctrl/fire are unaffected by which turn mode is active), but interactive confirmation needs the same human/browser-automation play-test as the rest of Phase 6.
  - **Note:** 6.2's drag-to-look fallback is automatic (only engages when pointer lock is denied); 6.3 is the additional *explicit, player-toggled* mode this ticket called for — now shipped, no longer open.
- [x] **6.4 Add feel instrumentation** (commit `9900422` + this tick)
  - [x] Input mode readout (see 6.2).
  - [x] Fire cooldown readout: new exported `FIRE_COOLDOWN` constant + `useWeapon().lastFire` drive a `fire cooldown` row (`Xs` or `ready`).
  - [x] Current tutorial beat readout: `telemetry.lastBeaconId`, written by `TutorialBeacon.tsx` on first trigger, shown as a `tutorial beat` row.
  - [x] Player position/speed already existed (`cam`/`speed` rows); health/suspicion/cover/lockdown already existed.
  - [x] "Last damage source" readout: `playerDamaged` event gained a required `source: string` field (razor/crusher/laser/arena-guard) set at each of the 4 emit sites; `Player.tsx`'s existing damage-flash subscriber writes it to `telemetry.lastDamageSource`; `DebugOverlay.tsx` shows a `last damage source` row.
  - [x] "Hazard phase" readout: each cyclic hazard (crusher/laser) writes `telemetry.hazardPhase = "<type>:<phase>"` while the player overlaps its sensor, clearing to `null` on exit; razor (always-armed, no phase cycle) writes `"razor:active"` while overlapped. `DebugOverlay.tsx` shows a `hazard phase` row.
  - [x] Verify: `npm run build` green (zero TS errors, 166 modules) after wiring all 4 hazard/enemy emit sites + telemetry fields + DebugOverlay rows. Full interactive play-test verification of the readouts' *correctness in motion* still pending the same play-test-tooling gap as Phase 6 overall — the instrumentation itself is code-complete and build-verified.
- [ ] **6.5 Run Phase 6 acceptance and tune the loop**
  - [ ] Pass/fail all 8 tutorial beacons in order.
  - [ ] Pass/fail two hazard dodges minimum.
  - [ ] Pass/fail Arena Guard and Security Drone encounters.
  - [ ] Pass/fail safe fire vs open fire suspicion behavior, including warning/detected thresholds.
  - [ ] Pass/fail damage feedback, checkpoint respawn, and exit reach.
  - [ ] Tune movement acceleration/top speed, camera smoothing, hazard spacing/timing, enemy pressure, suspicion numbers, beacon placement, and bark timing based on the pass.
- [ ] **6.6 Commit a build-ready handoff**
  - [ ] Update `DEVELOPMENT_LOG.md`, `docs/TASKS.md`, `.hermes/build-state.md`, and README controls if behavior changes.
  - [ ] Run `npm run typecheck` and `npm run build`.
  - [ ] Browser-smoke-test the actual served app on a known clean port.
  - [ ] Commit and push to `main` with the exact pass/fail summary.

## Phase 7+
- [ ] Start only after Phase 6 loop has been play-tested and accepted, or Matt explicitly authorizes moving on with known tuning debt.
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
