import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { InstancedMesh, Object3D, Vector3 } from "three";
import { useWeapon } from "./useWeapon";
import { TARGETS } from "./targets";

const PROJECTILE_RADIUS = 0.12;
const MAX_INSTANCES = 64;

/**
 * Renders and updates all active projectiles.
 *
 * Projectiles are plain Three.js instanced meshes, not Rapier bodies — fast
 * moving spheres do tunnel-through with discrete physics, and we don't need
 * collision response, just hit detection. Hits are checked via radius against
 * the global TARGETS registry.
 */
export function Projectiles() {
  const meshRef = useRef<InstancedMesh>(null);
  const weapon = useWeapon();
  const scratch = useMemo(() => new Vector3(), []);
  const dummy = useMemo(() => new Object3D(), []);

  useFrame((_, dt) => {
    const list = weapon.projectiles;

    // Update simulation backwards so removals don't skip entries.
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      p.lifetime += dt;
      p.position.addScaledVector(p.direction, p.speed * dt);

      scratch.copy(p.position).sub(p.origin);
      const outOfRange = scratch.lengthSq() > p.maxRange * p.maxRange;
      const expired = p.lifetime >= p.maxLifetime;

      if (outOfRange || expired) {
        list.splice(i, 1);
        continue;
      }

      let hit = false;
      for (const target of TARGETS) {
        if (target.owner === p.owner) continue;
        scratch.copy(p.position).sub(target.position);
        const hitDist = PROJECTILE_RADIUS + target.radius;
        if (scratch.lengthSq() <= hitDist * hitDist) {
          target.onHit();
          hit = true;
          break;
        }
      }

      if (hit) {
        list.splice(i, 1);
      }
    }

    // Sync instances.
    const mesh = meshRef.current;
    if (!mesh) return;
    for (let i = 0; i < list.length; i++) {
      dummy.position.copy(list[i].position);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.count = list.length;
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, MAX_INSTANCES]}>
      <sphereGeometry args={[PROJECTILE_RADIUS, 8, 8]} />
      <meshStandardMaterial
        color="#facc15"
        emissive="#f59e0b"
        emissiveIntensity={2}
      />
    </instancedMesh>
  );
}
