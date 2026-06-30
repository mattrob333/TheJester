# The Jester

A 3D jetpack arena game built with **React Three Fiber**. This repository
currently contains:

- **Phase 0 scaffold** (tickets 0.1 / 0.3 / 0.4) — app shell, typed event bus,
  central game-state store, glTF asset pipeline.
- **Phase 1 movement core** (tickets 1.1 / 1.2 / 1.3) — a custom 3D jetpack
  flight controller, a third-person follow camera, and collision against test
  bounds.

**No combat, hazards, enemies, or suspicion mechanic yet** — see "What's
stubbed for later tickets" below.

## Tech stack

| Concern    | Library |
| ---------- | ------- |
| Build/dev  | Vite + React + TypeScript (strict) |
| Rendering  | `three`, `@react-three/fiber`, `@react-three/drei` |
| Physics    | `@react-three/rapier` (dynamic player body, static floor/walls/ceiling) |
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

You should see: a lit infinite grid floor inside a faintly-walled test box, a
magenta placeholder player capsule, a third-person follow camera, the leva
panel (top-right), and the debug overlay (top-left).

### Flight controls (follow camera mode — the default)

- **Click the canvas** to engage pointer lock (mouse look).
- **W / A / S / D** — move forward/back/strafe, relative to where you're looking.
- **Mouse** — look (yaw + pitch); forward thrust follows pitch, so looking up
  and pressing W flies up.
- **Space / Ctrl** — vertical thrust up/down.
- **Shift** — boost (higher top speed).
- No input → the jetpack **hovers** in place (gravity is zeroed; velocity is
  fully input-driven, not simulated free-fall).
- **Esc** releases pointer lock (browser default).

### Dev controls (leva panel)

- **`camera mode`** — `follow` (gameplay, above) / `orbit` (drei OrbitControls)
  / `freeFly` (drei FlyControls). Flight input is only live in `follow` mode so
  it never fights the dev camera controls for the mouse.
- **`physics debug`** — draws Rapier collider wireframes.
- **`Test: emit shotFired`** — emits `shotFired {covered:false}` on the bus.
  Watch the debug overlay log it **and** `suspicion` tick up by 12 (proves
  bus → store wiring end-to-end).
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
    Game.tsx                    scene root: lights, floor, bounds, player, camera, leva
    systems/
      events.ts                 typed event bus + GameEvents map (mitt)
      gameState.ts              zustand store + demo bus→store wiring
    player/
      Player.tsx                jetpack flight controller (dynamic Rapier body, glb slot)
      flightState.ts            shared per-frame flight data (position/yaw/pitch/velocity)
      useFlightInput.ts         keyboard + pointer-lock mouse-look input hook
    camera/
      FollowCamera.tsx          third-person follow cam, raycast wall-clip avoidance
    arena/
      ArenaLoader.tsx           reads arena config, logs it, renders spawn/exit markers
      Bounds.tsx                Phase-1 test-box walls/ceiling (collision proving ground)
    config/arenas/arena-01.json example arena config
    types.ts                    ArenaConfig + shared types
  lib/loadGltf.ts               drei useGLTF + Draco helper (+ preload)
  ui/
    DebugOverlay.tsx            FPS, camera pos, speed, live GameState, event log
    Hud.tsx                     in-game HUD stub (empty)
    telemetry.ts                in-canvas → overlay bridge (camera position, speed)
public/
  models/                       .glb assets (served statically)
  draco/                        optional self-hosted Draco decoder
```

## What's stubbed for later tickets

This repo deliberately implements only the foundation + movement core so far.
Left for later:

- **Hazards & smoke zones** (2.x) — `hazards`/`smokeZones` parsed but not spawned;
  `Bounds.tsx` is a placeholder test box, not real arena geometry.
- **Health / damage UI** (2.3) — only the debug readout exists.
- **Checkpoint logic** (2.4) — checkpoints in config but no activation logic.
- **Firing / aiming** (3.x) — only the `shotFired` smoke-test button.
- **Real suspicion model** (3.3) — current `addSuspicion(12)` on uncovered shot
  is a placeholder; see `// TODO(3.3)` in `gameState.ts`.
- **Enemies** (4.x) — `enemies` parsed but not spawned.
- **Announcer barks** (5.x) — `announcer` config carried but unused.
- **Tutorial** (6), bosses, narrative, audio, final HUD.

The event map, store shape, arena schema, flight state, and asset pipeline are
intentionally extensible so later systems bolt on without rework.
