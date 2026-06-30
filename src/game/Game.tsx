import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Grid, OrbitControls, FlyControls, Stats } from "@react-three/drei";
import { Physics, RigidBody, CuboidCollider } from "@react-three/rapier";
import { useControls, button, folder } from "leva";
import { bus } from "./systems/events";
import { Player } from "./player/Player";
import { createFlightState } from "./player/flightState";
import { FollowCamera } from "./camera/FollowCamera";
import { Bounds } from "./arena/Bounds";
import { ArenaLoader } from "./arena/ArenaLoader";
import { telemetry } from "../ui/telemetry";

/** Reports the live camera position into the telemetry bridge each frame. */
function CameraReporter() {
  const camera = useThree((s) => s.camera);
  useFrame(() => {
    telemetry.camPos = [camera.position.x, camera.position.y, camera.position.z];
  });
  return null;
}

/** Large static ground with a matching physics body. */
function Floor() {
  return (
    <RigidBody type="fixed" colliders={false}>
      <CuboidCollider args={[100, 0.1, 100]} position={[0, -0.1, 0]} />
      <Grid
        args={[200, 200]}
        cellSize={1}
        cellThickness={0.6}
        cellColor="#1f2937"
        sectionSize={10}
        sectionThickness={1.2}
        sectionColor="#3b82f6"
        fadeDistance={120}
        fadeStrength={1}
        infiniteGrid
        followCamera={false}
      />
    </RigidBody>
  );
}

export function Game() {
  const flightState = useRef(createFlightState()).current;

  // Dev controls: camera mode + physics debug + the Phase 0 bus smoke-test button.
  const { cameraMode, showPhysicsDebug } = useControls("Dev", {
    cameraMode: {
      value: "follow",
      options: ["follow", "orbit", "freeFly"],
      label: "camera mode",
    },
    showPhysicsDebug: { value: false, label: "physics debug" },
    "Test: emit shotFired": button(() => bus.emit("shotFired", { covered: false })),
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
        <Floor />
        <Bounds />
        <Player flightState={flightState} settings={flightSettings} active={flightActive} />

        {/*
          "follow" = real gameplay camera, tracks the player. It must live
          inside <Physics> — it raycasts against the world via useRapier().
          "orbit" / "freeFly" = Phase 0 dev cameras for inspecting the scene;
          flight input is disabled in these modes so it never fights the
          camera controls for the mouse.
        */}
        {cameraMode === "follow" && <FollowCamera state={flightState} />}
      </Physics>

      <ArenaLoader />

      {cameraMode === "orbit" && (
        <OrbitControls makeDefault target={[0, 1, 0]} maxPolarAngle={Math.PI * 0.495} />
      )}
      {cameraMode === "freeFly" && <FlyControls movementSpeed={15} rollSpeed={0.6} dragToLook />}

      <CameraReporter />
      <Stats />
    </>
  );
}
