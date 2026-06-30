import { create } from "zustand";
import { bus } from "./events";

export type StoryProgress = "believer" | "doubter" | "ally";

export interface GameState {
  health: number; // 0..100
  maxHealth: number;
  suspicion: number; // 0..100
  checkpoint: [number, number, number];
  storyProgress: StoryProgress;

  // actions
  damage: (n: number) => void;
  heal: (n: number) => void;
  addSuspicion: (n: number) => void;
  decaySuspicion: (n: number) => void; // clamp 0..100
  setCheckpoint: (p: [number, number, number]) => void;
  setStory: (s: StoryProgress) => void;
  reset: () => void; // restore defaults
}

const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));

const DEFAULTS = {
  health: 100,
  maxHealth: 100,
  suspicion: 0,
  checkpoint: [0, 2, 0] as [number, number, number],
  storyProgress: "believer" as StoryProgress,
};

/**
 * Central game-state store.
 *
 * zustand is used (over React context) specifically because it can be read and
 * written from OUTSIDE the React render loop — the game/update loop needs that.
 * Access non-reactively via `useGameState.getState()` / `.setState()`.
 */
export const useGameState = create<GameState>((set) => ({
  ...DEFAULTS,

  damage: (n) =>
    set((s) => ({ health: clamp(s.health - n, 0, s.maxHealth) })),

  heal: (n) => set((s) => ({ health: clamp(s.health + n, 0, s.maxHealth) })),

  addSuspicion: (n) =>
    set((s) => ({ suspicion: clamp(s.suspicion + n, 0, 100) })),

  decaySuspicion: (n) =>
    set((s) => ({ suspicion: clamp(s.suspicion - n, 0, 100) })),

  setCheckpoint: (p) => set({ checkpoint: p }),

  setStory: (s) => set({ storyProgress: s }),

  reset: () => set({ ...DEFAULTS }),
}));

/**
 * Demo wiring to prove the bus → store architecture is end-to-end.
 *
 * TODO(3.3): replace with the real suspicion model. This placeholder just bumps
 * suspicion when an uncovered shot is fired so we can verify the plumbing.
 */
bus.on("shotFired", ({ covered }) => {
  if (!covered) {
    useGameState.getState().addSuspicion(12);
  }
});
