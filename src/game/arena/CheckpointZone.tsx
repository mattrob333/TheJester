import { useRef, useState } from "react";
import { RigidBody, CylinderCollider } from "@react-three/rapier";
import { useGameState } from "../systems/gameState";
import { bus } from "../systems/events";
import type { Vec3 } from "../types";

const UNREACHED_COLOR = "#38bdf8";
const REACHED_COLOR = "#22c55e";

/**
 * Checkpoint trigger (Ticket 2.4). A sensor zone the player flies through;
 * on first entry it becomes the active respawn point and the beacon turns
 * green. Re-entering an already-reached checkpoint is a harmless no-op.
 */
export function CheckpointZone({ pos }: { pos: Vec3 }) {
  const [reached, setReached] = useState(false);
  const reachedRef = useRef(false);

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
          }}
        />
      </RigidBody>
      <mesh>
        <cylinderGeometry args={[0.3, 0.3, 3, 12]} />
        <meshStandardMaterial
          color={reached ? REACHED_COLOR : UNREACHED_COLOR}
          emissive={reached ? REACHED_COLOR : UNREACHED_COLOR}
          emissiveIntensity={reached ? 1.2 : 0.5}
          transparent
          opacity={0.5}
        />
      </mesh>
    </group>
  );
}
