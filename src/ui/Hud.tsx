import { useEffect, useRef, useState } from "react";
import { bus } from "../game/systems/events";
import { useGameState } from "../game/systems/gameState";
import { useAppState } from "../game/systems/appState";
import { telemetry } from "./telemetry";

const CAPTION_DURATION_MS = 4000;

/**
 * In-game HUD (visual-polish pass).
 *
 * - Crosshair (center) — the weapon fires where you look.
 * - Health bar + suspicion meter (bottom-left), color-shifting as they
 *   drain/fill, reading reactively from the zustand game state.
 * - Speed/boost readout (bottom-right), polled from the telemetry bridge.
 * - Announcer caption (Ticket 5.1) — subscribes to `announcerLine` bus
 *   events and displays the text for a few seconds before fading out.
 *
 * Hidden entirely outside the "playing" phase so the title/loading screens
 * stay clean.
 */
export function Hud() {
  const phase = useAppState((s) => s.phase);
  const health = useGameState((s) => s.health);
  const maxHealth = useGameState((s) => s.maxHealth);
  const suspicion = useGameState((s) => s.suspicion);
  const [caption, setCaption] = useState<string | null>(null);
  const [speed, setSpeed] = useState(0);
  const [lockdown, setLockdown] = useState(false);
  /** null = no recent shot; otherwise whether the last shot was covered. */
  const [shotTick, setShotTick] = useState<"open" | "covered" | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shotTickTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Teach the suspicion system wordlessly (review §4): every player shot
  // flashes the suspicion meter — angry red for an open shot, calm cyan-green
  // for a covered one — at the exact moment the cost is (or isn't) paid.
  useEffect(() => {
    const onShot = ({ owner, covered }: { owner: string; covered: boolean }) => {
      if (owner !== "player") return;
      setShotTick(covered ? "covered" : "open");
      if (shotTickTimeout.current) clearTimeout(shotTickTimeout.current);
      shotTickTimeout.current = setTimeout(() => setShotTick(null), 320);
    };
    const onLockdown = ({ on }: { on: boolean }) => setLockdown(on);
    bus.on("shotFired", onShot);
    bus.on("lockdownActive", onLockdown);
    return () => {
      bus.off("shotFired", onShot);
      bus.off("lockdownActive", onLockdown);
      if (shotTickTimeout.current) clearTimeout(shotTickTimeout.current);
    };
  }, []);

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

  // Speed readout, polled at ~5Hz from the telemetry bridge.
  useEffect(() => {
    const id = setInterval(() => setSpeed(telemetry.speed), 200);
    return () => clearInterval(id);
  }, []);

  if (phase !== "playing") return null;

  const healthFrac = Math.max(0, Math.min(1, health / maxHealth));
  const suspicionFrac = Math.max(0, Math.min(1, suspicion / 100));
  const healthColor = healthFrac > 0.5 ? "#22c55e" : healthFrac > 0.25 ? "#facc15" : "#ef4444";
  const suspicionColor = suspicionFrac < 0.5 ? "#38bdf8" : suspicionFrac < 0.8 ? "#facc15" : "#ef4444";

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 5,
        pointerEvents: "none",
        fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
      }}
      data-hud-root
    >
      {/* crosshair */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 22,
          height: 22,
        }}
      >
        <div style={{ position: "absolute", top: 9, left: 0, width: 6, height: 4, background: "rgba(230,232,255,0.85)", borderRadius: 1 }} />
        <div style={{ position: "absolute", top: 9, right: 0, width: 6, height: 4, background: "rgba(230,232,255,0.85)", borderRadius: 1 }} />
        <div style={{ position: "absolute", left: 9, top: 0, width: 4, height: 6, background: "rgba(230,232,255,0.85)", borderRadius: 1 }} />
        <div style={{ position: "absolute", left: 9, bottom: 0, width: 4, height: 6, background: "rgba(230,232,255,0.85)", borderRadius: 1 }} />
        <div style={{ position: "absolute", top: 10, left: 10, width: 2, height: 2, background: "#ffd24a", borderRadius: "50%" }} />
      </div>

      {/* bottom-left: health + suspicion */}
      <div style={{ position: "absolute", left: 20, bottom: 20, width: 260 }}>
        <div style={barLabelStyle}>
          <span>HULL</span>
          <span>{Math.round(health)} / {maxHealth}</span>
        </div>
        <div style={barTrackStyle}>
          <div
            style={{
              ...barFillStyle,
              width: `${healthFrac * 100}%`,
              background: `linear-gradient(90deg, ${healthColor}bb, ${healthColor})`,
              boxShadow: `0 0 8px ${healthColor}88`,
            }}
          />
        </div>
        <div style={{ ...barLabelStyle, marginTop: 8 }}>
          <span>
            SUSPICION
            {shotTick === "open" && <span style={{ color: "#ef4444", marginLeft: 6 }}>▲ SEEN</span>}
            {shotTick === "covered" && <span style={{ color: "#34d399", marginLeft: 6 }}>● COVERED</span>}
          </span>
          <span>{Math.round(suspicion)}%</span>
        </div>
        <div
          style={{
            ...barTrackStyle,
            border:
              shotTick === "open"
                ? "1px solid rgba(239,68,68,0.95)"
                : shotTick === "covered"
                  ? "1px solid rgba(52,211,153,0.95)"
                  : barTrackStyle.border,
            boxShadow:
              shotTick === "open"
                ? "0 0 12px rgba(239,68,68,0.8)"
                : shotTick === "covered"
                  ? "0 0 12px rgba(52,211,153,0.7)"
                  : undefined,
          }}
        >
          <div
            style={{
              ...barFillStyle,
              width: `${suspicionFrac * 100}%`,
              background: `linear-gradient(90deg, ${suspicionColor}bb, ${suspicionColor})`,
              boxShadow: `0 0 8px ${suspicionColor}88`,
            }}
          />
        </div>
      </div>

      {/* lockdown alert */}
      {lockdown && (
        <div
          style={{
            position: "absolute",
            top: 24,
            left: "50%",
            transform: "translateX(-50%)",
            padding: "8px 22px",
            background: "rgba(127,29,29,0.85)",
            border: "1px solid rgba(248,113,113,0.9)",
            borderRadius: 8,
            color: "#fff",
            fontWeight: 700,
            fontSize: 14,
            letterSpacing: 3,
            textShadow: "0 0 10px rgba(239,68,68,0.9)",
            animation: "jester-bob 0.6s ease-in-out infinite",
          }}
        >
          ⚠ LOCKDOWN — GO DARK ⚠
        </div>
      )}

      {/* bottom-right: speed */}
      <div
        style={{
          position: "absolute",
          right: 20,
          bottom: 20,
          textAlign: "right",
          color: "#cdd3ff",
        }}
      >
        <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: 1, textShadow: "0 0 12px rgba(124,58,237,0.8)" }}>
          {speed.toFixed(1)}
          <span style={{ fontSize: 12, marginLeft: 4, color: "#7c83b3" }}>m/s</span>
        </div>
        <div style={{ fontSize: 10, letterSpacing: 2, color: "#7c83b3" }}>SHIFT = BOOST</div>
      </div>

      {/* announcer caption */}
      {caption && (
        <div
          style={{
            position: "absolute",
            bottom: 84,
            left: "50%",
            transform: "translateX(-50%)",
            maxWidth: "70vw",
            padding: "10px 18px",
            background: "rgba(8,10,18,0.78)",
            border: "1px solid rgba(167,139,250,0.45)",
            borderRadius: 8,
            color: "#e6e8ff",
            fontSize: 15,
            textAlign: "center",
            letterSpacing: 0.2,
            textShadow: "0 0 8px rgba(124,58,237,0.5)",
          }}
          data-announcer-caption
        >
          {caption}
        </div>
      )}
    </div>
  );
}

const barLabelStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  fontSize: 10,
  letterSpacing: 2,
  color: "#9aa3d0",
  marginBottom: 3,
};

const barTrackStyle: React.CSSProperties = {
  height: 10,
  borderRadius: 5,
  background: "rgba(10,12,24,0.75)",
  border: "1px solid rgba(99,102,241,0.35)",
  overflow: "hidden",
};

const barFillStyle: React.CSSProperties = {
  height: "100%",
  borderRadius: 4,
  transition: "width 180ms ease-out",
};
