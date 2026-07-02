import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, Color, InstancedMesh, Object3D, Vector3 } from "three";
import { useWeapon } from "./useWeapon";
import { TARGETS, getTarget } from "./targets";
import { spawnSparks } from "../effects/effects";
import { activeArena } from "../config/activeArena";

const PROJECTILE_RADIUS = 0.12;
const MAX_INSTANCES = 64;
/** Ticket 3.1b — homing turn rate, radians/sec. Finite (not instant) so homing reads as assisted aim, not a hitscan. */
const HOMING_TURN_RATE = Math.PI * 3; // ~540°/s

const PLAYER_TRACER = new Color("#ffd24a");
const ENEMY_TRACER = new Color("#ff4a4a");
const PLAYER_SPARK = 0xffc93d;
const ENEMY_SPARK = 0xff5544;

/**
 * Renders and updates all active projectiles as glowing tracer bolts —
 * capsule instances stretched and oriented along their flight direction,
 * additive-blended so they bloom, color-coded per owner (gold = player,
 * red = enemy).
 *
 * Projectiles are plain Three.js instanced meshes, not Rapier bodies — fast
 * moving spheres do tunnel-through with discrete physics, and we don't need
 * collision response, just hit detection. Hits are checked via radius against
 * the global TARGETS registry, plus a cheap AABB test against the arena
 * bounds/floor so shots visibly spark and die on world geometry instead of
 * sailing through it.
 */
export function Projectiles() {
  const meshRef = useRef<InstancedMesh>(null);
  const weapon = useWeapon();
  const scratch = useMemo(() => new Vector3(), []);
  const dummy = useMemo(() => new Object3D(), []);
  const toTarget = useMemo(() => new Vector3(), []);
  const up = useMemo(() => new Vector3(0, 1, 0), []);

  const halfW = activeArena.bounds.width / 2;
  const halfD = activeArena.bounds.depth / 2;
  const ceilingY = activeArena.bounds.height;

  useFrame((_, dt) => {
    const list = weapon.projectiles;

    // Update simulation backwards so removals don't skip entries.
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      p.lifetime += dt;

      // Ticket 3.1b — homing: steer direction toward the locked target at a
      // finite turn rate, then advance along the (possibly re-aimed)
      // direction. Falls back to straight flight if the target despawned.
      if (p.targetId) {
        const target = getTarget(p.targetId);
        if (target) {
          toTarget.copy(target.position).sub(p.position).normalize();
          const maxTurn = HOMING_TURN_RATE * dt;
          const angle = p.direction.angleTo(toTarget);
          if (angle > 1e-4) {
            const t = Math.min(1, maxTurn / angle);
            p.direction.lerp(toTarget, t).normalize();
          }
        }
      }

      p.position.addScaledVector(p.direction, p.speed * dt);

      scratch.copy(p.position).sub(p.origin);
      const outOfRange = scratch.lengthSq() > p.maxRange * p.maxRange;
      const expired = p.lifetime >= p.maxLifetime;

      if (outOfRange || expired) {
        list.splice(i, 1);
        continue;
      }

      // World geometry: floor, ceiling, and the four arena walls.
      const hitWorld =
        p.position.y <= PROJECTILE_RADIUS ||
        p.position.y >= ceilingY ||
        Math.abs(p.position.x) >= halfW ||
        Math.abs(p.position.z) >= halfD;
      if (hitWorld) {
        scratch.copy(p.direction).negate();
        spawnSparks(p.position, scratch, p.owner === "player" ? PLAYER_SPARK : ENEMY_SPARK, 8, 5);
        list.splice(i, 1);
        continue;
      }

      let hit = false;
      for (const target of TARGETS) {
        if (target.owner === p.owner) continue;
        scratch.copy(p.position).sub(target.position);
        const hitDist = PROJECTILE_RADIUS + target.radius;
        if (scratch.lengthSq() <= hitDist * hitDist) {
          target.onHit(p.damage);
          scratch.copy(p.direction).negate();
          spawnSparks(
            p.position,
            scratch,
            p.owner === "player" ? PLAYER_SPARK : ENEMY_SPARK,
            12,
            8,
          );
          hit = true;
          break;
        }
      }

      if (hit) {
        list.splice(i, 1);
      }
    }

    // Sync tracer instances — each stretched along its flight direction.
    const mesh = meshRef.current;
    if (!mesh) return;
    const count = Math.min(list.length, MAX_INSTANCES);
    for (let i = 0; i < count; i++) {
      const p = list[i];
      dummy.position.copy(p.position);
      dummy.quaternion.setFromUnitVectors(up, p.direction);
      // Stretch with speed for a motion-streak read; brand-new shots start shorter.
      const stretch = Math.min(1, p.lifetime * 12);
      dummy.scale.set(1, 1 + stretch * 6, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, p.owner === "player" ? PLAYER_TRACER : ENEMY_TRACER);
    }
    mesh.count = count;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, MAX_INSTANCES]} frustumCulled={false}>
      <capsuleGeometry args={[PROJECTILE_RADIUS * 0.6, PROJECTILE_RADIUS * 1.6, 3, 8]} />
      <meshBasicMaterial
        color="#ffffff"
        blending={AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </instancedMesh>
  );
}
