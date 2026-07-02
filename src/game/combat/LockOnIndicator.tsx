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
    // Lock-pulse: the reticle breathes so it reads as "tracking", not static.
    const pulse = 1 + Math.sin(performance.now() / 1000 * 6) * 0.12;
    group.scale.setScalar(pulse);
  });

  return (
    <group ref={groupRef} visible={false}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.25, 0.32, 24]} />
        <meshBasicMaterial color="#22d3ee" transparent opacity={0.9} depthTest={false} toneMapped={false} />
      </mesh>
      {/* four tick marks — classic target-acquired brackets */}
      {[0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].map((a) => (
        <mesh key={a} position={[Math.cos(a) * 0.45, 0, Math.sin(a) * 0.45]} rotation={[Math.PI / 2, 0, -a]}>
          <planeGeometry args={[0.12, 0.05]} />
          <meshBasicMaterial color="#22d3ee" transparent opacity={0.9} depthTest={false} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}
