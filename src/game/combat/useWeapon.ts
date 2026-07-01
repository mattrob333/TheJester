import { Vector3 } from "three";
import { bus } from "../systems/events";

export type ProjectileOwner = "player" | "enemy";

export interface ProjectileDescriptor {
  id: string;
  position: Vector3;
  direction: Vector3;
  speed: number;
  lifetime: number;
  maxLifetime: number;
  origin: Vector3;
  maxRange: number;
  owner: ProjectileOwner;
  covered: boolean;
  /** Ticket 3.1b — soft lock-on target id. When set, the projectile homes toward this target each frame instead of flying straight. */
  targetId: string | null;
}

const FIRE_COOLDOWN = 0.25; // seconds
const PROJECTILE_SPEED = 45; // m/s
const MAX_LIFETIME = 1.5; // seconds
const MAX_RANGE = 60; // meters

const state = {
  projectiles: [] as ProjectileDescriptor[],
  lastFire: -Infinity,
};

/**
 * Module-scoped weapon state shared by the spawner (Player.tsx) and the
 * renderer (Projectile.tsx). Per-frame data — plain ref/object, not zustand.
 */
export function useWeapon() {
  return state;
}

/**
 * Attempt to fire a projectile. Returns true if a shot was spawned (i.e. the
 * cooldown had elapsed). Emits `shotFired` for gameplay observers.
 */
export function fireProjectile(
  origin: Vector3,
  direction: Vector3,
  options: { covered?: boolean; owner?: ProjectileOwner; targetId?: string | null } = {},
): boolean {
  const now = performance.now() / 1000;
  if (now - state.lastFire < FIRE_COOLDOWN) return false;

  state.lastFire = now;

  const covered = options.covered ?? false;
  const owner = options.owner ?? "player";
  bus.emit("shotFired", { covered, owner });

  state.projectiles.push({
    id: `${now.toFixed(6)}-${Math.random().toString(36).slice(2, 8)}`,
    position: origin.clone(),
    direction: direction.clone().normalize(),
    speed: PROJECTILE_SPEED,
    lifetime: 0,
    maxLifetime: MAX_LIFETIME,
    origin: origin.clone(),
    maxRange: MAX_RANGE,
    owner,
    covered,
    targetId: options.targetId ?? null,
  });

  return true;
}
