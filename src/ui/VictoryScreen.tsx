import { useAppState } from "../game/systems/appState";
import { runStats, runElapsedSeconds } from "../game/systems/runStats";

/**
 * Victory screen — shown when the player flies through the exit portal.
 * Presents the run's scoreboard (frozen by `finishRunStats()` at the moment
 * of the win) over the cinematic arena flyover, with a "play again" that
 * kicks off a fully reset run (loading → remounted arena).
 */
export function VictoryScreen() {
  const phase = useAppState((s) => s.phase);
  const startLoading = useAppState((s) => s.startLoading);

  if (phase !== "victory") return null;

  const secs = runElapsedSeconds();
  const mm = Math.floor(secs / 60);
  const ss = (secs % 60).toFixed(1).padStart(4, "0");

  return (
    <div style={styles.root}>
      <div style={styles.scrim} />
      <div style={styles.content}>
        <div style={styles.kicker}>THE CROWD GOES WILD</div>
        <h1 style={styles.title}>ARENA CLEARED</h1>

        <div style={styles.statsCard}>
          <StatRow label="TIME" value={`${mm}:${ss}`} />
          <StatRow label="SHOTS FIRED" value={String(runStats.shotsFired)} />
          <StatRow label="KILLS" value={String(runStats.kills)} />
          <StatRow label="DEATHS" value={String(runStats.deaths)} />
          <StatRow label="PEAK SUSPICION" value={`${Math.round(runStats.peakSuspicion)}%`} />
        </div>

        <button style={styles.button} onClick={startLoading} autoFocus>
          ↻&nbsp; PLAY AGAIN
        </button>
      </div>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.statRow}>
      <span style={styles.statLabel}>{label}</span>
      <span style={styles.statValue}>{value}</span>
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
  },
  scrim: {
    position: "absolute",
    inset: 0,
    background:
      "radial-gradient(ellipse at center, rgba(5,6,13,0.35) 0%, rgba(5,6,13,0.85) 80%)",
  },
  content: {
    position: "relative",
    textAlign: "center",
    animation: "jester-title-in 700ms ease-out both",
  },
  kicker: {
    fontSize: 12,
    letterSpacing: 6,
    color: "#fbbf24",
    marginBottom: 10,
    textShadow: "0 0 14px rgba(245,158,11,0.9)",
  },
  title: {
    margin: 0,
    fontSize: "clamp(40px, 7vw, 84px)",
    fontWeight: 800,
    letterSpacing: 6,
    color: "#f4efe6",
    textShadow: "0 0 24px rgba(34,197,94,0.6), 0 4px 0 rgba(5,46,22,0.9)",
  },
  statsCard: {
    margin: "30px auto 0",
    width: 320,
    maxWidth: "80vw",
    padding: "18px 22px",
    background: "rgba(8,10,18,0.82)",
    border: "1px solid rgba(167,139,250,0.45)",
    borderRadius: 12,
    textAlign: "left",
  },
  statRow: {
    display: "flex",
    justifyContent: "space-between",
    padding: "6px 0",
    borderBottom: "1px solid rgba(99,102,241,0.15)",
  },
  statLabel: { fontSize: 11, letterSpacing: 2, color: "#9aa3d0" },
  statValue: { fontSize: 14, fontWeight: 700, color: "#e6e8ff" },
  button: {
    marginTop: 30,
    padding: "14px 40px",
    fontSize: 16,
    fontWeight: 700,
    letterSpacing: 3,
    fontFamily: "inherit",
    color: "#0b0410",
    background: "linear-gradient(135deg, #4ade80, #22c55e)",
    border: "none",
    borderRadius: 10,
    cursor: "pointer",
    boxShadow: "0 0 24px rgba(34,197,94,0.5), 0 5px 0 rgba(5,46,22,0.9)",
    pointerEvents: "auto",
  },
};
