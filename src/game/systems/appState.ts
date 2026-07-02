import { create } from "zustand";

export type AppPhase = "title" | "loading" | "playing";

/**
 * App-level flow state (title screen → loading screen → gameplay), kept
 * separate from `gameState.ts` (which is *in-game* state: health, suspicion,
 * checkpoints). Systems that should only run during live play gate on
 * `phase === "playing"`; the title/loading overlays render on the other two.
 *
 * `devMode` gates the developer tooling (leva panel, stats, debug overlay) —
 * toggled with the backquote (`) key so players get a clean screen by default.
 */
interface AppState {
  phase: AppPhase;
  devMode: boolean;
  startLoading: () => void;
  startPlaying: () => void;
  toggleDevMode: () => void;
}

export const useAppState = create<AppState>((set) => ({
  phase: "title",
  devMode: false,
  startLoading: () => set({ phase: "loading" }),
  startPlaying: () => set({ phase: "playing" }),
  toggleDevMode: () => set((s) => ({ devMode: !s.devMode })),
}));
