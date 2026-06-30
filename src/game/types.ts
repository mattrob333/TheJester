export type Vec3 = [number, number, number];

/**
 * Data-driven arena description. Loaded from JSON (see config/arenas/*.json).
 *
 * Only `spawn`/`exit`/`checkpoints` are consumed by the Phase 0 loader stub.
 * `hazards`, `smokeZones`, `enemies`, and `announcer.events` are reserved for
 * later phases and currently parsed but not spawned.
 */
export interface ArenaConfig {
  id: string;
  name: string;
  spawn: Vec3;
  exit: Vec3;
  checkpoints: Vec3[];
  /** Phase 2 — left empty for now. Shape intentionally loose until 2.x. */
  hazards: unknown[];
  /** Phase 2 — smoke/cover zones. */
  smokeZones: unknown[];
  /** Phase 4 — enemy spawn descriptors. */
  enemies: unknown[];
  announcer: {
    intro: string;
    /** Map of event key -> announcer bark id. Phase 5. */
    events: Record<string, string>;
  };
}
