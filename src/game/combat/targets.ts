import { Vector3 } from "three";

export type TargetOwner = "player" | "enemy";

export interface Targetable {
  id: string;
  position: Vector3;
  radius: number;
  owner: TargetOwner;
  /** Called when a projectile connects; `damage` comes from the projectile. */
  onHit: (damage: number) => void;
}

/**
 * Global registry of targetable objects. Player projectiles check against this
 * array each frame; targets register/unregister in their mount effects.
 *
 * Kept as a plain module-level array (not React state) because membership and
 * positions are read every frame by Projectile.tsx.
 */
export const TARGETS: Targetable[] = [];

export function registerTarget(target: Targetable) {
  TARGETS.push(target);
}

export function unregisterTarget(target: Targetable) {
  const index = TARGETS.indexOf(target);
  if (index >= 0) TARGETS.splice(index, 1);
}

/** Look up a registered target by id (used by homing projectiles + the lock-on indicator). */
export function getTarget(id: string): Targetable | undefined {
  return TARGETS.find((t) => t.id === id);
}
