import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { lockOnState } from "./lockOn";
import { getTarget } from "./targets";

/**
 * Ticket 3.1b — visible feedback for the soft lock-on system. Renders a
 * small rotating reticle ring above whichever target is currently locked
 * (per `lockOnState`, written by `useWeapon`'s consumer each frame). Hidden
 * entirely when nothing is locked.
 */
export function LockOnIndicator() {
  const groupRef = useRef<Group>(null);

  useFrame((_, dt) => {
    const group = groupRef.current;
    if (!group) return;

    const target = lockOnState.targetId ? getTarget(lockOnState.targetId) : undefined;
    if (!target) {
      group.visible = false;
      return;
    }

    group.visible = true;
    group.position.copy(target.position);
    group.position.y += target.radius + 0.6;
    group.rotation.y += dt * 2;
  });

  return (
    <group ref={groupRef} visible={false}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.25, 0.32, 24]} />
        <meshBasicMaterial color="#22d3ee" transparent opacity={0.9} depthTest={false} />
      </mesh>
    </group>
  );
}
