import { useEffect, useState } from "react";
import { bus } from "../game/systems/events";

const BEAT_MS = 1300; // matches Player.tsx's DEATH_BEAT_SECONDS

/**
 * Death ceremony overlay: on `playerDied`, fade to black with an
 * "ELIMINATED" stamp for the duration of the death beat, then fade back as
 * the player respawns at their checkpoint. Pure listener — the actual
 * respawn timing lives in Player.tsx.
 */
export function DeathOverlay() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    const handler = () => {
      setActive(true);
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => setActive(false), BEAT_MS);
    };
    bus.on("playerDied", handler);
    return () => {
      bus.off("playerDied", handler);
      if (timeout) clearTimeout(timeout);
    };
  }, []);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 12,
        pointerEvents: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "radial-gradient(ellipse at center, rgba(30,0,10,0.85) 0%, rgba(0,0,0,0.96) 80%)",
        opacity: active ? 1 : 0,
        transition: `opacity ${active ? 180 : 500}ms ease-${active ? "in" : "out"}`,
        fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
      }}
    >
      <div
        style={{
          fontSize: 44,
          fontWeight: 800,
          letterSpacing: 10,
          color: "#ef4444",
          textShadow: "0 0 30px rgba(239,68,68,0.9)",
          transform: active ? "scale(1)" : "scale(1.3)",
          transition: "transform 250ms ease-out",
        }}
      >
        ELIMINATED
      </div>
    </div>
  );
}
