import { useAppState } from "../game/systems/appState";
import { initSound } from "../game/systems/sound";

/**
 * Title screen — overlays the slow cinematic arena flyover rendered by the
 * canvas underneath (see Game.tsx's CinematicCamera), so the "menu
 * background" is the live game world itself.
 */
export function TitleScreen() {
  const phase = useAppState((s) => s.phase);
  const startLoading = useAppState((s) => s.startLoading);

  if (phase !== "title") return null;

  return (
    <div style={styles.root}>
      <div style={styles.scrim} />

      <div style={styles.content}>
        <div style={styles.kicker}>THE ARENA DEMANDS A FOOL</div>
        <h1 style={styles.title}>
          THE{" "}
          <span style={styles.titleAccent}>JESTER</span>
        </h1>
        <div style={styles.subtitle}>a jetpack arena game</div>

        <button
          style={styles.startButton}
          onClick={() => {
            // AudioContext must be created inside a user gesture.
            initSound();
            startLoading();
          }}
          autoFocus
        >
          ▶&nbsp; ENTER THE ARENA
        </button>

        <div style={styles.controls}>
          <div style={styles.controlRow}><b>CLICK</b> lock mouse &nbsp;·&nbsp; <b>MOUSE</b> look</div>
          <div style={styles.controlRow}><b>W A S D</b> fly &nbsp;·&nbsp; <b>SPACE / CTRL</b> up / down</div>
          <div style={styles.controlRow}><b>SHIFT</b> boost &nbsp;·&nbsp; <b>HOLD LMB</b> fire &nbsp;·&nbsp; <b>T</b> keyboard-turn</div>
        </div>
      </div>

      <div style={styles.footer}>survive the hazards · dodge the guards · find the exit</div>

      {/* corner flourishes */}
      <div style={{ ...styles.corner, top: 18, left: 18, borderWidth: "2px 0 0 2px" }} />
      <div style={{ ...styles.corner, top: 18, right: 18, borderWidth: "2px 2px 0 0" }} />
      <div style={{ ...styles.corner, bottom: 18, left: 18, borderWidth: "0 0 2px 2px" }} />
      <div style={{ ...styles.corner, bottom: 18, right: 18, borderWidth: "0 2px 2px 0" }} />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    position: "absolute",
    inset: 0,
    zIndex: 20,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
    color: "#e6e8ff",
    userSelect: "none",
    overflow: "hidden",
  },
  scrim: {
    position: "absolute",
    inset: 0,
    background:
      "radial-gradient(ellipse at center, rgba(5,6,13,0.25) 0%, rgba(5,6,13,0.78) 80%)",
  },
  content: {
    position: "relative",
    textAlign: "center",
    animation: "jester-title-in 900ms ease-out both",
  },
  kicker: {
    fontSize: 12,
    letterSpacing: 6,
    color: "#a78bfa",
    marginBottom: 12,
    textShadow: "0 0 14px rgba(124,58,237,0.9)",
  },
  title: {
    margin: 0,
    fontSize: "clamp(56px, 11vw, 128px)",
    fontWeight: 800,
    letterSpacing: 8,
    lineHeight: 1,
    color: "#f4efe6",
    textShadow:
      "0 0 24px rgba(124,58,237,0.65), 0 0 90px rgba(192,38,211,0.4), 0 4px 0 rgba(59,7,100,0.9)",
  },
  titleAccent: {
    color: "#c026d3",
    textShadow:
      "0 0 24px rgba(192,38,211,0.9), 0 0 90px rgba(192,38,211,0.55), 0 4px 0 rgba(59,7,100,0.9)",
  },
  subtitle: {
    marginTop: 10,
    fontSize: 14,
    letterSpacing: 4,
    color: "#9aa3d0",
  },
  startButton: {
    marginTop: 42,
    padding: "16px 44px",
    fontSize: 18,
    fontWeight: 700,
    letterSpacing: 3,
    fontFamily: "inherit",
    color: "#0b0410",
    background: "linear-gradient(135deg, #fbbf24, #f59e0b)",
    border: "none",
    borderRadius: 10,
    cursor: "pointer",
    boxShadow: "0 0 28px rgba(245,158,11,0.55), 0 6px 0 rgba(120,53,15,0.9)",
    pointerEvents: "auto",
  },
  controls: {
    marginTop: 40,
    fontSize: 12,
    lineHeight: 2,
    color: "#9aa3d0",
    letterSpacing: 1,
  },
  controlRow: {},
  footer: {
    position: "absolute",
    bottom: 26,
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 11,
    letterSpacing: 3,
    color: "#5b628c",
  },
  corner: {
    position: "absolute",
    width: 46,
    height: 46,
    borderStyle: "solid",
    borderColor: "rgba(167,139,250,0.6)",
  },
};
