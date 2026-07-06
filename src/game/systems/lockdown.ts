import { bus } from "./events";
import { setSirenSourceActive } from "./coverState";
import { useGameState } from "./gameState";
import { triggerBark } from "../announcer/Announcer";

/**
 * Ticket 3.4 — Cheating-detected response.
 *
 * Minimum acceptable scope for Phase 3 (per DEVELOPMENT_LOG.md 3.4): when
 * suspicion crosses the "detected" threshold (suspicion.ts already emits
 * `suspicionThreshold: { level: "detected" }` exactly once per crossing,
 * edge-triggered via `lastThresholdLevel`), trigger an observable lockdown
 * response:
 *   1. Force the global siren on via the existing 3.2 cover-state registry
 *      (`setSirenSourceActive`, reusing the same source-map pattern hazards
 *      use — don't bypass the registry by writing `coverState.sirenActive`
 *      directly, that would break the multi-source reconciliation).
 *   2. Emit a `lockdownActive: { on: true/false }` bus event so any UI
 *      (debug overlay today, a real HUD alert later) can react without
 *      polling the bus itself.
 *   3. (Follow-up, this tick) Play a story-tier-aware "you've been made"
 *      announcer bark via `triggerBark("lockdown_detected")` — now that
 *      Phase 5 (5.1/5.2 bark system + tier resolution) is complete, this
 *      half of the original 3.4 deferral is no longer blocked.
 *
 * Elite-guard + drone SPAWN on detection still depends on a dedicated
 * enemy-spawning API that neither 4.1 (Arena Guard) nor 4.2 (Security
 * Drone) currently exposes (they're placed once via arena config, not
 * spawned at runtime) — that half remains an explicit TODO below, since
 * building a runtime spawn system is a larger, more architecturally
 * significant change than this tick's scope.
 *
 * Clear condition: rather than adding a new bus event for "suspicion fully
 * decayed", this module polls `useGameState.getState().suspicion` on its
 * own short interval (decoupled from suspicion.ts's internal decay tick)
 * and auto-clears the lockdown once suspicion has decayed back to 0 —
 * mirrors how real stealth games end an alert state once the player has
 * gone fully cold. There's no "evade/lose them" mechanic yet to hook a
 * dedicated clear trigger to, so decaying back to 0 is the spec-minimal
 * clear condition.
 */

const LOCKDOWN_SIREN_SOURCE_ID = "lockdown";

let lockdownActive = false;

function setLockdown(active: boolean) {
  if (active === lockdownActive) return;
  lockdownActive = active;
  setSirenSourceActive(LOCKDOWN_SIREN_SOURCE_ID, active);
  bus.emit("lockdownActive", { on: active });
}

bus.on("suspicionThreshold", ({ level }) => {
  if (level === "detected") {
    setLockdown(true);
    triggerBark("lockdown_detected");
  }
  // TODO(Phase 7+, needs runtime enemy-spawn API): on "detected", also spawn
  // elite guards + a security drone. Neither ArenaGuard nor SecurityDrone
  // currently supports runtime spawning (both are placed once via arena
  // config at load time) — this is now the only remaining explicit deferral
  // from the original 3.4 ticket; the announcer line half shipped above.
});

/**
 * Clear check, driven from the game loop (SystemsTicker in Game.tsx) instead
 * of a `setInterval` — so a paused game can't silently clear a lockdown, and
 * HMR can't stack duplicate timers.
 */
export function updateLockdown() {
  if (!lockdownActive) return;
  if (useGameState.getState().suspicion <= 0) {
    setLockdown(false);
  }
}

/** Force-clears lockdown (including its siren source) for a fresh run. */
export function resetLockdown() {
  setLockdown(false);
}

export function isLockdownActive(): boolean {
  return lockdownActive;
}
