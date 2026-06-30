import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RigidBody, CuboidCollider } from "@react-three/rapier";
import type { Mesh, MeshStandardMaterial } from "three";
import { useGameState } from "../../systems/gameState";
import { bus } from "../../systems/events";
import { cyclePhase, HAZARD_COLOR, HIT_COOLDOWN } from "./hazardTiming";
import type { CrusherHazardConfig } from "../../types";

const DAMAGE = 40;
const ACTIVE_DURATION = 0.4;
const RAISED_Y = 2.4;
const LOWERED_Y = 0.4;

/**
 * Crusher — slams down on a config-driven cycle, telegraphed by a blinking
 * warning beacon before it drops. The danger sensor is a static box at the
 * lowered position; only the visual head animates — damage is gated purely
 * by the timing phase, not the head's exact rendered position.
 */
export function CrusherHazard({ config }: { config: CrusherHazardConfig }) {
  const headRef = useRef<Mesh>(null);
  const beaconRef = useRef<Mesh>(null);
  const overlapCount = useRef(0);
  const lastHit = useRef(-Infinity);

  useFrame((state) => {
    const now = state.clock.elapsedTime;
    const phase = cyclePhase(now, config.interval, ACTIVE_DURATION);

    if (headRef.current) {
      headRef.current.position.y = phase === "active" ? LOWERED_Y : RAISED_Y;
    }
    if (beaconRef.current) {
      const mat = beaconRef.current.material as MeshStandardMaterial;
      mat.color.set(HAZARD_COLOR[phase]);
      mat.emissive.set(HAZARD_COLOR[phase]);
      mat.emissiveIntensity = phase === "idle" ? 0.3 : 1.4;
    }

    if (phase === "active" && overlapCount.current > 0) {
      if (now - lastHit.current >= HIT_COOLDOWN) {
        lastHit.current = now;
        useGameState.getState().damage(DAMAGE);
        bus.emit("playerDamaged", { amount: DAMAGE });
      }
    }
  });

  return (
    <group position={config.pos}>
      <RigidBody type="fixed" colliders={false} position={[0, LOWERED_Y, 0]}>
        <CuboidCollider args={[0.6, 0.4, 0.6]} sensor
          onIntersectionEnter={() => {
            overlapCount.current += 1;
          }}
          onIntersectionExit={() => {
            overlapCount.current = Math.max(0, overlapCount.current - 1);
          }}
        />
      </RigidBody>

      <mesh ref={headRef} castShadow position={[0, RAISED_Y, 0]}>
        <boxGeometry args={[1.2, 0.8, 1.2]} />
        <meshStandardMaterial color="#475569" metalness={0.6} roughness={0.4} />
      </mesh>

      <mesh ref={beaconRef} position={[0, RAISED_Y + 0.6, 0]}>
        <sphereGeometry args={[0.15, 12, 12]} />
        <meshStandardMaterial color="#1f2937" emissive="#1f2937" emissiveIntensity={0.3} />
      </mesh>
    </group>
  );
}
