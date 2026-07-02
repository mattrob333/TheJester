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
  /** Damage dealt to whatever this projectile hits. */
  damage: number;
  /** Ticket 3.1b — soft lock-on target id. When set, the projectile homes toward this target each frame instead of flying straight. */
  targetId: string | null;
}

export const FIRE_COOLDOWN = 0.16; // seconds (player); enemies pace themselves
const PROJECTILE_SPEED = 55; // m/s
const MAX_LIFETIME = 1.5; // seconds
const MAX_RANGE = 70; // meters
const PLAYER_DAMAGE = 6;
const ENEMY_DAMAGE = 8;

const state = {
  projectiles: [] as ProjectileDescriptor[],
  /**
   * Per-owner cooldown stamps. These MUST be separate: with a single shared
   * stamp, an enemy firing would silently gate the player's next shot (and
   * vice versa) — an actual bug in the original single-`lastFire` version.
   */
  lastFire: -Infinity, // player (name kept for the debug overlay readout)
  lastEnemyFire: -Infinity,
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
 * owner's cooldown had elapsed). Emits `shotFired` for gameplay observers.
 */
export function fireProjectile(
  origin: Vector3,
  direction: Vector3,
  options: { covered?: boolean; owner?: ProjectileOwner; targetId?: string | null } = {},
): boolean {
  const now = performance.now() / 1000;
  const owner = options.owner ?? "player";

  if (owner === "player") {
    if (now - state.lastFire < FIRE_COOLDOWN) return false;
    state.lastFire = now;
  } else {
    if (now - state.lastEnemyFire < 0.05) return false;
    state.lastEnemyFire = now;
  }

  const covered = options.covered ?? false;
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
    damage: owner === "player" ? PLAYER_DAMAGE : ENEMY_DAMAGE,
    targetId: options.targetId ?? null,
  });

  return true;
}
