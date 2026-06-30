import { useEffect, useRef, useState } from "react";
import { bus } from "../game/systems/events";

const CAPTION_DURATION_MS = 4000;

/**
 * In-game HUD.
 *
 * Ticket 5.1 — added the announcer caption: subscribes to `announcerLine`
 * bus events (emitted by `game/announcer/Announcer.tsx`) and displays the
 * text for a few seconds before fading out. Kept decoupled from the
 * announcer module itself — Hud only knows about the bus event, not who
 * emitted it.
 *
 * Health bar, suspicion meter, and ammo/cover state are still later tickets
 * (see the "what's stubbed" list in the README) — this only adds the
 * caption layer.
 */
export function Hud() {
  const [caption, setCaption] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handler = ({ text }: { text: string }) => {
      setCaption(text);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setCaption(null), CAPTION_DURATION_MS);
    };
    bus.on("announcerLine", handler);
    return () => {
      bus.off("announcerLine", handler);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 5,
        pointerEvents: "none",
      }}
      data-hud-root
    >
      {caption && (
        <div
          style={{
            position: "absolute",
            bottom: 48,
            left: "50%",
            transform: "translateX(-50%)",
            maxWidth: "70vw",
            padding: "10px 18px",
            background: "rgba(8,10,18,0.78)",
            border: "1px solid rgba(167,139,250,0.45)",
            borderRadius: 8,
            color: "#e6e8ff",
            fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
            fontSize: 15,
            textAlign: "center",
            letterSpacing: 0.2,
          }}
          data-announcer-caption
        >
          {caption}
        </div>
      )}
    </div>
  );
}
