import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, FlyControls, Stats } from "@react-three/drei";
import { Physics } from "@react-three/rapier";
import { useControls, folder } from "leva";
import { useGameState } from "./systems/gameState";
import "./systems/suspicion"; // Ticket 3.3 — side-effect import, registers the suspicion model
import "./systems/lockdown"; // Ticket 3.4 — side-effect import, registers the lockdown response
import { Player } from "./player/Player";
import { createFlightState } from "./player/flightState";
import { FollowCamera } from "./camera/FollowCamera";
import { ArenaLoader } from "./arena/ArenaLoader";
import { activeArena } from "./config/activeArena";
import { telemetry } from "../ui/telemetry";
import { Projectiles } from "./combat/Projectile";
import { LockOnIndicator } from "./combat/LockOnIndicator";
import { Announcer } from "./announcer/Announcer";

/** Reports the live camera position into the telemetry bridge each frame. */
function CameraReporter() {
  const camera = useThree((s) => s.camera);
  useFrame(() => {
    telemetry.camPos = [camera.position.x, camera.position.y, camera.position.z];
  });
  return null;
}

export function Game() {
  const flightState = useRef(createFlightState(activeArena.spawn)).current;

  // Seed the respawn checkpoint from the loaded arena (Ticket 2.4) rather than
  // relying on the GameState default coincidentally matching arena-01's spawn.
  useEffect(() => {
    useGameState.getState().setCheckpoint(activeArena.spawn);
  }, []);

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

  const flightActive = cameraMode === "follow";

  return (
    <>
      {/* Lighting: ambient + one shadow-casting directional. */}
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[20, 30, 10]}
        intensity={1.4}
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

      <Physics debug={showPhysicsDebug} gravity={[0, -9.81, 0]}>
        <ArenaLoader config={activeArena} />
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
        {cameraMode === "follow" && <FollowCamera state={flightState} />}
      </Physics>

      {cameraMode === "orbit" && (
        <OrbitControls makeDefault target={[0, 1, 0]} maxPolarAngle={Math.PI * 0.495} />
      )}
      {cameraMode === "freeFly" && <FlyControls movementSpeed={15} rollSpeed={0.6} dragToLook />}

      <CameraReporter />
      <Stats />
      <Announcer />
    </>
  );
}
