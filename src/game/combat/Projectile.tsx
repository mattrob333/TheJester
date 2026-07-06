import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { useRapier } from "@react-three/rapier";
import { AdditiveBlending, Color, InstancedMesh, Object3D, Vector3 } from "three";
import { useWeapon } from "./useWeapon";
import { TARGETS, getTarget } from "./targets";
import { spawnSparks } from "../effects/effects";

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
 * Hit detection is SWEPT, not point-in-time (code-review §2.2):
 *  - World geometry: a Rapier raycast covers the full distance moved this
 *    frame, restricted to FIXED colliders (walls/floor) — sensors, enemies,
 *    and the player's own body are handled separately. Shots can no longer
 *    pass through walls, so smoke/wall cover actually blocks fire.
 *  - Targets: segment-vs-sphere against the TARGETS registry, so a 55 m/s
 *    bolt can't tunnel through a drone on a slow frame.
 */
export function Projectiles() {
  const meshRef = useRef<InstancedMesh>(null);
  const weapon = useWeapon();
  const { world, rapier } = useRapier();
  const scratch = useMemo(() => new Vector3(), []);
  const prevPos = useMemo(() => new Vector3(), []);
  const segment = useMemo(() => new Vector3(), []);
  const toTargetFromStart = useMemo(() => new Vector3(), []);
  const dummy = useMemo(() => new Object3D(), []);
  const toTarget = useMemo(() => new Vector3(), []);
  const up = useMemo(() => new Vector3(0, 1, 0), []);
  // One reusable ray — never allocate in the frame loop.
  const ray = useMemo(() => new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }), [rapier]);
  // Only fixed colliders count as "the world" for bullets: not sensors
  // (triggers), not kinematic enemies (TARGETS handles those), not the
  // dynamic player body (also in TARGETS).
  const worldFilter = useMemo(
    () =>
      rapier.QueryFilterFlags.EXCLUDE_SENSORS |
      rapier.QueryFilterFlags.EXCLUDE_KINEMATIC |
      rapier.QueryFilterFlags.EXCLUDE_DYNAMIC,
    [rapier],
  );

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

      prevPos.copy(p.position);
      const stepDist = p.speed * dt;
      p.position.addScaledVector(p.direction, stepDist);

      scratch.copy(p.position).sub(p.origin);
      const outOfRange = scratch.lengthSq() > p.maxRange * p.maxRange;
      const expired = p.lifetime >= p.maxLifetime;

      if (outOfRange || expired) {
        list.splice(i, 1);
        continue;
      }

      // --- swept world-geometry check: raycast the full frame's travel ---
      ray.origin.x = prevPos.x;
      ray.origin.y = prevPos.y;
      ray.origin.z = prevPos.z;
      ray.dir.x = p.direction.x;
      ray.dir.y = p.direction.y;
      ray.dir.z = p.direction.z;
      const worldHit = world.castRay(ray, stepDist + PROJECTILE_RADIUS, true, worldFilter);
      if (worldHit) {
        // Land the impact effect at the hit point, not the overshoot position.
        p.position.copy(prevPos).addScaledVector(p.direction, Math.max(0, worldHit.timeOfImpact));
        scratch.copy(p.direction).negate();
        spawnSparks(p.position, scratch, p.owner === "player" ? PLAYER_SPARK : ENEMY_SPARK, 8, 5);
        list.splice(i, 1);
        continue;
      }

      // --- swept target check: segment (prevPos -> position) vs sphere ---
      let hit = false;
      segment.copy(p.position).sub(prevPos);
      const segLenSq = segment.lengthSq();
      for (const target of TARGETS) {
        if (target.owner === p.owner) continue;
        const hitDist = PROJECTILE_RADIUS + target.radius;
        // Closest point on the travel segment to the target center.
        toTargetFromStart.copy(target.position).sub(prevPos);
        const t =
          segLenSq > 1e-8
            ? Math.min(1, Math.max(0, toTargetFromStart.dot(segment) / segLenSq))
            : 0;
        scratch.copy(prevPos).addScaledVector(segment, t).sub(target.position);
        if (scratch.lengthSq() <= hitDist * hitDist) {
          target.onHit(p.damage);
          // Snap to the contact point for the spark burst.
          p.position.copy(prevPos).addScaledVector(segment, t);
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
