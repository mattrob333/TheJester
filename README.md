# The Jester

A 3D jetpack arena game built with **React Three Fiber**. This repository
currently contains:

- **Phase 0 scaffold** (tickets 0.1 / 0.3 / 0.4) — app shell, typed event bus,
  central game-state store, glTF asset pipeline.
- **Phase 1 movement core** (tickets 1.1 / 1.2 / 1.3) — a custom 3D jetpack
  flight controller, a third-person follow camera, and collision.
- **Phase 2 arena, hazards & survival** (tickets 2.1 / 2.2 / 2.3 / 2.4) — a
  data-driven arena loader, three telegraphed hazard types, health/damage
  feedback, and checkpoint-based respawn.

- **Phase 3 combat + suspicion**: LMB firing, projectiles, soft lock-on,
  smoke/siren cover, suspicion decay/thresholds, and lockdown response.
- **Phase 4 enemies**: arena guard and security drone.
- **Phase 5 announcer**: JSON-driven event barks and HUD captions.
- **Phase 6 orientation tutorial beats**: movement, jetpack, hazards,
  no-ammo gag, sirens, smoke, suspicion, and exit beacons.

**Picking this project up?** Read **[`DEVELOPMENT_LOG.md`](./DEVELOPMENT_LOG.md)**
first — it documents the architecture and gotchas behind everything built so
far, and lays out the full ticket-by-ticket plan for everything left to
build, in order, through to a shippable game.

## Tech stack

| Concern    | Library |
| ---------- | ------- |
| Build/dev  | Vite + React + TypeScript (strict) |
| Rendering  | `three`, `@react-three/fiber`, `@react-three/drei` |
| Physics    | `@react-three/rapier` (dynamic player body, fixed floor/walls/hazard sensors) |
| Game state | `zustand` (read/writable outside the React render loop) |
| Dev GUI    | `leva` + drei `<Stats/>` (FPS) |
| Events     | `mitt` (typed singleton bus) |

Versions are pinned in `package.json` and verified peer-compatible
(React 19 ↔ R3F 9 ↔ drei 10 ↔ rapier 2 ↔ three 0.185).

## Run

```bash
npm install
npm run dev        # http://localhost:5173
```

You should see: a data-driven arena (lit grid floor, walls, three hazards, two
checkpoint beacons, green spawn / red exit markers), a magenta placeholder
player capsule, a third-person follow camera, the leva panel (top-right), and
the debug overlay (top-left).

### Flight controls (follow camera mode — the default)

- **Click the canvas** to engage mouse look. Pointer lock is used when the
  browser allows it; embedded browsers fall back to cursor movement over the
  canvas.
- **W / A / S / D** — move forward/back/strafe, relative to where you're looking.
- **Mouse** — look (yaw + pitch); forward thrust follows pitch, so looking up
  and pressing W flies up.
- **Left mouse button** — fire the hidden weapon.
- **Right mouse button** — focus mouse look without firing.
- **Space / Ctrl** — vertical thrust up/down.
- **Shift** — boost (higher top speed).
- No input → the jetpack **hovers** in place (gravity is zeroed; velocity is
  fully input-driven, not simulated free-fall).
- **Esc** releases pointer lock (browser default).
- **T** — toggle **keyboard-turn mode** (accessibility option, Ticket 6.3):
  while active, **Arrow Left/Right/Up/Down** turn/look continuously, no
  mouse required. Works independently of pointer-lock/drag-to-look state —
  toggle back with T to return to mouse-look. Current mode is shown in the
  debug overlay's `control mode` row.

### Arena 1 — Orientation

- **Razor** (x≈10) — continuously spinning blade, always armed (steady red
  beacon, no telegraph cycle). 18 damage per contact, 0.5s hit cooldown.
- **Crusher** (x≈18) — slams down on a 2.5s cycle, telegraphed by a blinking
  warning beacon ~0.6s before impact. 40 damage while active.
- **Laser gate** (x≈28) — charges (yellow glow) then fires a beam across the
  corridor on a 3s cycle. 15 damage per tick while the beam is live.
- **Checkpoints** — blue beacons at spawn and x≈20; flying through one sets it
  as your respawn point and turns it green.
- **Death & respawn** — health hitting 0 teleports you to the last checkpoint,
  fully heals you, and **clears suspicion** (per the build plan's "death
  resets suspicion" rule). Verified end-to-end: 5 razor hits (100→82→64→46→
  28→10), a 6th triggers respawn back to 100/100 health with suspicion reset
  to 0.
- A red vignette flashes on screen and a translucent halo flashes around the
  player on every hit (Ticket 2.3 "suit damage" feedback).

### Dev controls (leva panel)

- **`camera mode`** — `follow` (gameplay, above) / `orbit` (drei OrbitControls)
  / `freeFly` (drei FlyControls). Flight input is only live in `follow` mode so
  it never fights the dev camera controls for the mouse.
- **`physics debug`** — draws Rapier collider wireframes (including hazard/
  checkpoint sensor volumes).
- **Flight → tuning** — live-tunable `maxSpeed`, `boostMultiplier`,
  `acceleration` (thrust response), `mouseSensitivity`.

## Build

```bash
npm run build      # tsc -b (zero TS errors, strict) + vite build → dist/
npm run preview    # serve the production build locally
```

## Deploy (Vercel)

The project uses the Vite framework preset.

| Setting          | Value         |
| ---------------- | ------------- |
| Framework preset | Vite          |
| Build command    | `vite build`  |
| Output directory | `dist`        |
| Install command  | `npm install` |

`vercel.json` pins these and adds a SPA rewrite. Deploy with:

```bash
vercel             # preview deployment
vercel --prod      # production
```

Always confirm `npm run build` succeeds locally before deploying.

## Asset pipeline (rule — enforced)

> **Every model enters the project as glTF/`.glb` and is loaded via the
> `loadGltf` helper (`src/lib/loadGltf.ts`). No FBX/OBJ is committed — convert
> to glb first.**

- `loadGltf` wraps drei's `useGLTF` with **Draco** decompression. It defaults to
  the Google-hosted decoder (no committed binaries); to self-host, see
  `public/draco/README.md` and set `DRACO_DECODER_PATH = "/draco/"`.
- `loadGltf.preload(url)` warms the cache before mount.
- glb files live in `public/models/` and are served statically.
- **Player model slot:** drop a `public/models/player.glb` in and the player
  component loads it automatically (via the pipeline helper); otherwise it falls
  back to the primitive capsule. See `src/game/player/Player.tsx`.
- Asset provenance is logged in `CREDITS.md` (targets: Kenney + Quaternius CC0,
  Mixamo for animation later).

## Project layout

```
src/
  main.tsx                      app entry
  App.tsx                       <Canvas> + HTML overlay layer
  game/
    Game.tsx                    scene root: lights, arena, player, camera, leva
    systems/
      events.ts                 typed event bus + GameEvents map (mitt)
      gameState.ts              zustand store (health/suspicion/checkpoint/story + respawn)
    player/
      Player.tsx                jetpack flight controller, death/respawn, damage-flash halo
      flightState.ts            shared per-frame flight data (position/yaw/pitch/velocity)
      useFlightInput.ts         keyboard + pointer-lock mouse-look input hook
    camera/
      FollowCamera.tsx          third-person follow cam, raycast wall-clip avoidance
    arena/
      ArenaLoader.tsx           builds the level from an ArenaConfig: floor/walls/hazards/checkpoints
      Floor.tsx                 arena-sized ground + physics body
      Bounds.tsx                arena-sized walls/ceiling
      CheckpointZone.tsx        checkpoint trigger + beacon (blue → green on reach)
      hazards/
        hazardTiming.ts         shared idle→warning→active cycle timing
        RazorHazard.tsx         always-armed spinning blade
        CrusherHazard.tsx       cyclic slam hazard, telegraphed
        LaserHazard.tsx         cyclic beam hazard, telegraphed
        HazardField.tsx         dispatches config entries to the right hazard component
    config/
      activeArena.ts            single source of truth for "which arena is loaded"
      arenas/arena-01.json      Orientation arena config
    types.ts                    ArenaConfig + hazard/bounds/smoke-zone types
  lib/loadGltf.ts               drei useGLTF + Draco helper (+ preload)
  ui/
    DebugOverlay.tsx            FPS, camera pos, speed, live GameState, event log
    DamageFlash.tsx             full-screen red flash on playerDamaged
    Hud.tsx                     in-game HUD stub (empty)
    telemetry.ts                in-canvas → overlay bridge (camera position, speed)
public/
  models/                       .glb assets (served statically)
  draco/                        optional self-hosted Draco decoder
```

## What's stubbed for later tickets

This repo implements the foundation through the current orientation tutorial
slice: movement, hazards, survival, firing/projectiles, suspicion/cover,
lockdown, two enemy types, announcer barks, and tutorial beacons. Left for
later:

- **Enemy expansion** — Blade Bot, Riot Guard, Sniper, Turret, Jet Trooper.
- **Arenas 2+ and pickups** — additional data-driven arenas, medical stations,
  hidden health packs, and difficulty presets.
- **Bosses and narrative wrappers** — rival, executioner, director, intro,
  loading screen, and endings.
- **Polish** — final HUD, audio, visual juice, performance work, and Easter eggs.

The event map, store shape, arena schema, flight state, and asset pipeline are
intentionally extensible so later systems bolt on without rework.
