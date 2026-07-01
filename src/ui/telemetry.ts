/**
 * Tiny mutable bridge for debug telemetry that lives INSIDE the R3F canvas
 * (camera position, updated every frame) but needs to be read by the HTML
 * DebugOverlay OUTSIDE the canvas. Plain mutable object — no re-render churn;
 * the overlay polls it from its own requestAnimationFrame loop.
 */
export const telemetry: {
  camPos: [number, number, number];
  speed: number;
  /**
   * Current mouse-look input mode, written by Player.tsx every frame from
   * the useFlightInput state — Ticket 6.4 feel instrumentation. "locked" =
   * normal pointer-lock desktop path; "drag" = fallback drag-to-look is
   * actively turning the camera; "inactive" = pointer lock unavailable and
   * the player isn't currently holding the mouse down to drag-look.
   */
  inputMode: "locked" | "drag" | "inactive";
  /** Last tutorial beacon bark id triggered, for the "current teaching beat" readout. */
  lastBeaconId: string | null;
  /**
   * `source` of the most recent `playerDamaged` event (e.g. "razor",
   * "crusher", "laser", "arena-guard") — Ticket 6.4 "last damage source"
   * readout. Written by Player.tsx's existing playerDamaged subscription.
   */
  lastDamageSource: string | null;
  /**
   * `"<hazardType>:<phase>"` (e.g. "crusher:active") for whichever cyclic
   * hazard (crusher/laser) the player is currently standing inside the
   * sensor volume of, or `"razor:active"` while touching the always-armed
   * razor blade — Ticket 6.4 "hazard phase" readout. `null` when the player
   * isn't overlapping any hazard sensor. Each hazard writes this only while
   * its own overlap count is > 0, so it reflects the hazard the player is
   * actually interacting with rather than a global/arbitrary cycle.
   */
  hazardPhase: string | null;
  /**
   * Ticket 6.3 — whether the explicit keyboard-turn control mode (toggled
   * via T) is currently active, for the DebugOverlay control-mode readout.
   */
  keyboardTurnMode: boolean;
} = {
  camPos: [0, 0, 0],
  speed: 0,
  inputMode: "inactive",
  lastBeaconId: null,
  lastDamageSource: null,
  hazardPhase: null,
  keyboardTurnMode: false,
};
