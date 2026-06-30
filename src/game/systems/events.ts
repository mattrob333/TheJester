import mitt, { type Emitter, type Handler } from "mitt";

/**
 * Typed event map for The Jester's game event bus.
 *
 * Extend this map as new systems come online (hazards, enemies, announcer, …).
 * Do NOT remove existing keys — downstream systems subscribe to them.
 */
export type GameEvents = {
  shotFired: { covered: boolean };
  sirenActive: { on: boolean };
  smokeActive: { on: boolean };
  enemyKilled: { id: string; byHazard: boolean };
  playerDamaged: { amount: number };
  playerHidden: { hidden: boolean };
  checkpointReached: { pos: [number, number, number] };
  suspicionThreshold: { level: "warning" | "detected" };
  lockdownActive: { on: boolean };
};

/**
 * Singleton, strongly-typed event bus.
 *
 * Decoupling layer between systems: emitters and listeners never import each
 * other, only this module. Usage:
 *
 *   bus.on("shotFired", (e) => { ... });   // e is typed { covered: boolean }
 *   bus.emit("shotFired", { covered: false });
 *   bus.off("shotFired", handler);
 */
export const bus: Emitter<GameEvents> = mitt<GameEvents>();

/** Re-export for convenience when typing handlers explicitly. */
export type GameEventHandler<K extends keyof GameEvents> = Handler<GameEvents[K]>;
