import { Vector3 } from "three";

/**
 * Module-scoped bridge exposing the live player world position outside the
 * `Player.tsx` component, for systems that need to track the player without
 * prop-drilling through `Game.tsx` (enemy AI chase/attack logic, Phase 4+).
 * Same pattern as `ui/telemetry.ts` and `combat/lockOn.ts` — plain mutable
 * object, updated every frame by `Player.tsx`, read every frame by readers.
 */
export const playerTracking = {
  position: new Vector3(),
  /** Mirrors GameState.health > 0 — enemies should stop targeting a respawning/dead player. */
  alive: true,
};
