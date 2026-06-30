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

/** Phase 3.1 — target dummy for proving projectiles/hit detection. */
export interface TargetDummyConfig {
  pos: Vec3;
  radius: number;
}

/** Phase 4.1 — patrolling melee enemy. */
export interface ArenaGuardConfig {
  type: "arena-guard";
  pos: Vec3;
  /** Half-distance the guard patrols back and forth along the X axis from `pos`. */
  patrolRadius: number;
  health: number;
}

/** Phase 4.2 — stationary flying enemy that fires lasers and watches for unsafe shots. */
export interface SecurityDroneConfig {
  type: "security-drone";
  pos: Vec3;
  /** Max distance (meters) at which the drone can see and fire at the player. */
  sightRange: number;
  health: number;
}

export type EnemyConfig = ArenaGuardConfig | SecurityDroneConfig;

/**
 * Ticket 6.1 — tutorial beacon. A one-shot sensor zone placed along the
 * orientation arena's teaching path; entering it plays the given announcer
 * bark id once (no pop-up text per the spec — everything is taught through
 * the announcer + level layout). Generic and reusable: any arena can place
 * these, not just arena-01.
 */
export interface TutorialBeaconConfig {
  pos: Vec3;
  /** Bark id resolved via lines.json (story-tier-aware), played once on entry. */
  barkId: string;
  radius: number;
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
  /** Phase 3.1 — target dummies for combat verification. */
  dummies: TargetDummyConfig[];
  /** Phase 4 — enemy spawn descriptors. */
  enemies: EnemyConfig[];
  /** Ticket 6.1 — one-shot announcer triggers along the teaching path. */
  tutorialBeacons: TutorialBeaconConfig[];
  announcer: {
    intro: string;
    /** Map of event key -> announcer bark id. Phase 5. */
    events: Record<string, string>;
  };
}
