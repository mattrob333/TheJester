import { bus } from "./events";

/**
 * Per-run scoreboard for the victory screen: time, shots fired, kills,
 * deaths, peak suspicion. Event-driven (bus subscriptions registered once at
 * import) with an explicit `resetRunStats()` called when a run starts —
 * module-scoped like the other high-frequency systems, but restartable.
 */
export interface RunStats {
  startedAt: number; // performance.now() ms
  endedAt: number | null;
  shotsFired: number;
  kills: number;
  deaths: number;
  peakSuspicion: number;
}

export const runStats: RunStats = {
  startedAt: 0,
  endedAt: null,
  shotsFired: 0,
  kills: 0,
  deaths: 0,
  peakSuspicion: 0,
};

export function resetRunStats() {
  runStats.startedAt = performance.now();
  runStats.endedAt = null;
  runStats.shotsFired = 0;
  runStats.kills = 0;
  runStats.deaths = 0;
  runStats.peakSuspicion = 0;
}

/** Freeze the clock when the run ends (win). */
export function finishRunStats() {
  runStats.endedAt = performance.now();
}

/** Elapsed run time in seconds (live until finished). */
export function runElapsedSeconds(): number {
  const end = runStats.endedAt ?? performance.now();
  return Math.max(0, (end - runStats.startedAt) / 1000);
}

/** Called every tick from SystemsTicker so the peak tracks the live meter. */
export function trackPeakSuspicion(current: number) {
  if (current > runStats.peakSuspicion) runStats.peakSuspicion = current;
}

bus.on("shotFired", ({ owner }) => {
  if (owner === "player") runStats.shotsFired += 1;
});
bus.on("enemyKilled", () => {
  runStats.kills += 1;
});
bus.on("playerDied", () => {
  runStats.deaths += 1;
});
