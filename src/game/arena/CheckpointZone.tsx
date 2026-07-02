import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { RigidBody, CylinderCollider } from "@react-three/rapier";
import type { Group, Mesh } from "three";
import { useGameState } from "../systems/gameState";
import { bus } from "../systems/events";
import { spawnSparks } from "../effects/effects";
import { Vector3 } from "three";
import type { Vec3 } from "../types";

const UNREACHED_COLOR = "#38bdf8";
const REACHED_COLOR = "#22c55e";

/**
 * Checkpoint trigger (Ticket 2.4). A sensor zone the player flies through;
 * on first entry it becomes the active respawn point and the beacon turns
 * green (with a confirmation spark burst). Visual: a holographic light
 * pillar with two slow counter-rotating rings.
 */
export function CheckpointZone({ pos }: { pos: Vec3 }) {
  const [reached, setReached] = useState(false);
  const reachedRef = useRef(false);
  const ringsRef = useRef<Group>(null);
  const pillarRef = useRef<Mesh>(null);
  const color = reached ? REACHED_COLOR : UNREACHED_COLOR;

  useFrame(({ clock }, dt) => {
    if (ringsRef.current) {
      ringsRef.current.children[0].rotation.y += dt * 0.8;
      ringsRef.current.children[1].rotation.y -= dt * 0.5;
      ringsRef.current.position.y = Math.sin(clock.elapsedTime * 1.5) * 0.2;
    }
    if (pillarRef.current) {
      pillarRef.current.rotation.y += dt * 0.3;
    }
  });

  return (
    <group position={pos}>
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider
          args={[1.5, 1.5]}
          sensor
          onIntersectionEnter={() => {
            if (reachedRef.current) return;
            reachedRef.current = true;
            setReached(true);
            useGameState.getState().setCheckpoint(pos);
            bus.emit("checkpointReached", { pos });
            spawnSparks(new Vector3(pos[0], pos[1], pos[2]), null, 0x22c55e, 20, 6);
          }}
        />
      </RigidBody>

      {/* holographic pillar — subtle enough that the player isn't swallowed
          while standing inside it at spawn */}
      <mesh ref={pillarRef}>
        <cylinderGeometry args={[0.3, 0.3, 3.2, 12, 1, true]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={reached ? 0.9 : 0.6}
          transparent
          opacity={0.18}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      {/* counter-rotating halo rings — tilted so the precession reads */}
      <group ref={ringsRef}>
        <mesh rotation={[Math.PI / 2 + 0.18, 0, 0]}>
          <torusGeometry args={[1.1, 0.03, 8, 32]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={reached ? 1.2 : 0.8}
            toneMapped={false}
          />
        </mesh>
        <mesh rotation={[Math.PI / 2 - 0.22, 0, 0.12]}>
          <torusGeometry args={[0.8, 0.025, 8, 28]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={reached ? 1.2 : 0.8}
            toneMapped={false}
          />
        </mesh>
      </group>

      {/* floor glow disc */}
      <mesh position={[0, -pos[1] + 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.9, 1.4, 32]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.8}
          transparent
          opacity={0.6}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
