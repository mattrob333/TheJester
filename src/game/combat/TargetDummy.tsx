import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Group, Vector3, type MeshStandardMaterial } from "three";
import type { TargetDummyConfig } from "../types";
import { registerTarget, unregisterTarget } from "./targets";

const FLASH_DURATION = 0.25;
const WOBBLE_DURATION = 0.6;

/**
 * Practice target for Ticket 3.1 — now a proper shooting-range bullseye on a
 * post: concentric emissive rings, a hit flash, and a springy wobble when a
 * projectile connects (impact sparks come from the projectile system).
 */
export function TargetDummy({ config }: { config: TargetDummyConfig }) {
  const boardRef = useRef<Group>(null);
  const bullseyeMat = useRef<MeshStandardMaterial>(null);
  const position = useRef(new Vector3(...config.pos)).current;
  const flashStart = useRef(-Infinity);

  const target = useRef({
    id: `dummy-${config.pos.join(",")}`,
    position,
    radius: config.radius,
    owner: "enemy" as const,
    onHit: (_damage: number) => {
      flashStart.current = performance.now() / 1000;
    },
  }).current;

  useEffect(() => {
    registerTarget(target);
    return () => unregisterTarget(target);
  }, [target]);

  useFrame((state) => {
    const now = state.clock.elapsedTime;
    const elapsed = performance.now() / 1000 - flashStart.current;

    if (boardRef.current) {
      // Springy knock-back wobble after a hit, plus a lazy idle spin.
      const wobble =
        elapsed < WOBBLE_DURATION
          ? Math.sin(elapsed * 24) * 0.3 * (1 - elapsed / WOBBLE_DURATION)
          : 0;
      boardRef.current.rotation.x = wobble;
      boardRef.current.rotation.y = Math.sin(now * 0.4) * 0.25;
    }
    if (bullseyeMat.current) {
      const flashing = elapsed < FLASH_DURATION;
      bullseyeMat.current.emissiveIntensity = flashing ? 5 : 1.6;
    }
  });

  return (
    <group position={position}>
      {/* support post down to the floor */}
      <mesh castShadow position={[0, -position.y / 2, 0]}>
        <cylinderGeometry args={[0.06, 0.09, position.y, 8]} />
        <meshStandardMaterial color="#334155" roughness={0.4} metalness={0.7} />
      </mesh>

      {/* Disc axis rotated onto world X so the board face greets the player
          approaching down the corridor. Wobble animates x/y only; z holds
          this base orientation. */}
      <group ref={boardRef} rotation={[0, 0, Math.PI / 2]}>
        {/* backing board */}
        <mesh castShadow>
          <cylinderGeometry args={[config.radius, config.radius, 0.08, 24]} />
          <meshStandardMaterial color="#1e293b" roughness={0.5} metalness={0.4} />
        </mesh>
        <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[config.radius * 0.7, config.radius * 0.9, 32]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[config.radius * 0.4, config.radius * 0.6, 32]} />
          <meshStandardMaterial color="#ef4444" roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[config.radius * 0.15, config.radius * 0.3, 32]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.6} />
        </mesh>
        {/* glowing bullseye */}
        <mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[config.radius * 0.12, 20]} />
          <meshStandardMaterial
            ref={bullseyeMat}
            color="#fbbf24"
            emissive="#fbbf24"
            emissiveIntensity={1.6}
            toneMapped={false}
          />
        </mesh>
      </group>
    </group>
  );
}
