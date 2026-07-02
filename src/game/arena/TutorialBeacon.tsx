import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { RigidBody, BallCollider } from "@react-three/rapier";
import type { Group } from "three";
import type { TutorialBeaconConfig } from "../types";
import { triggerBark } from "../announcer/Announcer";
import { telemetry } from "../../ui/telemetry";

const UNTRIGGERED_COLOR = "#facc15";
const TRIGGERED_COLOR = "#4b5563";

/**
 * Ticket 6.1 — tutorial beacon. A one-shot sensor zone: on first entry it
 * plays the configured announcer bark (`triggerBark`, story-tier-aware) and
 * then goes dormant (re-entry is a no-op), mirroring `CheckpointZone`'s
 * fire-once pattern. Visual: a floating, slowly spinning holographic
 * diamond inside a ring — bright gold while waiting, dimmed once consumed.
 */
export function TutorialBeacon({ config }: { config: TutorialBeaconConfig }) {
  const [triggered, setTriggered] = useState(false);
  const triggeredRef = useRef(false);
  const holoRef = useRef<Group>(null);
  const color = triggered ? TRIGGERED_COLOR : UNTRIGGERED_COLOR;

  useFrame(({ clock }, dt) => {
    if (!holoRef.current) return;
    holoRef.current.rotation.y += dt * (triggered ? 0.3 : 1.4);
    holoRef.current.position.y = Math.sin(clock.elapsedTime * 2 + config.pos[0]) * 0.15;
  });

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
            telemetry.lastBeaconId = config.barkId;
            triggerBark(config.barkId);
          }}
        />
      </RigidBody>

      <group ref={holoRef}>
        {/* floating diamond core */}
        <mesh>
          <octahedronGeometry args={[0.28, 0]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={triggered ? 0.3 : 1.8}
            transparent
            opacity={triggered ? 0.35 : 0.9}
            toneMapped={false}
          />
        </mesh>
        {/* orbit ring */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[config.radius * 0.55, 0.03, 6, 28]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={triggered ? 0.25 : 1.2}
            transparent
            opacity={triggered ? 0.25 : 0.7}
            toneMapped={false}
          />
        </mesh>
      </group>
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
