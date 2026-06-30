import { Vector3 } from "three";
import { TARGETS, type Targetable, type TargetOwner } from "./targets";

/**
 * Ticket 3.1b — soft lock-on targeting.
 *
 * Pure helper: finds the nearest valid target in front of the player (within
 * a forward cone and max range), excluding a given owner (so the player
 * never locks onto itself / its own shots). Kept owner-agnostic so enemies
 * can reuse it in Phase 4 for their own targeting.
 */

export interface FindTargetOptions {
  /** Max search distance, meters. */
  maxRange: number;
  /** Half-angle of the forward cone, radians. Targets outside this angle are ignored. */
  coneAngle: number;
  /** Targets owned by this owner are excluded (e.g. the searcher's own owner). */
  excludeOwner: TargetOwner;
}

const toTarget = new Vector3();

/**
 * Returns the closest target within `maxRange` and within `coneAngle` of
 * `forward` (unit vector), or `null` if none qualify. `forward` MUST already
 * be normalized — this function does not normalize it (called every frame,
 * avoid redundant work since callers already have a normalized forward).
 */
export function findNearestTarget(
  origin: Vector3,
  forward: Vector3,
  options: FindTargetOptions,
): Targetable | null {
  const { maxRange, coneAngle, excludeOwner } = options;
  const minCos = Math.cos(coneAngle);
  const maxRangeSq = maxRange * maxRange;

  let best: Targetable | null = null;
  let bestDistSq = Infinity;

  for (const target of TARGETS) {
    if (target.owner === excludeOwner) continue;

    toTarget.copy(target.position).sub(origin);
    const distSq = toTarget.lengthSq();
    if (distSq > maxRangeSq || distSq < 1e-6) continue;

    // Cone check via dot product of normalized direction vs forward.
    const dist = Math.sqrt(distSq);
    const dot = toTarget.dot(forward) / dist;
    if (dot < minCos) continue;

    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      best = target;
    }
  }

  return best;
}
