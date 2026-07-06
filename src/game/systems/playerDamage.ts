import { useGameState } from "./gameState";
import { bus } from "./events";

/**
 * Central player-damage funnel. Every source of player damage (hazards,
 * guard melee, enemy projectiles) goes through `applyPlayerDamage` so
 * cross-cutting rules live in ONE place — starting with the spawn shield:
 * a short invulnerability window after respawn/run-start, so a guard (or a
 * hazard cycle) camping the checkpoint can't chain-kill the player before
 * they can move.
 */

const SPAWN_SHIELD_SECONDS = 2;

let shieldUntil = 0;

export function grantSpawnShield(seconds = SPAWN_SHIELD_SECONDS) {
  shieldUntil = performance.now() + seconds * 1000;
}

export function isPlayerShielded(): boolean {
  return performance.now() < shieldUntil;
}

export function resetSpawnShield() {
  shieldUntil = 0;
}

/**
 * Apply damage to the player (respecting the spawn shield) and emit the
 * `playerDamaged` event. Returns true if damage actually landed.
 */
export function applyPlayerDamage(amount: number, source: string): boolean {
  if (isPlayerShielded()) return false;
  const gs = useGameState.getState();
  if (gs.health <= 0) return false; // already in the death beat
  gs.damage(amount);
  bus.emit("playerDamaged", { amount, source });
  return true;
}
