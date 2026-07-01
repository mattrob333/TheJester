import { useEffect, useRef, useState } from "react";
import { bus, type GameEvents } from "../game/systems/events";
import { useGameState } from "../game/systems/gameState";
import { coverState } from "../game/systems/coverState";
import { isLockdownActive } from "../game/systems/lockdown";
import { useWeapon, FIRE_COOLDOWN } from "../game/combat/useWeapon";
import { telemetry } from "./telemetry";

type LogEntry = { id: number; type: keyof GameEvents; payload: string };

/**
 * HTML debug overlay (Ticket 0.6 of the scaffold).
 *
 * Absolutely positioned, `pointer-events: none` so it never eats canvas input.
 * Shows: FPS, live camera position, live GameState (health / suspicion /
 * storyProgress) and a scrolling log of the last ~10 bus events.
 */
export function DebugOverlay() {
  const health = useGameState((s) => s.health);
  const maxHealth = useGameState((s) => s.maxHealth);
  const suspicion = useGameState((s) => s.suspicion);
  const storyProgress = useGameState((s) => s.storyProgress);

  const [fps, setFps] = useState(0);
  const [camPos, setCamPos] = useState<[number, number, number]>([0, 0, 0]);
  const [speed, setSpeed] = useState(0);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [cover, setCover] = useState({ siren: false, smoke: false });
  const [lockdown, setLockdown] = useState(false);
  const [inputMode, setInputMode] = useState<"locked" | "drag" | "inactive">("inactive");
  const [fireCooldown, setFireCooldown] = useState(0);
  const [lastBeacon, setLastBeacon] = useState<string | null>(null);
  const weapon = useWeapon();

  // Own rAF loop: FPS + camera position + player speed (read from the telemetry bridge).
  useEffect(() => {
    let raf = 0;
    let frames = 0;
    let last = performance.now();
    const tick = (now: number) => {
      frames++;
      if (now - last >= 500) {
        setFps(Math.round((frames * 1000) / (now - last)));
        frames = 0;
        last = now;
        setCamPos(telemetry.camPos);
        setSpeed(telemetry.speed);
        setCover({ siren: coverState.sirenActive, smoke: coverState.smokeActive });
        setLockdown(isLockdownActive());
        setInputMode(telemetry.inputMode);
        setLastBeacon(telemetry.lastBeaconId);
        const elapsed = now / 1000 - weapon.lastFire;
        setFireCooldown(Math.max(0, FIRE_COOLDOWN - elapsed));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [weapon]);

  // Subscribe to ALL bus events for the scrolling log.
  const counter = useRef(0);
  useEffect(() => {
    const handler = (type: keyof GameEvents, payload: unknown) => {
      setLog((prev) => {
        const entry: LogEntry = {
          id: counter.current++,
          type,
          payload: JSON.stringify(payload),
        };
        return [entry, ...prev].slice(0, 10);
      });
    };
    bus.on("*", handler);
    return () => bus.off("*", handler);
  }, []);

  const fmt = (n: number) => n.toFixed(2);

  return (
    <div style={styles.root}>
      <div style={styles.section}>
        <div style={styles.title}>THE JESTER · debug</div>
        <Row label="FPS" value={String(fps)} />
        <Row
          label="cam"
          value={`${fmt(camPos[0])}, ${fmt(camPos[1])}, ${fmt(camPos[2])}`}
        />
        <Row label="speed" value={`${fmt(speed)} m/s`} />
      </div>

      <div style={styles.section}>
        <div style={styles.title}>state</div>
        <Row label="health" value={`${health} / ${maxHealth}`} />
        <Row label="suspicion" value={`${suspicion}`} />
        <Row label="story" value={storyProgress} />
        <Row label="siren" value={cover.siren ? "ON" : "off"} />
        <Row label="smoke" value={cover.smoke ? "ON" : "off"} />
        <Row label="covered" value={cover.siren || cover.smoke ? "YES" : "no"} />
        <Row label="lockdown" value={lockdown ? "DETECTED" : "clear"} />
        <Row
          label="input mode"
          value={
            inputMode === "locked"
              ? "pointer locked"
              : inputMode === "drag"
                ? "drag-to-look"
                : "inactive"
          }
        />
        <Row
          label="fire cooldown"
          value={fireCooldown > 0 ? `${fmt(fireCooldown)}s` : "ready"}
        />
        <Row label="tutorial beat" value={lastBeacon ?? "— none yet —"} />
      </div>

      {lockdown && (
        <div style={styles.lockdownAlert}>⚠ CHEATING DETECTED — LOCKDOWN ⚠</div>
      )}

      <div style={styles.section}>
        <div style={styles.title}>controls (follow camera)</div>
        <div style={styles.dim}>click/RMB canvas to look · WASD move</div>
        <div style={styles.dim}>no pointer lock? hold + drag to turn</div>
        <div style={styles.dim}>Space/Ctrl up/down · Shift boost</div>
        <div style={styles.dim}>LMB to fire</div>
      </div>

      <div style={styles.section}>
        <div style={styles.title}>events (last 10)</div>
        {log.length === 0 ? (
          <div style={styles.dim}>— none yet —</div>
        ) : (
          log.map((e) => (
            <div key={e.id} style={styles.logLine}>
              <span style={styles.evType}>{e.type}</span>{" "}
              <span style={styles.dim}>{e.payload}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.row}>
      <span style={styles.dim}>{label}</span>
      <span>{value}</span>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    position: "absolute",
    top: 12,
    left: 12,
    zIndex: 10,
    pointerEvents: "none",
    width: 280,
    fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
    fontSize: 12,
    lineHeight: 1.5,
    color: "#cdd3ff",
    userSelect: "none",
  },
  section: {
    background: "rgba(8,10,18,0.72)",
    border: "1px solid rgba(99,102,241,0.35)",
    borderRadius: 8,
    padding: "8px 10px",
    marginBottom: 8,
    backdropFilter: "blur(4px)",
  },
  title: {
    color: "#a78bfa",
    fontWeight: 700,
    letterSpacing: 1,
    fontSize: 10,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  row: { display: "flex", justifyContent: "space-between", gap: 12 },
  logLine: {
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  evType: { color: "#34d399" },
  dim: { color: "#7c83b3" },
  lockdownAlert: {
    background: "rgba(220,38,38,0.85)",
    border: "1px solid rgba(248,113,113,0.9)",
    borderRadius: 8,
    padding: "8px 10px",
    marginBottom: 8,
    color: "#fff",
    fontWeight: 700,
    letterSpacing: 0.5,
    textAlign: "center",
  },
};
