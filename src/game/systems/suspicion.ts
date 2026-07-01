import { bus } from "./events";
import { coverState } from "./coverState";
import { useGameState } from "./gameState";

/**
 * Ticket 3.3 — the real suspicion model (replaces the Phase 0 placeholder
 * that lived at the bottom of gameState.ts).
 *
 * Kept as its own module (not folded into the zustand store) so the math is
 * testable/readable independent of the store wiring — same rationale as
 * coverState.ts and lockOn.ts. Event-driven, per the architecture: this
 * module subscribes to `bus` events and calls the store's existing
 * `addSuspicion`/`decaySuspicion` actions; nothing calls into this module
 * directly from the firing code.
 */

const BASE_SUSPICION = 12; // per shot, before cover factor + spam surcharge

// --- Cover factor -----------------------------------------------------
// Visible/no-cover -> 1.0, siren -> 0.1, smoke -> 0.15, siren+smoke -> 0.0-0.05,
// out-of-view/hard-cover -> 0.1 (spec'd in DEVELOPMENT_LOG.md 3.3).
const FACTOR_OPEN = 1.0;
const FACTOR_SIREN = 0.1;
const FACTOR_SMOKE = 0.15;
const FACTOR_SIREN_AND_SMOKE = 0.03; // midpoint of the spec'd 0.0-0.05 band
const FACTOR_OUT_OF_VIEW = 0.1;

/**
 * `outOfView` corresponds to the `covered` flag already threaded through
 * `shotFired`/`ProjectileDescriptor` (useWeapon.ts) — it represents "behind
 * hard cover / out of camera view". No system computes a real value for it
 * yet; wiring a real line-of-sight/frustum check is a follow-up ticket, not
 * 3.3's job. The siren/smoke factors below are live today via coverState.ts.
 */
function coverFactor(outOfView: boolean): number {
  const { sirenActive, smokeActive } = coverState;
  if (sirenActive && smokeActive) return FACTOR_SIREN_AND_SMOKE;
  if (sirenActive) return FACTOR_SIREN;
  if (smokeActive) return FACTOR_SMOKE;
  if (outOfView) return FACTOR_OUT_OF_VIEW;
  return FACTOR_OPEN;
}

// --- Spam surcharge -----------------------------------------------------
// Rapid consecutive shots stack a small multiplier (rewards timed,
// deliberate shots over spray-and-pray). Rolling window of recent shot
// timestamps; each shot already inside the window when the new one lands
// adds a bit of surcharge, capped.
const SPAM_WINDOW_MS = 2500;
const SPAM_SURCHARGE_PER_SHOT = 0.2;
const SPAM_SURCHARGE_CAP = 1.0; // max +100% on top of the base multiplier

const recentShotTimes: number[] = [];

function spamSurcharge(now: number): number {
  while (recentShotTimes.length > 0 && now - recentShotTimes[0] > SPAM_WINDOW_MS) {
    recentShotTimes.shift();
  }
  const priorShotsInWindow = recentShotTimes.length;
  recentShotTimes.push(now);
  const surcharge = Math.min(priorShotsInWindow * SPAM_SURCHARGE_PER_SHOT, SPAM_SURCHARGE_CAP);
  return 1 + surcharge;
}

bus.on("shotFired", ({ covered, owner }) => {
  if (owner !== "player") return;
  const now = performance.now();
  const amount = BASE_SUSPICION * coverFactor(covered) * spamSurcharge(now);
  useGameState.getState().addSuspicion(amount);
});

// --- Decay + thresholds ---------------------------------------------------
// Decay runs on an interval rather than every render frame (per spec, this
// doesn't need React's render loop). Faster decay while hidden (siren or
// smoke active) than while fully visible.
//
// Hazard-killed-enemy bonus (spec'd in DEVELOPMENT_LOG.md 3.3, deferred
// until Phase 4 landed real enemies + `enemyKilled` event emission): an
// instant extra decay chunk fires whenever `enemyKilled` reports
// `byHazard: true` — rewards baiting enemies into hazards over shooting
// them, consistent with the stealth-favoring suspicion model. No enemy
// currently sets `byHazard: true` (ArenaGuard/SecurityDrone both always
// emit `false` — neither dies to a hazard collision yet, that's a future
// enemy/hazard-interaction ticket), so this bonus is wired and correct but
// not yet reachable in play; it activates automatically once a hazard-kill
// path exists, no further suspicion.ts changes needed then.
//
// TODO(Phase 7+, product decision needed): "section clears weaponless" bonus
// is NOT implemented — the codebase has no concept of an arena "section"
// (arenas are single flat spaces with sequential beacons/hazards, not
// discrete rooms/sections), so this would require a product/level-design
// decision on what a "section" is before it can be built. Flag via
// course-correction if/when arena design introduces sections.
const DECAY_RATE_VISIBLE = 4; // suspicion points/sec while visible
const DECAY_RATE_HIDDEN = 12; // suspicion points/sec while hidden (siren or smoke)
const DECAY_TICK_MS = 200;
const HAZARD_KILL_DECAY_BONUS = 15; // instant suspicion reduction on a hazard kill

bus.on("enemyKilled", ({ byHazard }) => {
  if (byHazard) {
    useGameState.getState().decaySuspicion(HAZARD_KILL_DECAY_BONUS);
  }
});

const WARNING_THRESHOLD = 60;
const DETECTED_THRESHOLD = 100;

type ThresholdLevel = "none" | "warning" | "detected";
let lastThresholdLevel: ThresholdLevel = "none";
let lastTick = performance.now();

setInterval(() => {
  const now = performance.now();
  const dt = (now - lastTick) / 1000;
  lastTick = now;

  const hidden = coverState.sirenActive || coverState.smokeActive;
  const rate = hidden ? DECAY_RATE_HIDDEN : DECAY_RATE_VISIBLE;
  useGameState.getState().decaySuspicion(rate * dt);

  const suspicion = useGameState.getState().suspicion;

  if (suspicion >= DETECTED_THRESHOLD) {
    if (lastThresholdLevel !== "detected") {
      bus.emit("suspicionThreshold", { level: "detected" });
    }
    lastThresholdLevel = "detected";
  } else if (suspicion >= WARNING_THRESHOLD) {
    if (lastThresholdLevel === "none") {
      bus.emit("suspicionThreshold", { level: "warning" });
    }
    lastThresholdLevel = "warning";
  } else {
    lastThresholdLevel = "none";
  }
}, DECAY_TICK_MS);
