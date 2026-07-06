import mitt, { type Emitter, type Handler } from "mitt";

/**
 * Typed event map for The Jester's game event bus.
 *
 * Extend this map as new systems come online (hazards, enemies, announcer, …).
 * Do NOT remove existing keys — downstream systems subscribe to them.
 */
export type GameEvents = {
  shotFired: { covered: boolean; owner: "player" | "enemy" };
  sirenActive: { on: boolean };
  smokeActive: { on: boolean };
  enemyKilled: { id: string; byHazard: boolean };
  /** `source` is a short hazard/enemy id (e.g. "razor", "crusher", "laser", "arena-guard") — Ticket 6.4 "last damage source" instrumentation. */
  playerDamaged: { amount: number; source: string };
  playerHidden: { hidden: boolean };
  checkpointReached: { pos: [number, number, number] };
  suspicionThreshold: { level: "warning" | "detected" };
  lockdownActive: { on: boolean };
  /** Ticket 5.1 — announcer bark resolved to display text, for the HUD caption. */
  announcerLine: { text: string };
  /** Health hit 0 — fired once per death, at the START of the death beat (before the respawn teleport). */
  playerDied: Record<string, never>;
  /** The player reached the exit portal — the run is won. */
  runWon: Record<string, never>;
};

/**
 * Singleton, strongly-typed event bus.
 *
 * Decoupling layer between systems: emitters and listeners never import each
 * other, only this module. Usage:
 *
 *   bus.on("shotFired", (e) => { ... });   // e is typed { covered, owner }
 *   bus.emit("shotFired", { covered: false, owner: "player" });
 *   bus.off("shotFired", handler);
 */
export const bus: Emitter<GameEvents> = mitt<GameEvents>();

/** Re-export for convenience when typing handlers explicitly. */
export type GameEventHandler<K extends keyof GameEvents> = Handler<GameEvents[K]>;
