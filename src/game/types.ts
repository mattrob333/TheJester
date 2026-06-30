export type Vec3 = [number, number, number];

export interface RazorHazardConfig {
  type: "razor";
  pos: Vec3;
  /** Blade rotations per minute — visual spin speed. */
  rpm: number;
  /** Whether this hazard is wired to the siren cover state (Phase 3). */
  siren?: boolean;
}

export interface CrusherHazardConfig {
  type: "crusher";
  pos: Vec3;
  /** Seconds per full idle→warning→crush→idle cycle. */
  interval: number;
}

export interface LaserHazardConfig {
  type: "laser";
  pos: Vec3;
  /** Horizontal axis the beam extends along. */
  axis: "x" | "z";
  /** Beam length in meters. */
  length: number;
  /** Seconds per full idle→charge→fire→idle cycle. */
  interval: number;
}

export type HazardConfig = RazorHazardConfig | CrusherHazardConfig | LaserHazardConfig;

/** Phase 3.2 — cover zone. Parsed now, rendered/used once cover states land. */
export interface SmokeZoneConfig {
  pos: Vec3;
  radius: number;
}

/** Static arena bounds, centered at the world origin. */
export interface ArenaBounds {
  width: number;
  height: number;
  depth: number;
}

/**
 * Data-driven arena description. Loaded from JSON (see config/arenas/*.json).
 */
export interface ArenaConfig {
  id: string;
  name: string;
  spawn: Vec3;
  exit: Vec3;
  checkpoints: Vec3[];
  bounds: ArenaBounds;
  hazards: HazardConfig[];
  /** Phase 3.2 — parsed but not yet rendered. */
  smokeZones: SmokeZoneConfig[];
  /** Phase 4 — enemy spawn descriptors. */
  enemies: unknown[];
  announcer: {
    intro: string;
    /** Map of event key -> announcer bark id. Phase 5. */
    events: Record<string, string>;
  };
}
