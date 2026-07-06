import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RigidBody, CylinderCollider } from "@react-three/rapier";
import { Vector3, type Group, type MeshStandardMaterial } from "three";
import { applyPlayerDamage } from "../../systems/playerDamage";
import { telemetry } from "../../../ui/telemetry";
import { HIT_COOLDOWN } from "./hazardTiming";
import { setSirenSourceActive, clearSirenSource } from "../../systems/coverState";
import { spawnSparks } from "../../effects/effects";
import type { RazorHazardConfig } from "../../types";

const DAMAGE = 18;

/**
 * Razor — continuously spinning blade trap. Unlike the crusher/laser it has
 * no idle/warning cycle: it's always armed, so the beacon pulses steady-red.
 *
 * The danger sensor is a static cylinder; the blade assembly (four edged
 * blades on a hub, over a machined pedestal) spins for visual telegraphing
 * only — collision detection doesn't depend on blade rotation. Contact
 * throws sparks at the player's position for a physical "you got clipped"
 * read.
 *
 * Ticket 3.2 — when `config.siren` is set, this hazard registers as a
 * permanently-active siren source for the lifetime of the component.
 */
export function RazorHazard({ config }: { config: RazorHazardConfig }) {
  const bladeRef = useRef<Group>(null);
  const beaconMat = useRef<MeshStandardMaterial>(null);
  const overlapCount = useRef(0);
  const lastHit = useRef(-Infinity);
  const sourceId = useRef(`razor-${config.pos.join(",")}`).current;
  const worldPos = useRef(new Vector3(...config.pos)).current;

  useEffect(() => {
    if (!config.siren) return;
    setSirenSourceActive(sourceId, true);
    return () => clearSirenSource(sourceId);
  }, [config.siren, sourceId]);

  useFrame((state, dt) => {
    const now = state.clock.elapsedTime;
    if (bladeRef.current) {
      bladeRef.current.rotation.y += (config.rpm / 60) * Math.PI * 2 * dt;
    }
    if (beaconMat.current) {
      beaconMat.current.emissiveIntensity = 1.8 + Math.sin(now * 8) * 0.8;
    }
    if (overlapCount.current > 0) {
      telemetry.hazardPhase = "razor:active";
      if (now - lastHit.current >= HIT_COOLDOWN && applyPlayerDamage(DAMAGE, "razor")) {
        lastHit.current = now;
        spawnSparks(worldPos, null, 0xff6644, 14, 9);
      }
    } else if (telemetry.hazardPhase?.startsWith("razor:")) {
      telemetry.hazardPhase = null;
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

      {/* pedestal down to the floor */}
      <mesh castShadow position={[0, -config.pos[1] / 2 - 0.3, 0]}>
        <cylinderGeometry args={[0.28, 0.45, Math.max(0.2, config.pos[1] - 0.6), 12]} />
        <meshStandardMaterial color="#1e293b" roughness={0.35} metalness={0.8} />
      </mesh>
      {/* motor housing */}
      <mesh castShadow position={[0, -0.35, 0]}>
        <cylinderGeometry args={[0.32, 0.38, 0.5, 12]} />
        <meshStandardMaterial color="#334155" roughness={0.3} metalness={0.85} />
      </mesh>
      {/* hazard stripe band */}
      <mesh position={[0, -0.35, 0]}>
        <cylinderGeometry args={[0.385, 0.385, 0.12, 12]} />
        <meshStandardMaterial color="#f59e0b" emissive="#f59e0b" emissiveIntensity={0.5} roughness={0.5} />
      </mesh>

      <group ref={bladeRef}>
        {/* hub */}
        <mesh castShadow>
          <cylinderGeometry args={[0.18, 0.18, 0.16, 10]} />
          <meshStandardMaterial color="#475569" roughness={0.25} metalness={0.9} />
        </mesh>
        {/* four blades with glowing leading edges */}
        {[0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].map((angle) => (
          <group key={angle} rotation={[0, angle, 0]}>
            <mesh castShadow position={[0.65, 0, 0]}>
              <boxGeometry args={[1.1, 0.06, 0.26]} />
              <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.15} />
            </mesh>
            <mesh position={[1.16, 0, 0]}>
              <boxGeometry args={[0.06, 0.062, 0.26]} />
              <meshStandardMaterial
                color="#ff4444"
                emissive="#ff2222"
                emissiveIntensity={2}
                toneMapped={false}
              />
            </mesh>
          </group>
        ))}
        {/* motion-blur disc */}
        <mesh>
          <cylinderGeometry args={[1.2, 1.2, 0.04, 24]} />
          <meshStandardMaterial
            color="#ef4444"
            emissive="#ef4444"
            emissiveIntensity={0.4}
            transparent
            opacity={0.1}
            depthWrite={false}
          />
        </mesh>
      </group>

      {/* Steady warning beacon — always-armed hazard, pulses but never sleeps. */}
      <mesh position={[0, 1.4, 0]}>
        <sphereGeometry args={[0.15, 12, 12]} />
        <meshStandardMaterial
          ref={beaconMat}
          color="#ef4444"
          emissive="#ef4444"
          emissiveIntensity={1.8}
          toneMapped={false}
        />
      </mesh>
      <pointLight position={[0, 1.4, 0]} color="#ff3333" intensity={4} distance={9} decay={2} />
    </group>
  );
}
