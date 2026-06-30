import { bus } from "./events";
import { setSirenSourceActive } from "./coverState";
import { useGameState } from "./gameState";

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
 *
 * Full version (elite guards + drones spawn, announcer line) depends on
 * Phase 4 (4.1 enemies exist) and Phase 5 (5.x announcer). That half is
 * explicitly NOT implemented here — see the TODO below. This module owns
 * only the "is a lockdown currently active" boolean + the forced-siren
 * side effect; spawning real responders is a follow-up once those systems
 * exist.
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
const CLEAR_POLL_MS = 250;

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
  }
  // TODO(Phase 4/5): on "detected", also spawn elite guards + a security
  // drone (4.1/4.2) and fire an announcer "you've been made" line (5.x).
  // Neither system exists yet; this is the explicit deferral the spec
  // calls for rather than leaving the ticket silently half-done.
});

setInterval(() => {
  if (!lockdownActive) return;
  if (useGameState.getState().suspicion <= 0) {
    setLockdown(false);
  }
}, CLEAR_POLL_MS);

export function isLockdownActive(): boolean {
  return lockdownActive;
}
