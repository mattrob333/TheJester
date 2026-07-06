import { Color, Vector3 } from "three";

/**
 * Module-scoped visual-effects state, following the same pattern as
 * `useWeapon.ts`: spawners are plain functions callable from anywhere in the
 * game loop (projectile impacts, enemy deaths, hazard slams), and a single
 * renderer component (`Effects.tsx`) consumes the lists each frame.
 *
 * All particles render through one additive-blended instanced mesh; "fade
 * out" is achieved by scaling the instance color toward black (with additive
 * blending, black is invisible), so no per-instance opacity is needed.
 */

export interface Particle {
  position: Vector3;
  velocity: Vector3;
  life: number;
  maxLife: number;
  /** World-space radius at full life; shrinks as it fades. */
  size: number;
  color: Color;
  /** Gravity applied to velocity.y, m/s² (negative = falls). */
  gravity: number;
  /** Per-second velocity retention (0.9 = keeps 90% each second). */
  drag: number;
}

export const MAX_PARTICLES = 512;

export const particles: Particle[] = [];

/** Short-lived point-light events (explosions, big muzzle flashes). */
export interface LightFlash {
  position: Vector3;
  color: Color;
  intensity: number;
  life: number;
  maxLife: number;
}

export const lightFlashes: LightFlash[] = [];

/**
 * Camera-shake trauma, 0..1. Systems add trauma on impacts/explosions and
 * the follow camera converts trauma² into positional/rotational noise,
 * decaying it each frame. Squaring makes small bumps subtle and big hits
 * violent.
 */
export const shake = { trauma: 0 };

export function addTrauma(amount: number) {
  shake.trauma = Math.min(1, shake.trauma + amount);
}

/** Clears all live particles/flashes/shake for a fresh run. */
export function resetEffects() {
  particles.length = 0;
  lightFlashes.length = 0;
  shake.trauma = 0;
}

const scratchDir = new Vector3();

function push(p: Particle) {
  if (particles.length >= MAX_PARTICLES) particles.shift();
  particles.push(p);
}

/**
 * Spark burst — projectile impacts, bullet hits on enemies/walls.
 * `dir` biases the burst (e.g. away from the surface); pass null for a
 * uniform sphere burst.
 */
export function spawnSparks(
  position: Vector3,
  dir: Vector3 | null,
  colorHex: number,
  count = 10,
  speed = 7,
) {
  for (let i = 0; i < count; i++) {
    scratchDir
      .set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1)
      .normalize();
    if (dir) scratchDir.addScaledVector(dir, 1.2).normalize();
    const s = speed * (0.35 + Math.random() * 0.65);
    push({
      position: position.clone(),
      velocity: scratchDir.clone().multiplyScalar(s),
      life: 0,
      maxLife: 0.25 + Math.random() * 0.3,
      size: 0.05 + Math.random() * 0.06,
      color: new Color(colorHex),
      gravity: -12,
      drag: 0.12,
    });
  }
}

/**
 * Full explosion — enemy deaths, crusher slams. A hot white core, a shell of
 * colored fragments, lingering smoke-dim embers, plus a point-light flash
 * and a healthy dose of camera shake.
 */
export function spawnExplosion(position: Vector3, colorHex: number, scale = 1) {
  // Hot core — a few large, short-lived, near-white particles.
  for (let i = 0; i < 6; i++) {
    scratchDir
      .set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1)
      .normalize();
    push({
      position: position.clone().addScaledVector(scratchDir, 0.15 * scale),
      velocity: scratchDir.clone().multiplyScalar(1.5 * scale),
      life: 0,
      maxLife: 0.18 + Math.random() * 0.12,
      size: (0.45 + Math.random() * 0.35) * scale,
      color: new Color(0xfff7d6),
      gravity: 0,
      drag: 0.05,
    });
  }
  // Colored fragment shell.
  for (let i = 0; i < 22; i++) {
    scratchDir
      .set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1)
      .normalize();
    const s = (5 + Math.random() * 7) * scale;
    push({
      position: position.clone(),
      velocity: scratchDir.clone().multiplyScalar(s),
      life: 0,
      maxLife: 0.4 + Math.random() * 0.45,
      size: (0.07 + Math.random() * 0.1) * scale,
      color: new Color(colorHex),
      gravity: -9,
      drag: 0.2,
    });
  }
  // Dim lingering embers.
  for (let i = 0; i < 10; i++) {
    scratchDir
      .set(Math.random() * 2 - 1, Math.random() * 1.5, Math.random() * 2 - 1)
      .normalize();
    push({
      position: position.clone(),
      velocity: scratchDir.clone().multiplyScalar(2 * scale),
      life: 0,
      maxLife: 0.8 + Math.random() * 0.6,
      size: (0.05 + Math.random() * 0.05) * scale,
      color: new Color(colorHex).multiplyScalar(0.4),
      gravity: -3,
      drag: 0.5,
    });
  }

  if (lightFlashes.length > 6) lightFlashes.shift();
  lightFlashes.push({
    position: position.clone(),
    color: new Color(colorHex).lerp(new Color(0xffffff), 0.4),
    intensity: 60 * scale,
    life: 0,
    maxLife: 0.35,
  });

  addTrauma(0.45 * Math.min(1.5, scale));
}

/** Small light pop for muzzle flashes (the flash cone itself lives on the gun). */
export function spawnMuzzleLight(position: Vector3, colorHex: number) {
  if (lightFlashes.length > 6) lightFlashes.shift();
  lightFlashes.push({
    position: position.clone(),
    color: new Color(colorHex),
    intensity: 14,
    life: 0,
    maxLife: 0.08,
  });
}
