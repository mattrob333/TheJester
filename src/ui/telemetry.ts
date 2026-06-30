/**
 * Tiny mutable bridge for debug telemetry that lives INSIDE the R3F canvas
 * (camera position, updated every frame) but needs to be read by the HTML
 * DebugOverlay OUTSIDE the canvas. Plain mutable object — no re-render churn;
 * the overlay polls it from its own requestAnimationFrame loop.
 */
export const telemetry: { camPos: [number, number, number] } = {
  camPos: [0, 0, 0],
};
