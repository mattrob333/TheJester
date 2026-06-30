import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Mesh, MeshStandardMaterial, Vector3 } from "three";
import type { TargetDummyConfig } from "../types";
import { registerTarget, unregisterTarget } from "./targets";

const FLASH_DURATION = 0.25;

/**
 * Static practice target for Ticket 3.1. Registers itself as a targetable
 * object and flashes red when hit by a projectile.
 */
export function TargetDummy({ config }: { config: TargetDummyConfig }) {
  const meshRef = useRef<Mesh>(null);
  const position = useRef(new Vector3(...config.pos)).current;
  const flashStart = useRef(-Infinity);

  const target = useRef({
    id: `dummy-${config.pos.join(",")}`,
    position,
    radius: config.radius,
    owner: "enemy" as const,
    onHit: () => {
      flashStart.current = performance.now() / 1000;
      // eslint-disable-next-line no-console
      console.info("[TargetDummy] hit at", config.pos);
    },
  }).current;

  useEffect(() => {
    registerTarget(target);
    return () => unregisterTarget(target);
  }, [target]);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const mat = mesh.material as MeshStandardMaterial;
    const elapsed = performance.now() / 1000 - flashStart.current;
    const flashing = elapsed < FLASH_DURATION;
    mat.emissive.setHex(flashing ? 0xff0000 : 0x000000);
    mat.emissiveIntensity = flashing ? 2 : 0;
  });

  return (
    <group position={position}>
      <mesh ref={meshRef} castShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#94a3b8" roughness={0.4} metalness={0.3} />
      </mesh>
      {/* Target ring to make it easier to see from a distance. */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -0.49, 0]}>
        <ringGeometry args={[config.radius * 0.5, config.radius, 32]} />
        <meshBasicMaterial color="#ef4444" transparent opacity={0.5} />
      </mesh>
    </group>
  );
}
