import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RigidBody, BallCollider } from "@react-three/rapier";
import type { Group } from "three";
import { setSmokeSourceActive, clearSmokeSource } from "../systems/coverState";
import type { SmokeZoneConfig } from "../types";

/**
 * Ticket 3.2 — smoke/fog cover zone. Reuses the hazard sensor pattern
 * (overlapCount via onIntersectionEnter/Exit) — except instead of dealing
 * damage, entering the zone registers this zone as an active cover source
 * in `coverState`.
 *
 * Visual: a cluster of drifting, slowly churning translucent billows at
 * different sizes/offsets instead of one static sphere, so it reads as a
 * smoke bank you can hide inside rather than a bubble.
 */
export function SmokeZone({ config }: { config: SmokeZoneConfig }) {
  const overlapCount = useRef(0);
  const sourceId = useRef(`smoke-${config.pos.join(",")}`).current;
  const cloudRef = useRef<Group>(null);

  // Deterministic per-zone pseudo-random billow layout (seeded by position
  // via sin hashing) so re-renders don't reshuffle the cloud.
  const billows = useMemo(() => {
    const seed = config.pos[0] * 13.37 + config.pos[2] * 7.77;
    const rand = (i: number) => {
      const v = Math.sin(seed + i * 127.1) * 43758.5453;
      return v - Math.floor(v);
    };
    return Array.from({ length: 7 }, (_, i) => ({
      offset: [
        (rand(i) - 0.5) * config.radius * 1.1,
        (rand(i + 10) - 0.5) * config.radius * 0.8,
        (rand(i + 20) - 0.5) * config.radius * 1.1,
      ] as [number, number, number],
      scale: config.radius * (0.35 + rand(i + 30) * 0.4),
      phase: rand(i + 40) * Math.PI * 2,
      speed: 0.2 + rand(i + 50) * 0.3,
    }));
  }, [config.pos, config.radius]);

  useEffect(() => {
    return () => clearSmokeSource(sourceId);
  }, [sourceId]);

  useFrame(({ clock }) => {
    const cloud = cloudRef.current;
    if (!cloud) return;
    const t = clock.elapsedTime;
    // Only the first `billows.length` children drift — the last child is the static core.
    for (let i = 0; i < billows.length && i < cloud.children.length; i++) {
      const b = billows[i];
      const mesh = cloud.children[i];
      mesh.position.set(
        b.offset[0] + Math.sin(t * b.speed + b.phase) * 0.5,
        b.offset[1] + Math.sin(t * b.speed * 0.7 + b.phase * 2) * 0.3,
        b.offset[2] + Math.cos(t * b.speed + b.phase) * 0.5,
      );
      const breathe = 1 + Math.sin(t * b.speed * 1.3 + b.phase) * 0.08;
      mesh.scale.setScalar(b.scale * breathe);
    }
  });

  return (
    <group position={config.pos}>
      <RigidBody type="fixed" colliders={false}>
        <BallCollider
          args={[config.radius]}
          sensor
          onIntersectionEnter={() => {
            overlapCount.current += 1;
            setSmokeSourceActive(sourceId, overlapCount.current > 0);
          }}
          onIntersectionExit={() => {
            overlapCount.current = Math.max(0, overlapCount.current - 1);
            setSmokeSourceActive(sourceId, overlapCount.current > 0);
          }}
        />
      </RigidBody>

      <group ref={cloudRef}>
        {billows.map((b, i) => (
          <mesh key={i} position={b.offset} scale={b.scale}>
            <sphereGeometry args={[1, 14, 12]} />
            <meshStandardMaterial
              color="#8b93a3"
              emissive="#7b8494"
              emissiveIntensity={0.22}
              transparent
              opacity={0.14}
              depthWrite={false}
              roughness={1}
            />
          </mesh>
        ))}
        {/* faint core so the middle of the bank stays visually dense */}
        <mesh scale={config.radius * 0.9}>
          <sphereGeometry args={[1, 16, 14]} />
          <meshStandardMaterial
            color="#9ca3af"
            emissive="#7b8494"
            emissiveIntensity={0.22}
            transparent
            opacity={0.1}
            depthWrite={false}
            roughness={1}
          />
        </mesh>
      </group>
    </group>
  );
}

/** Renders one SmokeZone per config entry — mirrors HazardField's grouping role. */
export function SmokeZones({ zones }: { zones: SmokeZoneConfig[] }) {
  return (
    <group>
      {zones.map((zone, i) => (
        <SmokeZone key={i} config={zone} />
      ))}
    </group>
  );
}
