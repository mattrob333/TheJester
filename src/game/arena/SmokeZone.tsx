import { useEffect, useRef } from "react";
import { RigidBody, BallCollider } from "@react-three/rapier";
import { setSmokeSourceActive, clearSmokeSource } from "../systems/coverState";
import type { SmokeZoneConfig } from "../types";

/**
 * Ticket 3.2 — smoke/fog cover zone. Parsed since Phase 0/2
 * (`config.smokeZones`, typed as `SmokeZoneConfig`) but never rendered until
 * now. Reuses the hazard sensor pattern (overlapCount via
 * onIntersectionEnter/Exit) — except instead of dealing damage, entering the
 * zone registers this zone as an active cover source in `coverState`.
 *
 * Visual is a simple translucent sphere (a volumetric fog shader is
 * nice-to-have per the ticket notes, not required for this pass).
 */
export function SmokeZone({ config }: { config: SmokeZoneConfig }) {
  const overlapCount = useRef(0);
  const sourceId = useRef(`smoke-${config.pos.join(",")}`).current;

  useEffect(() => {
    return () => clearSmokeSource(sourceId);
  }, [sourceId]);

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

      <mesh>
        <sphereGeometry args={[config.radius, 16, 16]} />
        <meshStandardMaterial
          color="#9ca3af"
          transparent
          opacity={0.22}
          depthWrite={false}
        />
      </mesh>
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
