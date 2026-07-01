# The Jester — Development Log & Build Plan

**Audience:** the next developer (human or AI agent) picking up this repo cold.
**Purpose:** Part 1 tells you exactly what exists today and how it works.
Part 2 is a ticket-by-ticket plan for everything left to build, in dependency
order, with acceptance tests. Work top to bottom. Don't skip ahead — later
tickets assume earlier ones are done and follow their established patterns.

This file is a living document. **Update it as you complete each ticket**:
move the ticket from Part 2 into Part 1's changelog, note any design
decisions you made or deviations from the plan, and record new gotchas.
Future developers (and future you) depend on this staying accurate.

---

# PART 1 — Development Log (what exists today)

## Consolidation update - 2026-07-01

Current branch: `main` at GitHub remote HEAD. Phases 0-5 are implemented, and
Phase 6.1 has all eight orientation teaching beats composed in `arena-01.json`.
The latest cleanup pass performed a browser-backed smoke test on a clean dev
server port, then fixed the fire/suspicion event contract:

- `shotFired` now includes `owner: "player" | "enemy"` so enemy projectiles do
  not accidentally drive player suspicion or drone "spotted firing" logic.
- Player shots now pass the live siren/smoke cover state into `fireProjectile`
  instead of hard-coding `covered: false`.
- The input fallback no longer queues fire from both `mousedown` and `click`;
  LMB fire is queued on `mousedown`, while `click` only handles pointer-lock /
  cursor-look focus.

Verified this pass: `npm run typecheck`, `npm run build`, and live browser
render at `http://127.0.0.1:6200` with the HUD/event log showing owned,
covered player shots and no runtime errors. Remaining warnings are framework /
Three deprecations plus the expected large R3F/Three bundle warning.

Next build queue:

1. Finish Phase 6 acceptance: play through `arena-01` in one session and record
   pass/fail for all tutorial beats, both enemy types, siren/smoke cover,
   suspicion thresholds, damage/respawn, checkpoint, exit, and announcer timing.
2. Tune before expanding: if the loop feels rough, adjust flight feel, hazard
   spacing, enemy pressure, suspicion numbers, beacon placement, and bark timing
   before adding new content.
3. Begin Phase 7 only after the Phase 6 loop is accepted, or after Matt
   explicitly authorizes moving forward with known tuning debt.

## Status at a glance

| Phase | Tickets | Status |
|---|---|---|
| 0 — Scaffold | 0.1, 0.3, 0.4 | ✅ Done |
| 1 — Movement core | 1.1, 1.2, 1.3 | ✅ Done |
| 2 — Arena, hazards, survival | 2.1, 2.2, 2.3, 2.4 | ✅ Done |
| 3 — Combat + Suspicion | 3.1, 3.1b, 3.2, 3.3, 3.4 | 3.1 ✅ / 3.1b in progress |
| 4 — Enemies | 4.1, 4.2 | ⬜ Not started |
| 5 — AI Announcer | 5.1, 5.2, 5.3 | ⬜ Not started |
| 6 — Tutorial → vertical slice | 6.1 | ⬜ Not started |
| 7–10 — Content, bosses, narrative, polish | — | ⬜ Not started |

Run it: `npm install && npm run dev` → `http://localhost:5173`. Build it:
`npm run build` (must be zero TypeScript errors under strict mode — this is
enforced, not a suggestion). See `README.md` for controls and deploy info.

## Architecture you must understand before touching code

**Event bus (`src/game/systems/events.ts`).** A typed `mitt` singleton called
`bus`. The `GameEvents` map is the contract between systems — extend it,
never remove or repurpose a key. Systems should not import each other
directly; they communicate by emitting/subscribing on `bus`. Example: hazards
emit `playerDamaged`, and both the GameState store and the UI damage-flash
subscribe independently — neither hazard code nor the flash component knows
the other exists.

**GameState (`src/game/systems/gameState.ts`).** A zustand store. Health,
suspicion, checkpoint, story progress. Two ways to use it:
- **Reactive** (inside React components): `const health = useGameState(s =>
  s.health)` — re-renders on change.
- **Non-reactive** (inside `useFrame` loops, event handlers, anywhere outside
  React's render cycle): `useGameState.getState().damage(10)`. This is the
  pattern hazards and the player's respawn check use — **never** call a
  zustand hook conditionally or inside `useFrame` for the *reactive* form;
  always use `.getState()` there.

**FlightState (`src/game/player/flightState.ts`).** A plain mutable object
(position/velocity/yaw/pitch/speed), *not* zustand. It's written every frame
by `Player.tsx` and read every frame by `FollowCamera.tsx`. This data changes
60+ times/second and has no business triggering React re-renders — see also
`src/ui/telemetry.ts` for the same pattern bridging canvas → HTML overlay.
**Rule of thumb:** if data changes every frame and only physics/render code
reads it, use a plain ref/mutable object, not zustand and not React state.
If it changes occasionally and UI needs to react to it, use zustand. If it's
truly local to one component's render output, use `useState`.

**Arena config (`src/game/types.ts`, `src/game/config/`).** `ArenaConfig` is
the data-driven level format. `src/game/config/activeArena.ts` is the single
load point — it's the only file that imports the raw JSON and casts it
(`as unknown as ArenaConfig`, because JSON imports widen tuples to
`number[]`). Both `Game.tsx` (for player spawn) and `ArenaLoader.tsx` (for
level geometry) import `activeArena` from there. **When you add a new arena
selection mechanism (Phase 7), this is the file to change** — don't
duplicate the JSON-import-and-cast pattern elsewhere.

**Physics (`@react-three/rapier`).** `<Physics>` from Game.tsx wraps
everything physical. **Any component that calls `useRapier()` (raycasting,
spawning sensor colliders, querying the world) MUST be rendered as a
descendant of `<Physics>`**, not a sibling after it closes. We hit this bug
twice already (FollowCamera in Phase 1, almost again with ArenaLoader in
Phase 2) — `useRapier` throws `"must be used within <Physics />"` if you get
this wrong, and the canvas fails to mount at all (blank screen, errors in
console only). If you add a new physics-dependent component, render it
inside `<Physics>` in `Game.tsx`.

**Sensors and damage.** The hazard pattern (`src/game/arena/hazards/`) is the
template for "a zone that detects the player and does something." A `fixed`
RigidBody holds a `sensor` collider with `onIntersectionEnter`/
`onIntersectionExit` handlers that increment/decrement an `overlapCount` ref
(not React state — this runs every physics tick). Damage/effects are applied
inside `useFrame`, gated by both `overlapCount.current > 0` and a per-hazard
cooldown timer read off `state.clock.elapsedTime`, so continuous contact
ticks repeatedly instead of melting health in one frame. **Reuse this exact
pattern** for cover zones (3.2), enemy detection (4.x), and pickups (7.3) —
don't invent a new collision-detection idiom each time.

**Dev camera vs. gameplay camera.** `Game.tsx`'s leva `camera mode` control
switches between `follow` (real gameplay — `FollowCamera.tsx`, tied to
`flightState`), `orbit`, and `freeFly` (drei dev tools). Flight input
(pointer lock, WASD) is **only active when `cameraMode === "follow"`** — see
the `active` prop threaded from `Game.tsx` through `Player.tsx` into
`useFlightInput`. This stops pointer lock from fighting OrbitControls/
FlyControls for the mouse. If you add new player-controlled systems (aiming,
firing), gate their input the same way.

**Hazard timing (`src/game/arena/hazards/hazardTiming.ts`).** `cyclePhase(t,
interval, activeDuration)` is a pure function returning `"idle" | "warning" |
"active"` from elapsed time. All cyclic hazards share it. The razor is the
one exception — it's always-armed (no cycle), so it skips `cyclePhase`
entirely and just stays in a constant "active" state with a steady warning
light. When you build the siren/cover system (3.2), **this same function is
the natural fit** for siren on/off cycles — don't write a second timing
helper.

**Pointer lock UX gotcha (matters for everything you build that needs UI
input during gameplay).** Once pointer lock is engaged (click the canvas),
the canvas captures all mouse events and **the leva panel becomes
unclickable** until the player presses Esc. The `Test: emit shotFired` button
only works before locking. Keep this in mind for any future debug controls
or HUD buttons that need to be clickable mid-flight — they either need to
work via keyboard, or you accept that opening them requires Esc first.

## Known issues / deliberate simplifications (read before "fixing" these)

- **`Bounds.tsx` test box is not real arena collision geometry.** It's a
  simple six-wall box sized from `config.bounds`. There's no interior
  geometry (pillars, ledges, cover objects) — that's expected to arrive
  piecemeal as arenas get real level design (Phase 7+), not as part of this
  phase's ticket scope.
- **Hazard sensor zones are static, not physically animated.** E.g. the
  crusher's danger zone is a fixed box at its "lowered" position; only the
  *visual* head mesh moves up and down. Damage is gated purely by
  `cyclePhase`, not by actual collider movement. This was a deliberate
  simplification to avoid kinematic-body animation complexity in Phase 2 — if
  a future hazard genuinely needs to *physically* push/carry the player
  (e.g. a moving platform), you'll need a kinematic body with
  `setNextKinematicTranslation`, which is a different pattern than what's
  here.
- **Damage numbers (18/40/15) and hazard cycle timings are placeholder
  tuning**, not balanced for actual difficulty. Don't treat them as final;
  they exist to prove the systems work. Real balance is a Phase 6+ concern
  once the full slice is playable and testable by actual players.
- **`npm run build` produces a >3MB JS chunk** (three.js + rapier's wasm +
  R3F/drei are just big). Vite warns about this; it's expected at this stage.
  Code-splitting (dynamic `import()` for rarely-used drei helpers, etc.) is a
  Phase 10 polish concern — don't chase it now.
- **No automated test suite exists.** Every ticket so far has been verified
  by (a) `npm run build` passing with zero TS errors, and (b) manual/headless
  browser verification of the actual running behavior (see each commit
  message for what was specifically checked). Continue this discipline:
  **typecheck is necessary but not sufficient** — actually run the feature
  and watch it work before calling a ticket done. If you have headless
  browser tooling available (Playwright is preinstalled in some
  environments), use it to drive real input and read the debug overlay; if
  not, describe exactly what you manually verified in your commit message.

## Conventions established so far — follow these

- **Strict TypeScript, zero errors, no `any`.** Cast JSON imports through
  `unknown` at the single load point, not `any`. Use discriminated unions
  for config variants (see `HazardConfig`).
- **No comments explaining *what* code does** — only *why*, when it's
  non-obvious (a workaround, a constraint, a deliberate simplification).
  Match the existing comment density; don't over-comment new code.
- **Tunable numbers belong in `leva`** if a human needs to feel-tune them
  live (flight feel, etc.); **fixed gameplay constants** (damage amounts,
  hazard timings) are plain `const` at the top of the relevant file, not
  leva controls — don't add a leva slider for every number, that's scope
  creep the original ticket didn't ask for.
- **One hazard/system type per file**, dispatched by a small `Field`/
  `Manager` component that switches on a `type` discriminant (see
  `HazardField.tsx`). Follow this for enemies (4.x) and any future
  per-type content.
- **Scratch vectors/eulers/quaternions are allocated once via `useMemo`**
  outside `useFrame` and mutated in place inside it, never `new`'d per
  frame. This matters — R3F components run `useFrame` every render tick, and
  allocating in there creates GC pressure that shows up as frame-time jitter
  on real hardware even though it looks fine in a quick check.
- **Commit messages document what was actually verified**, not just what
  was written. Keep doing this — it's the project's substitute for a test
  suite right now.

## Changelog (most recent first)

- **Phase 3.1** (`c60c3d0`) — Firing + projectiles. Left mouse button tracked
  under pointer lock, `useWeapon` cooldown + active projectile list,
  `Projectile.tsx` forward-march with lifetime/range culling and radius hit
  detection against the `TARGETS` registry. Added `TargetDummy` to
  `arena-01.json` (at `[34,2,0]`) with red hit-flash feedback. Removed the
  leva "Test: emit shotFired" scaffolding button. Verified: `npm run build`
  green; projectiles spawn from the player muzzle and check hits each frame.

- **Phase 2** (`efc52ef`) — Data-driven arena loader (`ArenaLoader.tsx`,
  `Floor.tsx`, `Bounds.tsx` now take `config.bounds`), three telegraphed
  hazards (razor/crusher/laser) sharing `cyclePhase` timing, checkpoint
  beacons (`CheckpointZone.tsx`), death/respawn loop in `Player.tsx` (health
  ≤0 → teleport to checkpoint, full heal, suspicion cleared), screen-flash +
  player halo damage feedback. Verified: exactly-18-damage razor hits
  stacking 100→82→64→46→28→10, 6th hit triggers respawn to 100/100 health
  and suspicion 24→0.
- **Phase 1** (`f9a1550`) — Custom jetpack flight controller (gravity-zeroed
  dynamic Rapier body, fully velocity-driven so idle = hover not free-fall;
  pointer-lock mouse look; WASD relative thrust; Space/Ctrl vertical;
  Shift boost), third-person `FollowCamera` with raycast wall-clip avoidance,
  walled test-box collision. Verified: forward thrust + hover-to-rest,
  boosting into a wall stops the body at the boundary (speed → 0.00), camera
  mode switching has zero runtime errors.
- **Phase 0** (`ec8e27d`) — App shell (Vite/React 19/TS strict), typed event
  bus, zustand GameState store with a `shotFired → addSuspicion` demo wire,
  Draco-enabled glTF loader with a `player.glb` slot + capsule fallback,
  arena config schema + loader stub, debug overlay (FPS/camera/state/event
  log).

---

# PART 2 — Remaining Build Plan

Work phases in order: **3 → 4 → 5 → 6** completes the playable vertical
slice (the project's first real milestone — see "Milestone" at the end of
Phase 6). **7 → 8 → 9 → 10** come after, only once the slice is proven fun.
Do not start Phase 4 before Phase 3 is fully done and verified; do not start
Phase 7+ before the Phase 6 milestone is hit. Each ticket below has the same
shape as Part 1's established pattern: **Goal**, **Depends on**, **Files**,
**Implementation notes**, **Done-when**.

For every ticket: after implementing, run `npm run build` (must be clean),
then manually or headlessly verify the actual behavior, then update Part 1's
changelog before moving to the next ticket. Commit one ticket (or one
tightly-related phase) at a time, not the whole phase as one giant commit —
that's the pattern established so far and it keeps history useful.

## Phase 3 — Combat + Suspicion (the signature mechanic)

This is the most important phase in the whole plan. The suspicion model is
what makes this game *this* game, not a generic jetpack shooter. Take real
time tuning ticket 3.3.

### 3.1 — Firing + projectiles

**Goal:** a fire button that spawns a projectile, and hit detection against a
target.

**Depends on:** 1.1 (flight controller — done).

**Files to add:**
- `src/game/combat/Projectile.tsx` — a single projectile: spawns at the
  player's position/forward direction, moves forward at a fixed speed via
  `useFrame` (plain Three.js translation is fine here — projectiles don't
  need full Rapier rigid bodies; a fast-moving raycast-per-frame or a simple
  forward-march + radius check against targets is simpler and won't
  tunnel-through at projectile speeds the way a dynamic rigid body might).
  Self-despawns after a max lifetime or max range.
- `src/game/combat/useWeapon.ts` — a hook owning "can fire" cooldown logic
  and a list of active projectiles (plain array in a ref, not zustand —
  this is per-frame data, follow the `flightState` pattern, not the
  GameState pattern).
- `src/game/combat/Weapon.tsx` (or fold into `Player.tsx` — your call, but
  if you fold it in, keep the firing logic in its own function/section, not
  tangled into the flight math) — listens for the fire input (new key, e.g.
  `MouseLeft` via a `mousedown`/`mouseup` listener added to
  `useFlightInput.ts`, since that's already the canvas's pointer-lock input
  hub) and spawns projectiles on press, respecting a cooldown.

**Implementation notes:**
- Extend `useFlightInput.ts`'s tracked input to include the left mouse
  button (pointer lock still delivers `mousedown`/`mouseup` events on the
  locked element). Don't build a second, parallel input system — extend the
  existing `FlightInputState`.
- On every fire, emit `bus.emit("shotFired", { covered: <bool> })`. The
  `covered` value is a stub (`false`) until 3.2 lands cover detection — wire
  it up properly in 3.2, not before; don't guess at cover logic here.
- Remove or repurpose the Phase 0/leva `"Test: emit shotFired"` button once
  real firing exists — it was a scaffolding placeholder to prove the bus
  wiring before real combat existed. Decide whether to keep it as a debug
  cheat (useful for testing suspicion without flying into hazards) or
  delete it; document your choice in the changelog.
- A "target dummy" for the done-when test can be a simple static mesh with a
  sensor collider (reuse the hazard sensor pattern) that logs a hit or
  flashes color — it doesn't need to be a real enemy yet (that's Phase 4).

**Done-when:** pressing fire spawns a visible projectile that travels
forward from the player and registers a hit against a target dummy (visible
feedback — color flash, console log, whatever's cheapest — full "enemy takes
damage" UI is Phase 4's job).

### 3.1b — Aiming (3D soft lock-on)

**Goal:** default aim assist — projectiles auto-aim at the nearest valid
target in front of the player, while the *player* still controls *when* to
fire. (Per the build plan's design call in §3c: default = soft lock-on
unless told otherwise. If whoever's running this project wants a free
reticle instead, that's a product decision to confirm before building this
ticket, not something to silently change.)

**Depends on:** 3.1.

**Files to touch:** `src/game/combat/Projectile.tsx` or a new
`src/game/combat/targeting.ts` helper.

**Implementation notes:**
- "Nearest valid target in front of the player" = within some cone angle of
  the player's forward vector (reuse the `forward` vector math already
  established in `Player.tsx`) and within max range, picking the closest by
  distance among candidates. You'll need a registry of "targetable" objects
  — once enemies exist (Phase 4) this naturally becomes "all live enemies";
  for now during 3.x development you can target the same dummy(s) from 3.1.
  Don't over-build a generic ECS-style registry for this — a simple array
  ref that targetable things register/unregister into via a `useEffect` is
  enough at this scale.
- Render a small visible target indicator (a reticle/marker) on the locked
  target so the player gets feedback before firing.
- The projectile should home toward (or instantly hit, your call — homing
  reads better for soft-lock, instant-hit is simpler) the locked target, not
  require pixel-perfect player aim.

**Done-when:** firing reliably hits the marked target while the player
controls only *when* to fire, not precise aim; a visible indicator shows
which target is locked.

### 3.2 — Cover states (siren + smoke)

**Goal:** a siren on/off state and smoke zones that flag the player as
"covered," readable from a debug output.

**Depends on:** 2.2 (hazards — done, specifically the razor's
`siren: true` config field which was added in Phase 2 but never consumed
until now), 3.1.

**Files to add/touch:**
- `src/game/systems/coverState.ts` (or fold into `gameState.ts` — lean
  toward a *separate* small module since cover state is high-frequency and
  somewhat transient, similar reasoning to `flightState.ts`; read GameState's
  existing shape first and decide deliberately, then document the choice).
- `src/game/arena/SmokeZone.tsx` — finally render `config.smokeZones` (typed
  already in `types.ts` as `SmokeZoneConfig`, parsed since Phase 0/2 but
  never rendered — this is exactly the ticket that turns it on). A volumetric
  fog look is nice-to-have; a simple sensor zone + translucent particle/fog
  mesh is enough to start. Reuse the hazard sensor pattern for overlap
  detection (player inside smoke radius).
- Siren state: tie to the razor hazard's `siren: true` flag, or treat siren
  as its own independent arena-level timer — **decide which based on what
  reads better for the design** (a siren that's a property of one hazard vs.
  an arena-wide alarm state are different things; the original config schema
  suggests it's per-hazard, but the suspicion model in 3.3 treats "siren
  active" as a global cover multiplier — reconcile this before building, it
  affects the data model). A reasonable resolution: a global `sirenActive`
  boolean in cover state, set true while *any* siren-flagged hazard is in
  its "active" `cyclePhase`, emitting `bus.emit("sirenActive", {on})` on
  transitions (the event already exists in `GameEvents`, unused since
  Phase 0 — this is its ticket).
- Add a `covered: boolean` (or finer-grained cover *factor*, see 3.3) readout
  to `DebugOverlay.tsx`.

**Implementation notes:**
- This ticket only needs to answer "is the player covered right now" — the
  *suspicion math* that consumes it (the ×0.1/×0.15/etc. multipliers) is
  3.3's job. Keep this ticket's scope to detection + a debug readout, per
  the original plan's ticket boundary. Don't preemptively build the
  suspicion formula here.

**Done-when:** a debug readout (`DebugOverlay.tsx`) shows cover on/off (or
the cover factor) correctly as the player moves through a smoke zone and as
a siren-flagged hazard cycles through its active phase.

### 3.3 — Suspicion system (the real one)

**Goal:** replace the Phase 0 placeholder (`// TODO(3.3)` in
`gameState.ts`) with the actual model from the build plan spec.

**Depends on:** 3.2.

**Files to touch:** `src/game/systems/gameState.ts` (remove the placeholder
`bus.on("shotFired", ...)` block at the bottom), new
`src/game/systems/suspicion.ts` (the model logic, kept separate from the
store itself so the math is testable/readable independent of zustand
wiring).

**The model (from the build plan — implement exactly this, it's been spec'd
deliberately):**
- Per shot: `+BASE` (e.g. +12 — reuse the existing placeholder's number as a
  starting point, retune later), multiplied by a **cover factor**:
  - Visible, no cover → ×1.0
  - During a siren → ×0.1
  - Inside smoke/fog → ×0.15
  - Siren **and** smoke → ×0.0–0.05
  - Out of camera view / behind hard cover → ×0.1
- **Spam surcharge:** rapid consecutive shots add a small stacking burst
  (rewards timed, deliberate shots over spray-and-pray). Implement as e.g. a
  short rolling-window shot counter that adds a multiplier the faster shots
  repeat.
- **Decay:** `−DECAY/sec` when not firing; faster when hidden, when hazards
  (not the player) kill enemies, or when a section clears weaponless. Start
  with the baseline hidden/not-hidden decay rates; the "hazard killed an
  enemy" and "section cleared weaponless" bonuses depend on Phase 4 enemy
  death tracking (`enemyKilled: { id, byHazard }` is already in `GameEvents`,
  unused since Phase 0) — you can stub these two specific bonuses until
  Phase 4 lands real enemies, but build the baseline decay now.
- **Thresholds:** `60` → emit `suspicionThreshold: {level:"warning"}` (event
  already exists, unused), announcer hook lands in Phase 5 — for now this
  can just be observable in the debug overlay. `100` → emit
  `suspicionThreshold: {level:"detected"}`, **and** is ticket 3.4's trigger
  for spawning elite guards (depends on Phase 4 existing — see 3.4 below for
  how to sequence this without blocking on it).
- **Death resets suspicion** — already implemented in Phase 2's `respawn()`
  action; don't duplicate that logic, the existing store action is correct
  and this model should keep using it as-is.

**Implementation notes:**
- Wire firing (from 3.1) → cover state (from 3.2) → this model → `addSuspicion`/
  `decaySuspicion` (already exist as store actions). The data flow should be:
  fire → compute cover factor + spam surcharge → `addSuspicion(amount)`;
  every frame (or on a tick interval, doesn't need to be every single frame)
  → `decaySuspicion(rate * dt)`.
- Keep this event-driven, consistent with the architecture: suspicion.ts
  subscribes to `bus` events (`shotFired`, cover-state changes), it doesn't
  get called directly by the firing code. This is what "loose coupling" in
  the guiding principles means in practice — re-read principle #3 in the
  original build plan if this isn't clear.

**Done-when:** firing in the open spikes suspicion fast; firing under a
siren (or in smoke, or both) barely moves it; suspicion decays over time
when not firing; thresholds at 60/100 are observable (debug overlay at
minimum, announcer/lockdown integration comes in 3.4/5.x).

### 3.4 — Cheating-detected response

**Goal:** at suspicion 100, trigger a visible consequence.

**Depends on:** 3.3, **and conceptually on 4.1** (the original plan lists
this dependency because the "real" response is spawning elite guards, which
needs enemies to exist). **Sequencing note:** you can build the *event* and
a placeholder response (e.g. a screen alert, a forced siren, a console log)
in Phase 3 without blocking on Phase 4, then come back and wire the actual
elite-guard spawn once 4.1 lands. Don't leave this ticket half-done forever
— track explicitly in the changelog if you defer the enemy-spawn half.

**Files to touch:** `src/game/systems/suspicion.ts` or a new
`src/game/systems/lockdown.ts`.

**Done-when:** spamming unsafe shots in the open reliably triggers a
detectable lockdown response (full version: elite guards + drones spawn and
an announcer line fires, once 4.x/5.x exist; minimum acceptable for Phase 3
alone: the `suspicionThreshold:{level:"detected"}` event fires exactly once
per threshold crossing — not every frame suspicion stays at 100 — and
*something* observable happens).

---

## Phase 4 — Enemies (start with two)

### 4.1 — Arena Guard

**Goal:** a grounded(-ish — use your judgment, this is a flying-player game,
the guard can patrol on foot or hover, match the arena's visual language)
enemy that patrols, chases, attacks in melee/shock range, takes damage, and
dies.

**Depends on:** 1.3 (collision — done), 3.1 (firing — needed so the player
can damage it).

**Files to add:** `src/game/enemies/ArenaGuard.tsx`, plus a shared
`src/game/enemies/EnemyField.tsx` dispatcher (same pattern as
`HazardField.tsx` — **don't reinvent this dispatch pattern**, copy it).

**Implementation notes:**
- Enemies need a `health` of their own — this is **not** the player's
  `GameState.health`; give each enemy instance its own local health (a ref,
  decremented by projectile hits, similar to how the player's own collision
  detection works but the *enemy* owns the number, not the global store —
  the global store is player-only per its existing shape, don't repurpose
  it for enemy health).
- On death: emit `bus.emit("enemyKilled", { id, byHazard })`. This event
  already exists in `GameEvents` (Phase 0) and ticket 3.3's suspicion decay
  bonus depends on `byHazard` — make sure you set it correctly (`true` if a
  hazard killed it, `false` if the player's weapon did) since 3.3 already
  consumes this.
- Patrol/chase AI: a simple state machine (idle/patrol → chase → attack →
  dead) driven by distance-to-player checks each frame is sufficient for
  "start with two enemies" scope — don't build a general-purpose
  behavior-tree framework for this, it's premature for two enemy types.
- Extend `ArenaConfig`'s `enemies: unknown[]` field (currently untyped,
  parsed-but-unused since Phase 0) into a real typed `EnemyConfig` union in
  `types.ts`, following the exact same pattern as `HazardConfig`. Update
  `arena-01.json` to place at least one.

**Done-when:** the guard visibly threatens the player (patrols, notices and
chases when close, deals damage on contact/attack) and can be killed by
player fire (health depletes, dies, `enemyKilled` fires).

### 4.2 — Security Drone

**Goal:** a flying enemy that fires lasers at the player **and** can spot
the player firing in the open, bumping suspicion — this is the ticket that
actually ties combat to the suspicion loop (per the build plan's framing).

**Depends on:** 4.1, 3.3.

**Files to add:** `src/game/enemies/SecurityDrone.tsx`.

**Implementation notes:**
- Drone projectiles can reuse `Projectile.tsx` from 3.1 if its
  speed/lifetime/owner are parameterized (add an `owner: "player" |
  "enemy"` field so player-vs-enemy collision filtering is correct — a
  player projectile shouldn't hit the player, an enemy projectile shouldn't
  hit other enemies). If `Projectile.tsx` was built player-only in 3.1,
  this is the ticket to generalize it — don't fork a second
  near-duplicate projectile component.
- "Spots you firing in the open" = the drone has line-of-sight to the
  player AND the player fires while not covered (reuses 3.2's cover state) →
  call `useGameState.getState().addSuspicion(n)` with its own tuning
  constant, separate from the base suspicion model's open-shot penalty (this
  is a *second* source of suspicion increase, stacking with 3.3's model, not
  replacing it).

**Done-when:** drones fire at the player, and firing unsafely within a
drone's sight-line measurably increases suspicion beyond what 3.3 alone
would apply.

*(Blade Bot, Riot Guard, Sniper, Turret, Jet Trooper are explicitly deferred
to Phase 7.1 per the original plan — do not build them now even if you have
spare time; stay on the vertical-slice path.)*

---

## Phase 5 — AI Announcer

### 5.1 — Bark system

**Goal:** event-driven announcer lines triggered by gameplay events, pulled
from config rather than hardcoded.

**Depends on:** 0.3 (event bus — done).

**Files to add:**
- `src/game/announcer/lines.ts` or `src/game/config/announcer/*.json` —
  decide whether bark text lives in code or JSON; given the project's
  data-driven-content principle (guiding principle #2), **JSON is the
  better fit**, consistent with how arenas are configured. `arena-01.json`
  already has an `announcer: { intro, events }` field (parsed since Phase 0,
  unused) — this is its ticket.
- `src/game/announcer/Announcer.tsx` — subscribes to the relevant bus events
  (hazard warnings, low-HP, `suspicionThreshold`, `checkpointReached`, etc.)
  and looks up + displays/plays the matching line.
- A caption/text display — for now this can be a simple UI element (extend
  `src/ui/Hud.tsx`, which has sat empty since Phase 0 specifically waiting
  for real HUD content to start arriving — this is a reasonable first thing
  to put in it, though full HUD polish is Phase 10).

**Implementation notes:**
- Keep this decoupled the same way everything else is: Announcer.tsx
  subscribes to `bus`, it doesn't get called directly by hazard/suspicion/
  combat code. Re-read the architecture note in Part 1 about event-driven
  systems if tempted to call the announcer directly from elsewhere.

**Done-when:** at least the arena intro line and a couple of gameplay event
lines (hazard warning, low-HP, suspicion warning) fire at the right moments,
sourced from config.

### 5.2 — Character arc flag

**Goal:** `storyProgress` (already in `GameState` since Phase 0:
`believer | doubter | ally`) swaps which line set the announcer pulls from.

**Depends on:** 5.1.

**Implementation notes:** the store action `setStory` already exists
(Phase 0) — this ticket is purely about the announcer *consuming* it, plus
deciding (a product/narrative decision, flag it if unclear) what gameplay
events actually advance the story flag forward. Don't invent the narrative
beats yourself if they're not specified anywhere — ask before guessing.

**Done-when:** late-game arenas (or a forced test of `setStory("ally")`) use
a different, "helping" line set than the early `"believer"` default.

### 5.3 — Voice

**Goal:** lines are heard or read clearly.

**Depends on:** 5.1.

**Implementation notes:** start with text captions (already covered by 5.1
if you built a caption display). TTS is explicitly optional/"start with
text first" per the original plan — don't block on voice acting or a TTS
integration if it's not readily available; text-only satisfies this ticket.

**Done-when:** every bark triggered in 5.1 is legible (captioned), with TTS
as a stretch addition if time/tooling allows.

---

## Phase 6 — Tutorial (Orientation Arena) → vertical slice milestone

### 6.1 — Orientation arena

**Goal:** rebuild/extend `arena-01.json` ("Orientation") into the doc's
in-character tutorial teaching, **in order**: movement → jetpack → hazards →
the "no ammunition" weapon gag → sirens → smoke → suspicion → exit, with
**no pop-up text** — everything taught through the announcer (5.x) and
level layout itself.

**Depends on:** Phases 1–5, all complete.

**Implementation notes:**
- This is largely a *content* ticket, not a new-systems ticket — you're
  composing existing pieces (hazards, checkpoints, cover zones, announcer
  barks) into a deliberately-paced teaching sequence, the same way a level
  designer would, using the JSON config + announcer config as your tools.
  If you find yourself needing a new *system* to pull this off, stop and
  check whether it actually belongs in an earlier phase instead.
- "No ammunition" gag: per the source material this is a flavor/narrative
  beat (the weapon has no visible ammo counter/reload — verify this
  framing against the original game-design notes if available; if not
  available, treat it as "the weapon never needs reloading and the
  announcer makes a dry joke about it" and move on, don't block on
  documentation that doesn't exist).

**Done-when (= the milestone — read this carefully, it's the project's
first real "is this game real" checkpoint):**

A player can, in one browser session: complete the orientation tutorial,
enter Arena 1, fly/dodge at least 2 hazard types, encounter the Arena Guard
+ Security Drone, fire the hidden weapon *only safely* (suspicion stays low
under siren/smoke but spikes in the open and triggers the lockdown if
abused), take damage with visible suit wear, respawn at a checkpoint, and
reach the exit — all while the announcer reacts to events.

**Explicitly out of scope for this milestone:** bosses, arenas 2+, the other
five enemy types, full narrative cutscenes, final HUD polish, audio mix, the
Synty art reskin. If the loop above is fun, the foundation is proven and
everything after this is multiplying it, not re-architecting it. If it
*isn't* fun, that's a signal to go back and retune feel (flight, suspicion
thresholds, hazard pacing) before adding more content — don't push forward
into Phase 7 on a loop that doesn't feel good yet.

---

## Phase 7 — Content multiplication

Only start this phase once Phase 6's milestone is genuinely hit and the loop
has been played and feels good — not just "the code compiles."

- **7.1 Remaining enemies** — Blade Bot, Riot Guard, Sniper, Turret, Jet
  Trooper. Follow the `EnemyField.tsx` dispatch pattern from 4.x.
- **7.2 Arenas 2–N via config** — new `src/game/config/arenas/arena-NN.json`
  files, escalating hazard/enemy combinations. This should require **zero**
  new engine code if the data-driven architecture held — if you find
  yourself needing to touch `ArenaLoader.tsx` or `types.ts` to add a new
  arena, that's a signal the schema wasn't general enough and needs a
  targeted fix, not a one-off hack in this arena's file.
- **7.3 Medical stations + hidden health packs** — reuse the sensor-zone
  pattern (hazards, checkpoints) for pickup detection; add a `heal()` call
  (already exists on the store) on pickup.
- **7.4 Difficulty options** — Easy/Normal/Hard presets tuning HP, checkpoint
  frequency, suspicion rate, enemy aggression. A simple config object
  selected at game start, not a deep settings system.

## Phase 8 — Bosses

- **8.1 Rival (Contestant #13)** — recurring character, escapes early
  fights, showdown before the finale.
- **8.2 Arena Executioner** — single elite "Protocol Omega" enemy: smoke
  grenades, rockets, charge attack. Reuse the smoke-zone (3.2) and
  projectile (3.1/4.2) systems rather than building boss-specific versions.
- **8.3 The Director** — 3-phase finale (platform/drones → aerial jetpack
  duel → arena overload testing everything learned). This is the largest
  single ticket in the whole plan — consider breaking it into three
  sub-tickets per phase of the fight when you get here.

## Phase 9 — Narrative wrappers

- **9.1 Intro** — rigged trial + jetpack/ammo cutscene.
- **9.2 TV-broadcast loading screen** ("NOW PRESENTING… Contestant #9423…
  Operating a Toaster Without a Permit") — preserve this exact tone, it's
  called out explicitly in the guiding principles as part of "the soul" of
  the game. Don't sand the humor down.
- **9.3 Endings** — the AI broadcasts evidence; exoneration. **Which
  ending(s) ship is an open product decision** (flagged as such in the
  original plan, §2 and §6) — confirm before building, don't unilaterally
  pick one.

## Phase 10 — Polish

- **10.1 Full HUD** — health, suspicion meter, broadcast overlays, jumbotron.
  Replace the still-empty `src/ui/Hud.tsx` stub for real this time.
- **10.2 Audio pass** — crowd, sirens, jetpack, doors.
- **10.3 "Juice"** — camera shake, hit feedback, neon/cyberpunk lighting pass.
- **10.4 Performance + browser/mobile testing** — this is also where the
  large JS bundle (noted in Part 1's known issues) should actually get
  addressed via code-splitting, not before.
- **10.5 Easter eggs** — JUJU's billboard cameo, the long-name verdict gag.
  Preserve these too, per the same "keep the kids' voice" principle as 9.2.

---

## Open product decisions (confirm before building, don't guess)

These were flagged as unresolved in the original build plan and are still
unresolved as of this writing. Don't silently pick an answer for any of
these — surface the question to whoever owns the project:

1. **Aiming model** — this plan defaults to soft lock-on (3.1b) per the
   original recommendation, but it's still a confirmable choice, not a
   locked one.
2. **Which ending(s) ship** (9.3).
3. Any remaining **source-document narrative decisions** (title, the "47" →
   Contestant #9423 cleanup mentioned in the original plan's assumptions
   table) — if you find references to "47" anywhere in config/content you
   write, that's a placeholder that should resolve to Contestant #9423 per
   assumption A7.
