export type HazardPhase = "idle" | "warning" | "active";

/** How long the warning light blinks before a cyclic hazard goes lethal. */
export const TELEGRAPH_DURATION = 0.6;

/**
 * Cyclic idle → warning → active → idle timing shared by the crusher and
 * laser hazards. `t` is elapsed seconds (e.g. from r3f's clock); `interval`
 * is the full cycle length; `activeDuration` is how long the lethal phase
 * lasts within that cycle.
 */
export function cyclePhase(t: number, interval: number, activeDuration: number): HazardPhase {
  const cycle = ((t % interval) + interval) % interval;
  const activeStart = interval - activeDuration;
  const warningStart = Math.max(0, activeStart - TELEGRAPH_DURATION);
  if (cycle >= activeStart) return "active";
  if (cycle >= warningStart) return "warning";
  return "idle";
}

/** Minimum time between repeated damage ticks while continuously touching a hazard. */
export const HIT_COOLDOWN = 0.5;

export const HAZARD_COLOR: Record<HazardPhase, string> = {
  idle: "#1f2937",
  warning: "#facc15",
  active: "#ef4444",
};
