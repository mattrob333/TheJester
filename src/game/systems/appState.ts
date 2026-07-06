import { create } from "zustand";

export type AppPhase = "title" | "loading" | "playing" | "victory";

/**
 * App-level flow state (title → loading → playing → victory), kept separate
 * from `gameState.ts` (which is *in-game* state: health, suspicion,
 * checkpoints). Systems that should only run during live play gate on
 * `phase === "playing"`; the overlay screens render on the other phases.
 *
 * `runId` increments every time a new run begins loading — the arena is
 * keyed on it (see Game.tsx), so "play again" fully remounts the level:
 * dead enemies respawn, checkpoints un-green, beacons re-arm, and every
 * mount-registered cover source re-registers. Module singletons that
 * survive remounts (weapon pool, suspicion model, lockdown, stats) are
 * reset explicitly in Game.tsx's phase effect.
 *
 * `devMode` gates the developer tooling (leva panel, stats, debug overlay) —
 * toggled with the backquote (`) key so players get a clean screen by default.
 */
interface AppState {
  phase: AppPhase;
  runId: number;
  devMode: boolean;
  startLoading: () => void;
  startPlaying: () => void;
  /** The player reached the exit — freeze gameplay and show the stats screen. */
  winRun: () => void;
  toggleDevMode: () => void;
}

export const useAppState = create<AppState>((set) => ({
  phase: "title",
  runId: 0,
  devMode: false,
  startLoading: () => set((s) => ({ phase: "loading", runId: s.runId + 1 })),
  startPlaying: () => set({ phase: "playing" }),
  winRun: () => set({ phase: "victory" }),
  toggleDevMode: () => set((s) => ({ devMode: !s.devMode })),
}));
