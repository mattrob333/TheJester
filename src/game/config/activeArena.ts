import type { ArenaConfig } from "../types";
import arena01 from "./arenas/arena-01.json";

// JSON imports widen tuples to number[]; assert the validated shape via unknown.
// Single source of truth for "which arena is loaded" — Game.tsx and
// ArenaLoader both read this so spawn/bounds/hazards stay in sync.
export const activeArena: ArenaConfig = arena01 as unknown as ArenaConfig;
