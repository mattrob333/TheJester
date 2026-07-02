import { useEffect, useState } from "react";
import { useAppState } from "../game/systems/appState";

/** Minimum time the loading screen stays up — long enough to land the joke. */
const MIN_DURATION_MS = 2600;
const TIPS = [
  "Calibrating jetpack… please keep arms inside the jester at all times.",
  "Sharpening razors. The razors asked us to.",
  "Bribing the announcer for nicer commentary… he declined.",
  "Polishing the crusher. It likes to look good for you.",
  "Reminding security drones that you are DEFINITELY not suspicious.",
  "Inflating hat bells to regulation pressure.",
];

/**
 * Loading screen — a stylized interstitial between the title screen and
 * gameplay. The scene is procedural (nothing heavy to fetch), so this is
 * paced by MIN_DURATION_MS: enough time for shaders to warm up during the
 * cinematic flyover behind it, plus one rotating "tip" for flavor. The bar
 * eases toward 100% and hands off to the "playing" phase.
 */
export function LoadingScreen() {
  const phase = useAppState((s) => s.phase);
  const startPlaying = useAppState((s) => s.startPlaying);
  const [progress, setProgress] = useState(0);
  const [tip] = useState(() => TIPS[Math.floor(Math.random() * TIPS.length)]);

  useEffect(() => {
    if (phase !== "loading") return;
    const start = performance.now();
    let raf = 0;
    const tick = () => {
      const t = Math.min(1, (performance.now() - start) / MIN_DURATION_MS);
      // Ease-out with a deliberate stall around 90% — loading screens lie.
      const eased = t < 0.85 ? t * 1.06 : 0.9 + (t - 0.85) * (0.1 / 0.15);
      setProgress(Math.min(1, eased));
      if (t >= 1) {
        startPlaying();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, startPlaying]);

  if (phase !== "loading") return null;

  return (
    <div style={styles.root}>
      <div style={styles.center}>
        <div style={styles.mask}>
          {/* jester mask glyph, pure CSS */}
          <div style={styles.maskFace}>
            <div style={{ ...styles.maskEye, left: 16 }} />
            <div style={{ ...styles.maskEye, right: 16 }} />
            <div style={styles.maskGrin} />
          </div>
        </div>

        <div style={styles.label}>PREPARING THE ARENA</div>

        <div style={styles.track}>
          <div style={{ ...styles.fill, width: `${progress * 100}%` }} />
        </div>
        <div style={styles.percent}>{Math.round(progress * 100)}%</div>

        <div style={styles.tip}>{tip}</div>
      </div>
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
    background:
      "radial-gradient(ellipse at center, rgba(12,8,26,0.92) 0%, rgba(5,6,13,0.97) 75%)",
    fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
    color: "#e6e8ff",
    userSelect: "none",
  },
  center: {
    textAlign: "center",
    width: 380,
    maxWidth: "84vw",
  },
  mask: {
    display: "flex",
    justifyContent: "center",
    marginBottom: 26,
  },
  maskFace: {
    position: "relative",
    width: 84,
    height: 64,
    borderRadius: "50% 50% 46% 46%",
    background: "#f4efe6",
    boxShadow: "0 0 30px rgba(192,38,211,0.5)",
    animation: "jester-bob 2.2s ease-in-out infinite",
  },
  maskEye: {
    position: "absolute",
    top: 22,
    width: 12,
    height: 12,
    borderRadius: "50%",
    background: "#34e8eb",
    boxShadow: "0 0 10px #34e8eb",
  },
  maskGrin: {
    position: "absolute",
    bottom: 12,
    left: "50%",
    transform: "translateX(-50%)",
    width: 34,
    height: 16,
    borderBottom: "4px solid #c026d3",
    borderRadius: "0 0 50% 50%",
    boxShadow: "0 6px 10px -4px rgba(192,38,211,0.8)",
  },
  label: {
    fontSize: 12,
    letterSpacing: 5,
    color: "#a78bfa",
    marginBottom: 14,
  },
  track: {
    height: 12,
    borderRadius: 6,
    background: "rgba(20,22,40,0.9)",
    border: "1px solid rgba(124,58,237,0.5)",
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 5,
    background: "linear-gradient(90deg, #7c3aed, #c026d3, #fbbf24)",
    boxShadow: "0 0 14px rgba(192,38,211,0.8)",
    transition: "width 120ms linear",
  },
  percent: {
    marginTop: 8,
    fontSize: 12,
    color: "#9aa3d0",
    letterSpacing: 2,
  },
  tip: {
    marginTop: 26,
    fontSize: 12,
    lineHeight: 1.7,
    color: "#7c83b3",
    fontStyle: "italic",
  },
};
