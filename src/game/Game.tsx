import { useFrame, useThree } from "@react-three/fiber";
import { Grid, OrbitControls, FlyControls, Stats } from "@react-three/drei";
import { Physics, RigidBody, CuboidCollider } from "@react-three/rapier";
import { useControls, button } from "leva";
import { bus } from "./systems/events";
import { Player } from "./player/Player";
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
  // Dev controls: free-fly toggle + a bus smoke-test button.
  const { freeFly, showPhysicsDebug } = useControls("Dev", {
    freeFly: { value: false, label: "free-fly camera" },
    showPhysicsDebug: { value: false, label: "physics debug" },
    "Test: emit shotFired": button(() =>
      bus.emit("shotFired", { covered: false }),
    ),
  });

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
        <Player />
      </Physics>

      <ArenaLoader />

      {/* Dev camera: OrbitControls by default, FlyControls when freeFly is on. */}
      {freeFly ? (
        <FlyControls movementSpeed={15} rollSpeed={0.6} dragToLook />
      ) : (
        <OrbitControls
          makeDefault
          target={[0, 1, 0]}
          maxPolarAngle={Math.PI * 0.495}
        />
      )}

      <CameraReporter />
      <Stats />
    </>
  );
}
