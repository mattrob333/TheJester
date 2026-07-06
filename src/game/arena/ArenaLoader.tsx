import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RigidBody, BallCollider } from "@react-three/rapier";
import type { Group, Mesh } from "three";
import type { ArenaConfig, Vec3 } from "../types";
import { useAppState } from "../systems/appState";
import { bus } from "../systems/events";
import { finishRunStats } from "../systems/runStats";
import { triggerBark } from "../announcer/Announcer";
import { activeArena } from "../config/activeArena";
import { Floor } from "./Floor";
import { Bounds } from "./Bounds";
import { HazardField } from "./hazards/HazardField";
import { CheckpointZone } from "./CheckpointZone";
import { TargetDummy } from "../combat/TargetDummy";
import { SmokeZones } from "./SmokeZone";
import { EnemyField } from "../enemies/EnemyField";
import { TutorialBeacons } from "./TutorialBeacon";

/**
 * Arena loader (Ticket 2.1) — builds the level from a JSON config: floor,
 * walls, hazards, checkpoints, and spawn/exit markers. Editing the config
 * moves all of it. Must be rendered inside <Physics> — floor/walls/hazards
 * are all Rapier bodies.
 */

/** Spawn pad — a glowing landing ring set into the floor. */
function SpawnPad({ pos }: { pos: Vec3 }) {
  const ringRef = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    if (ringRef.current) ringRef.current.rotation.z = clock.elapsedTime * 0.4;
  });
  return (
    <group position={[pos[0], 0, pos[2]]}>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.6, 32]} />
        <meshStandardMaterial color="#052e16" roughness={0.5} metalness={0.4} />
      </mesh>
      <mesh ref={ringRef} position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.2, 1.5, 32, 1, 0, Math.PI * 1.7]} />
        <meshStandardMaterial
          color="#22c55e"
          emissive="#22c55e"
          emissiveIntensity={1.4}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.45, 24]} />
        <meshStandardMaterial
          color="#22c55e"
          emissive="#22c55e"
          emissiveIntensity={0.9}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

/**
 * Exit portal — a tall spinning double-ring gate with a light column. No
 * longer decorative: flying through it WINS THE RUN (review §4 "there is no
 * win condition") — stats freeze and the victory screen takes over.
 */
function ExitPortal({ pos }: { pos: Vec3 }) {
  const outerRef = useRef<Mesh>(null);
  const innerRef = useRef<Mesh>(null);
  const coreRef = useRef<Group>(null);
  const wonRef = useRef(false);

  const handleEnter = () => {
    if (wonRef.current) return;
    if (useAppState.getState().phase !== "playing") return;
    wonRef.current = true;
    finishRunStats();
    triggerBark("victory");
    bus.emit("runWon", {});
    useAppState.getState().winRun();
  };

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    if (outerRef.current) outerRef.current.rotation.z += dt * 0.6;
    if (innerRef.current) innerRef.current.rotation.z -= dt * 1.1;
    if (coreRef.current) coreRef.current.scale.setScalar(1 + Math.sin(t * 3) * 0.08);
  });
  return (
    <group position={pos}>
      {/* win trigger — covers the whole ring so any pass through counts */}
      <RigidBody type="fixed" colliders={false}>
        <BallCollider args={[2.2]} sensor onIntersectionEnter={handleEnter} />
      </RigidBody>
      {/* rings face the corridor (normal along X) */}
      <group rotation={[0, Math.PI / 2, 0]}>
        <mesh ref={outerRef}>
          <torusGeometry args={[2, 0.12, 10, 40]} />
          <meshStandardMaterial
            color="#ef4444"
            emissive="#ef4444"
            emissiveIntensity={1.8}
            metalness={0.6}
            roughness={0.3}
            toneMapped={false}
          />
        </mesh>
        <mesh ref={innerRef}>
          <torusGeometry args={[1.4, 0.08, 10, 36]} />
          <meshStandardMaterial
            color="#fb923c"
            emissive="#fb923c"
            emissiveIntensity={1.6}
            metalness={0.6}
            roughness={0.3}
            toneMapped={false}
          />
        </mesh>
        {/* shimmering portal membrane */}
        <group ref={coreRef}>
          <mesh>
            <circleGeometry args={[1.3, 32]} />
            <meshStandardMaterial
              color="#f87171"
              emissive="#ef4444"
              emissiveIntensity={0.7}
              transparent
              opacity={0.25}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
        </group>
      </group>
      {/* light column to the floor */}
      <mesh position={[0, -pos[1] / 2, 0]}>
        <cylinderGeometry args={[0.15, 0.4, pos[1], 12, 1, true]} />
        <meshStandardMaterial
          color="#ef4444"
          emissive="#ef4444"
          emissiveIntensity={0.6}
          transparent
          opacity={0.18}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <pointLight color="#ff4444" intensity={8} distance={16} decay={2} />
    </group>
  );
}

export function ArenaLoader({ config = activeArena }: { config?: ArenaConfig }) {
  return (
    <group>
      <Floor width={config.bounds.width} depth={config.bounds.depth} />
      <Bounds {...config.bounds} />

      <HazardField hazards={config.hazards} />
      <SmokeZones zones={config.smokeZones} />
      <EnemyField enemies={config.enemies} />
      <TutorialBeacons beacons={config.tutorialBeacons} />

      {config.dummies.map((dummy, i) => (
        <TargetDummy key={i} config={dummy} />
      ))}

      {config.checkpoints.map((pos, i) => (
        <CheckpointZone key={i} pos={pos} />
      ))}

      <SpawnPad pos={config.spawn} />
      <ExitPortal pos={config.exit} />
    </group>
  );
}
