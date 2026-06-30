/**
 * In-game HUD — STUB.
 *
 * Intentionally empty for Phase 0. The real HUD (health bar, suspicion meter,
 * ammo/cover state, announcer captions) is built in later tickets (see the
 * "what's stubbed" list in the README). Kept as a mounted, pointer-events-none
 * layer so future work has a home and the layering is already correct.
 */
export function Hud() {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 5,
        pointerEvents: "none",
      }}
      data-hud-root
    />
  );
}
