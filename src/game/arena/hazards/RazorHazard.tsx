import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RigidBody, CylinderCollider } from "@react-three/rapier";
import type { Group } from "three";
import { useGameState } from "../../systems/gameState";
import { bus } from "../../systems/events";
import { HIT_COOLDOWN } from "./hazardTiming";
import type { RazorHazardConfig } from "../../types";

const DAMAGE = 18;

/**
 * Razor — continuously spinning blade. Unlike the crusher/laser it has no
 * idle/warning cycle: it's always armed, so the warning beacon stays lit
 * steady-red rather than blinking (the danger is the blade, not a timer).
 *
 * The danger sensor is a static cylinder; the blade mesh spins for visual
 * telegraphing only — collision detection doesn't depend on blade rotation.
 */
export function RazorHazard({ config }: { config: RazorHazardConfig }) {
  const bladeRef = useRef<Group>(null);
  const overlapCount = useRef(0);
  const lastHit = useRef(-Infinity);

  useFrame((state, dt) => {
    if (bladeRef.current) {
      bladeRef.current.rotation.y += (config.rpm / 60) * Math.PI * 2 * dt;
    }
    if (overlapCount.current > 0) {
      const now = state.clock.elapsedTime;
      if (now - lastHit.current >= HIT_COOLDOWN) {
        lastHit.current = now;
        useGameState.getState().damage(DAMAGE);
        bus.emit("playerDamaged", { amount: DAMAGE });
      }
    }
  });

  return (
    <group position={config.pos}>
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider
          args={[0.25, 1.2]}
          sensor
          onIntersectionEnter={() => {
            overlapCount.current += 1;
          }}
          onIntersectionExit={() => {
            overlapCount.current = Math.max(0, overlapCount.current - 1);
          }}
        />
      </RigidBody>

      <group ref={bladeRef}>
        <mesh castShadow>
          <boxGeometry args={[2.4, 0.08, 0.3]} />
          <meshStandardMaterial
            color="#94a3b8"
            metalness={0.8}
            roughness={0.2}
            emissive="#ef4444"
            emissiveIntensity={0.3}
          />
        </mesh>
        <mesh castShadow rotation={[0, Math.PI / 2, 0]}>
          <boxGeometry args={[2.4, 0.08, 0.3]} />
          <meshStandardMaterial
            color="#94a3b8"
            metalness={0.8}
            roughness={0.2}
            emissive="#ef4444"
            emissiveIntensity={0.3}
          />
        </mesh>
      </group>

      {/* Steady warning beacon — always-armed hazard, no telegraph cycle. */}
      <mesh position={[0, 1.4, 0]}>
        <sphereGeometry args={[0.15, 12, 12]} />
        <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={1.4} />
      </mesh>
    </group>
  );
}
