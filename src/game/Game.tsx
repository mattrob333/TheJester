import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, FlyControls, Stats, Stars, Sparkles, Environment, Lightformer } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import { Physics } from "@react-three/rapier";
import { useControls, folder } from "leva";
import { Vector3 } from "three";
import { useGameState } from "./systems/gameState";
import { useAppState } from "./systems/appState";
import { updateSuspicion, resetSuspicion } from "./systems/suspicion";
import { updateLockdown, resetLockdown } from "./systems/lockdown";
import { resetWeapon } from "./combat/useWeapon";
import { resetEffects } from "./effects/effects";
import { resetSound } from "./systems/sound";
import { resetRunStats, trackPeakSuspicion } from "./systems/runStats";
import { lockOnState } from "./combat/lockOn";
import { Player } from "./player/Player";
import { createFlightState } from "./player/flightState";
import { FollowCamera } from "./camera/FollowCamera";
import { ArenaLoader } from "./arena/ArenaLoader";
import { activeArena } from "./config/activeArena";
import { telemetry } from "../ui/telemetry";
import { Projectiles } from "./combat/Projectile";
import { LockOnIndicator } from "./combat/LockOnIndicator";
import { Announcer } from "./announcer/Announcer";
import { Effects } from "./effects/Effects";

/**
 * SystemsTicker — hosts the game-logic systems that used to run on their own
 * `setInterval`s (code-review §2.4). Everything now steps on the same
 * `useFrame` dt as the rest of the simulation, and ONLY while the game is
 * actually being played: hiding the tab, the title screen, and the victory
 * screen all genuinely pause the model (no more suspicion decaying behind a
 * menu, no doubled timers under HMR).
 */
function SystemsTicker() {
  useFrame((_, rawDt) => {
    if (useAppState.getState().phase !== "playing") return;
    const dt = Math.min(rawDt, 1 / 15); // clamp tab-switch spikes
    updateSuspicion(dt);
    updateLockdown();
    trackPeakSuspicion(useGameState.getState().suspicion);
  });
  return null;
}

/** Reports the live camera position into the telemetry bridge each frame. */
function CameraReporter() {
  const camera = useThree((s) => s.camera);
  useFrame(() => {
    telemetry.camPos = [camera.position.x, camera.position.y, camera.position.z];
  });
  return null;
}

/**
 * Slow orbital flyover used behind the title/loading screens — hands off to
 * FollowCamera (which lerps) the moment gameplay starts, so the transition
 * sweeps smoothly down to the player instead of cutting.
 */
function CinematicCamera() {
  const camera = useThree((s) => s.camera);
  const lookAt = useMemo(() => new Vector3(14, 2, 0), []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 0.12;
    camera.position.set(
      14 + Math.cos(t) * 26,
      10 + Math.sin(t * 0.7) * 4,
      Math.sin(t) * 18,
    );
    camera.lookAt(lookAt);
  });
  return null;
}

export function Game() {
  const flightState = useRef(createFlightState(activeArena.spawn)).current;
  const phase = useAppState((s) => s.phase);
  const runId = useAppState((s) => s.runId);
  const devMode = useAppState((s) => s.devMode);

  // Seed the respawn checkpoint from the loaded arena (Ticket 2.4) rather than
  // relying on the GameState default coincidentally matching arena-01's spawn.
  useEffect(() => {
    useGameState.getState().setCheckpoint(activeArena.spawn);
  }, []);

  // Full run reset when gameplay starts (code-review §2.5): game state,
  // weapon pool + cooldowns, suspicion model, lockdown (incl. its siren
  // source), live particles, sustained sounds, stats, and the lock-on. The
  // arena itself is remounted via key={runId} below, which resurrects dead
  // enemies, un-greens checkpoints, and re-arms tutorial beacons.
  useEffect(() => {
    if (phase !== "playing") return;
    const gs = useGameState.getState();
    gs.reset();
    gs.setCheckpoint(activeArena.spawn);
    flightState.position.set(...activeArena.spawn);
    flightState.velocity.set(0, 0, 0);
    flightState.yaw = -Math.PI / 2;
    flightState.pitch = 0;
    resetWeapon();
    resetSuspicion();
    resetLockdown();
    resetEffects();
    resetSound();
    resetRunStats();
    lockOnState.targetId = null;
  }, [phase, flightState]);

  // Dev controls: camera mode + physics debug.
  const { cameraMode, showPhysicsDebug } = useControls("Dev", {
    cameraMode: {
      value: "follow",
      options: ["follow", "orbit", "freeFly"],
      label: "camera mode",
    },
    showPhysicsDebug: { value: false, label: "physics debug" },
  });

  // Flight tuning — exposed live so feel can be dialed in without redeploying.
  const flightSettings = useControls("Flight", {
    tuning: folder({
      maxSpeed: { value: 12, min: 2, max: 40, step: 0.5 },
      boostMultiplier: { value: 1.8, min: 1, max: 4, step: 0.1 },
      acceleration: { value: 6, min: 0.5, max: 20, step: 0.5, label: "thrust response" },
      mouseSensitivity: { value: 0.0022, min: 0.0005, max: 0.01, step: 0.0001 },
    }),
  });

  const playing = phase === "playing";
  const flightActive = playing && cameraMode === "follow";

  return (
    <>
      {/* Atmosphere: cold arena night with hot pools of colored light. */}
      <color attach="background" args={["#05060d"]} />
      <fog attach="fog" args={["#070a14", 45, 170]} />
      <ambientLight intensity={0.5} color="#b8c4ff" />
      <directionalLight
        position={[20, 30, 10]}
        intensity={1.5}
        color="#fff4e0"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={1}
        shadow-camera-far={120}
        shadow-camera-left={-60}
        shadow-camera-right={60}
        shadow-camera-top={60}
        shadow-camera-bottom={-60}
      />
      {/* colored rim lights — cheap mood, no shadows */}
      <directionalLight position={[-30, 12, -20]} intensity={0.5} color="#7c3aed" />
      <directionalLight position={[10, 8, 25]} intensity={0.35} color="#0ea5e9" />

      {/* Sky + drifting dust motes */}
      <Stars radius={220} depth={60} count={2500} factor={5} saturation={0.4} fade speed={0.6} />
      <Sparkles count={120} scale={[80, 18, 26]} position={[10, 9, 0]} size={1.6} speed={0.25} opacity={0.35} color="#9db4ff" />

      {/* Local light-studio environment map so metals/armor have something to reflect. */}
      <Environment resolution={64} frames={1}>
        <Lightformer intensity={2} position={[0, 20, 0]} scale={[40, 40, 1]} rotation={[Math.PI / 2, 0, 0]} color="#4c5b9e" />
        <Lightformer intensity={1.2} position={[-30, 6, 0]} scale={[20, 8, 1]} rotation={[0, Math.PI / 2, 0]} color="#7c3aed" />
        <Lightformer intensity={1.2} position={[30, 6, 0]} scale={[20, 8, 1]} rotation={[0, -Math.PI / 2, 0]} color="#0ea5e9" />
      </Environment>

      <Physics debug={showPhysicsDebug} gravity={[0, -9.81, 0]}>
        {/* Keyed on runId: "play again" fully remounts the level — enemies
            respawn, checkpoints/beacons re-arm, cover sources re-register. */}
        <ArenaLoader key={runId} config={activeArena} />
        <Player flightState={flightState} settings={flightSettings} active={flightActive} />
        <Projectiles />
        <LockOnIndicator />

        {/*
          "follow" = real gameplay camera, tracks the player. It must live
          inside <Physics> — it raycasts against the world via useRapier().
          "orbit" / "freeFly" = Phase 0 dev cameras for inspecting the scene;
          flight input is disabled in these modes so it never fights the
          camera controls for the mouse.
        */}
        {playing && cameraMode === "follow" && <FollowCamera state={flightState} />}
      </Physics>

      <Effects />

      {/* Title/loading flyover */}
      {!playing && <CinematicCamera />}

      {playing && cameraMode === "orbit" && (
        <OrbitControls makeDefault target={[0, 1, 0]} maxPolarAngle={Math.PI * 0.495} />
      )}
      {playing && cameraMode === "freeFly" && (
        <FlyControls movementSpeed={15} rollSpeed={0.6} dragToLook />
      )}

      {/* Post-processing: bloom lifts every emissive/tracer/flame into a glow. */}
      <EffectComposer>
        <Bloom intensity={0.85} luminanceThreshold={1} mipmapBlur />
        <Vignette eskil={false} offset={0.22} darkness={0.72} />
      </EffectComposer>

      <SystemsTicker />
      <CameraReporter />
      {devMode && <Stats />}
      {playing && <Announcer />}
    </>
  );
}
