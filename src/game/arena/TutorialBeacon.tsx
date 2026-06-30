import { useRef, useState } from "react";
import { RigidBody, BallCollider } from "@react-three/rapier";
import type { TutorialBeaconConfig } from "../types";
import { triggerBark } from "../announcer/Announcer";

const UNTRIGGERED_COLOR = "#facc15";
const TRIGGERED_COLOR = "#4b5563";

/**
 * Ticket 6.1 — tutorial beacon. A one-shot sensor zone: on first entry it
 * plays the configured announcer bark (`triggerBark`, story-tier-aware) and
 * then goes dormant (re-entry is a no-op), mirroring `CheckpointZone`'s
 * fire-once pattern. No pop-up text — the announcer line + this beacon's
 * placement along the level IS the teaching mechanism per the 6.1 spec.
 */
export function TutorialBeacon({ config }: { config: TutorialBeaconConfig }) {
  const [triggered, setTriggered] = useState(false);
  const triggeredRef = useRef(false);

  return (
    <group position={config.pos}>
      <RigidBody type="fixed" colliders={false}>
        <BallCollider
          args={[config.radius]}
          sensor
          onIntersectionEnter={() => {
            if (triggeredRef.current) return;
            triggeredRef.current = true;
            setTriggered(true);
            triggerBark(config.barkId);
          }}
        />
      </RigidBody>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[config.radius * 0.7, config.radius * 0.85, 24]} />
        <meshBasicMaterial
          color={triggered ? TRIGGERED_COLOR : UNTRIGGERED_COLOR}
          transparent
          opacity={triggered ? 0.15 : 0.45}
        />
      </mesh>
    </group>
  );
}

/** Renders one TutorialBeacon per config entry — mirrors SmokeZones'/HazardField's grouping role. */
export function TutorialBeacons({ beacons }: { beacons: TutorialBeaconConfig[] }) {
  return (
    <group>
      {beacons.map((beacon, i) => (
        <TutorialBeacon key={i} config={beacon} />
      ))}
    </group>
  );
}
