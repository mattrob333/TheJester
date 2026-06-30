import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RigidBody, CuboidCollider } from "@react-three/rapier";
import type { Mesh, MeshStandardMaterial } from "three";
import { useGameState } from "../../systems/gameState";
import { bus } from "../../systems/events";
import { cyclePhase, HIT_COOLDOWN } from "./hazardTiming";
import type { LaserHazardConfig } from "../../types";

const DAMAGE = 15;
const ACTIVE_DURATION = 1.0;
const BEAM_THICKNESS = 0.15;

const IDLE_COLOR = "#1f2937";
const WARNING_COLOR = "#facc15";
const ACTIVE_COLOR = "#f43f5e";

/**
 * Laser gate — charges (a thin glowing warning line) then fires a solid beam
 * along `axis` for `ACTIVE_DURATION`, on a config-driven cycle. The danger
 * sensor spans the full beam volume and is only lethal while phase==="active".
 */
export function LaserHazard({ config }: { config: LaserHazardConfig }) {
  const beamRef = useRef<Mesh>(null);
  const overlapCount = useRef(0);
  const lastHit = useRef(-Infinity);

  const along: [number, number, number] =
    config.axis === "x" ? [config.length, BEAM_THICKNESS, BEAM_THICKNESS] : [BEAM_THICKNESS, BEAM_THICKNESS, config.length];
  const halfExtents: [number, number, number] = [along[0] / 2, along[1] / 2, along[2] / 2];

  useFrame((state) => {
    const now = state.clock.elapsedTime;
    const phase = cyclePhase(now, config.interval, ACTIVE_DURATION);

    if (beamRef.current) {
      const mat = beamRef.current.material as MeshStandardMaterial;
      if (phase === "active") {
        mat.color.set(ACTIVE_COLOR);
        mat.emissive.set(ACTIVE_COLOR);
        mat.emissiveIntensity = 2.2;
        beamRef.current.scale.set(1, 3, 3);
      } else if (phase === "warning") {
        mat.color.set(WARNING_COLOR);
        mat.emissive.set(WARNING_COLOR);
        mat.emissiveIntensity = 1.2;
        beamRef.current.scale.set(1, 1, 1);
      } else {
        mat.color.set(IDLE_COLOR);
        mat.emissive.set(IDLE_COLOR);
        mat.emissiveIntensity = 0.2;
        beamRef.current.scale.set(1, 1, 1);
      }
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
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider
          args={halfExtents}
          sensor
          onIntersectionEnter={() => {
            overlapCount.current += 1;
          }}
          onIntersectionExit={() => {
            overlapCount.current = Math.max(0, overlapCount.current - 1);
          }}
        />
      </RigidBody>

      <mesh ref={beamRef}>
        <boxGeometry args={along} />
        <meshStandardMaterial color={IDLE_COLOR} emissive={IDLE_COLOR} emissiveIntensity={0.2} />
      </mesh>
    </group>
  );
}
