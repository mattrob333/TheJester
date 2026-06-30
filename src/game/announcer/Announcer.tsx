import { useEffect, useState } from "react";
import { bus } from "../systems/events";
import { useGameState } from "../systems/gameState";
import { activeArena } from "../config/activeArena";
import { getBarkLine } from "./lines";

/**
 * Ticket 5.1 — Bark system.
 *
 * Subscribes to gameplay bus events and emits a resolved `announcerLine` bus
 * event with the matching display text, looked up from `lines.json` via the
 * arena config's `announcer.events` id map. Kept decoupled the same way
 * every other system is: this module only ever calls `bus.emit`/`bus.on`,
 * nothing calls it directly.
 *
 * Plays the arena intro line once on mount. Gameplay event lines (hazard
 * warning, low-HP, suspicion warning) are edge-triggered so they don't spam
 * repeatedly while a condition is sustained.
 */

const LOW_HP_THRESHOLD = 30;

function emitBark(barkId: string | undefined) {
  if (!barkId) return;
  // Ticket 5.2: resolve against the current story tier so the same bark id
  // can read differently as storyProgress advances (believer -> doubter ->
  // ally), without arena configs needing to know about story tiers at all.
  const tier = useGameState.getState().storyProgress;
  const text = getBarkLine(barkId, tier);
  if (!text) return;
  bus.emit("announcerLine", { text });
}

// Module-scoped so the side-effect import only registers listeners once,
// matching the suspicion.ts/lockdown.ts pattern.
let lowHpFired = false;

function handlePlayerDamaged() {
  const health = useGameState.getState().health;
  if (health <= LOW_HP_THRESHOLD) {
    if (!lowHpFired) {
      emitBark(activeArena.announcer.events.lowHp);
      lowHpFired = true;
    }
  } else {
    lowHpFired = false;
  }
}

function handleSuspicionThreshold(payload: { level: "warning" | "detected" }) {
  if (payload.level === "warning") {
    emitBark(activeArena.announcer.events.suspicionWarning);
  }
}

function handleHazardWarning() {
  emitBark(activeArena.announcer.events.hazardWarning);
}

bus.on("playerDamaged", handlePlayerDamaged);
bus.on("suspicionThreshold", handleSuspicionThreshold);
// No dedicated "hazard warning" trigger event exists yet (no system computes
// near-miss proximity); exposed here as a manually-callable hook for hazards
// to opt into later. Kept as a named handler (not wired to bus.on) so a
// future ticket can call `triggerHazardWarning()` once a near-miss signal
// exists, without inventing one now (YAGNI).
export function triggerHazardWarning() {
  handleHazardWarning();
}

/**
 * Mountable component: plays the arena intro line once, and exposes nothing
 * else visually — the actual caption rendering lives in `Hud.tsx`, which
 * subscribes to `announcerLine` independently so the caption can be reused
 * without this component needing to own display state.
 */
export function Announcer() {
  const [played, setPlayed] = useState(false);
  useEffect(() => {
    if (!played) {
      emitBark(activeArena.announcer.intro);
      setPlayed(true);
    }
  }, [played]);
  return null;
}
