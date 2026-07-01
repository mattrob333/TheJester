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
} = {
  camPos: [0, 0, 0],
  speed: 0,
  inputMode: "inactive",
  lastBeaconId: null,
};
