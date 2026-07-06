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

export const FIRE_COOLDOWN = 0.16; // seconds — the player's trigger rate
const PROJECTILE_SPEED = 55; // m/s
const MAX_LIFETIME = 1.5; // seconds
const MAX_RANGE = 70; // meters
const PLAYER_DAMAGE = 6;
const ENEMY_DAMAGE = 8;

const state = {
  projectiles: [] as ProjectileDescriptor[],
  /** Mirror of the player's cooldown stamp, kept for the debug overlay readout. */
  lastFire: -Infinity,
};

/**
 * Cooldown belongs to the SHOOTER, not the projectile system: one stamp per
 * shooter id. The original single shared `lastFire` meant a drone firing
 * would silently eat the player's next shot (and drones gated each other) —
 * the code-review's §2.1 bug.
 */
const cooldownByShooter = new Map<string, number>();

/**
 * Module-scoped weapon state shared by the spawner (Player.tsx) and the
 * renderer (Projectile.tsx). Per-frame data — plain ref/object, not zustand.
 */
export function useWeapon() {
  return state;
}

/** Clears the projectile pool and all cooldown stamps for a fresh run. */
export function resetWeapon() {
  state.projectiles.length = 0;
  state.lastFire = -Infinity;
  cooldownByShooter.clear();
}

export interface FireOptions {
  covered?: boolean;
  owner?: ProjectileOwner;
  targetId?: string | null;
  /** Unique id of whoever pulled the trigger. Defaults to the owner string (fine for the single player; enemies should pass their own id). */
  shooterId?: string;
  /** Seconds between this shooter's shots. Defaults to the player trigger rate. */
  cooldown?: number;
}

/**
 * Attempt to fire a projectile. Returns true if a shot was spawned (i.e. the
 * shooter's own cooldown had elapsed). Emits `shotFired` for gameplay observers.
 */
export function fireProjectile(
  origin: Vector3,
  direction: Vector3,
  options: FireOptions = {},
): boolean {
  const now = performance.now() / 1000;
  const owner = options.owner ?? "player";
  const shooterId = options.shooterId ?? owner;
  const cooldown = options.cooldown ?? FIRE_COOLDOWN;

  const last = cooldownByShooter.get(shooterId) ?? -Infinity;
  if (now - last < cooldown) return false;
  cooldownByShooter.set(shooterId, now);
  if (shooterId === "player") state.lastFire = now;

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
