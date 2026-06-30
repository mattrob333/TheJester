import { useEffect, useState } from "react";
import { bus } from "../game/systems/events";

const FLASH_OPACITY = 0.35;
const FADE_MS = 260;

/**
 * Full-screen damage flash (Ticket 2.3). Subscribes to the bus directly
 * (decoupled from whatever applied the damage — hazards, later enemies) and
 * pulses a red vignette. Complements the per-mesh "suit damage" halo in
 * `Player.tsx`.
 */
export function DamageFlash() {
  const [opacity, setOpacity] = useState(0);

  useEffect(() => {
    const handler = () => {
      setOpacity(FLASH_OPACITY);
      // Double rAF: let the browser paint the flash-up state before the CSS
      // transition eases it back down, otherwise React may batch the two
      // updates into one and the flash never renders.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setOpacity(0));
      });
    };
    bus.on("playerDamaged", handler);
    return () => bus.off("playerDamaged", handler);
  }, []);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 8,
        pointerEvents: "none",
        background: "radial-gradient(ellipse at center, transparent 35%, #ef4444 145%)",
        opacity,
        transition: `opacity ${FADE_MS}ms ease-out`,
      }}
    />
  );
}
