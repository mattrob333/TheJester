import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { RigidBody, CapsuleCollider, type RapierRigidBody } from "@react-three/rapier";
import { Euler, MathUtils, Quaternion, Vector3, type Mesh, type MeshStandardMaterial } from "three";
import { loadGltf } from "../../lib/loadGltf";
import { useFlightInput } from "./useFlightInput";
import type { FlightState } from "./flightState";
import { telemetry } from "../../ui/telemetry";
import { useGameState } from "../systems/gameState";
import { bus } from "../systems/events";
import { isCovered } from "../systems/coverState";
import { fireProjectile } from "../combat/useWeapon";
import { findNearestTarget } from "../combat/targeting";
import { lockOnState } from "../combat/lockOn";
import { playerTracking } from "./playerTracking";
import { registerTarget, unregisterTarget, type Targetable } from "../combat/targets";
import { applyPlayerDamage, grantSpawnShield } from "../systems/playerDamage";
import { addTrauma, spawnMuzzleLight, spawnExplosion } from "../effects/effects";
import { triggerBark } from "../announcer/Announcer";
import { useAppState } from "../systems/appState";
import { activeArena } from "../config/activeArena";
import { JesterModel, createJesterAnim, type JesterAnim } from "./JesterModel";

/**
 * Jetpack flight controller (Ticket 1.1).
 *
 * Custom Rapier rigid-body flight — NOT a grounded controller like `ecctrl`.
 * The body has `gravityScale={0}` and we fully drive its linear velocity each
 * frame from input, so "hover" (no input → stationary) falls out naturally
 * instead of fighting gravity. `lockRotations` stops collisions from tumbling
 * the capsule; we still drive yaw ourselves via `setRotation`.
 *
 * Asset slot: if `public/models/player.glb` exists it is loaded via the
 * `loadGltf` pipeline helper and rendered in place of the built-in procedural
 * Jester character; otherwise `JesterModel` (a fully articulated primitive
 * rig) is the default visual.
 */

const PLAYER_MODEL_URL = "/models/player.glb";

// Capsule dimensions shared by the physics collider and the damage halo.
const RADIUS = 0.5;
const HALF_HEIGHT = 0.6; // cylinder half-height (excludes the two caps)
/** Hit-sphere radius for enemy projectiles (slightly generous — dodging should feel earned, not pixel-perfect). */
const PLAYER_TARGET_RADIUS = 0.8;

const PITCH_LIMIT = MathUtils.degToRad(85);
/**
 * Scales the drag-to-look pixel offset (already 0..DRAG_MAX_PX from
 * useFlightInput) into a turn rate comparable to raw pointer-lock
 * movementX/Y at full deflection. Tuned so dragging to the clamp edge
 * turns roughly as fast as a brisk pointer-lock mouse swipe.
 */
const DRAG_TURN_SCALE = 12;
/**
 * Ticket 6.3 — scales discrete arrow-key input into the same turn-rate
 * space as DRAG_TURN_SCALE above. Arrow keys are a binary -1/0/1 signal
 * (not a 0..DRAG_MAX_PX continuous offset), so this constant is tuned
 * independently for a comfortable full-speed keyboard turn.
 */
const KEY_TURN_SCALE = 2.5;

// Ticket 3.1b — soft lock-on search parameters.
const LOCK_ON_MAX_RANGE = 50; // meters
const LOCK_ON_CONE_ANGLE = MathUtils.degToRad(25); // half-angle

const MUZZLE_FLASH_COLOR = 0xffc93d;
/** How long the death beat lasts before the checkpoint teleport. */
const DEATH_BEAT_SECONDS = 1.3;

function PlayerGlbModel() {
  const { scene } = loadGltf(PLAYER_MODEL_URL);
  return <primitive object={scene} />;
}

function OptionalPlayerModel({ anim }: { anim: JesterAnim }) {
  const [modelAvailable, setModelAvailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetch(PLAYER_MODEL_URL, { method: "HEAD" })
      .then((res) => {
        if (cancelled) return;
        const contentType = res.headers.get("content-type") ?? "";
        setModelAvailable(res.ok && !contentType.includes("text/html"));
      })
      .catch(() => {
        if (!cancelled) setModelAvailable(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!modelAvailable) return <JesterModel anim={anim} />;

  return (
    <ModelBoundary fallback={<JesterModel anim={anim} />}>
      <Suspense fallback={<JesterModel anim={anim} />}>
        <PlayerGlbModel />
      </Suspense>
    </ModelBoundary>
  );
}

/** Falls back to children's fallback if the glb fails to load (e.g. 404). */
class ModelBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

const FLASH_DURATION = 0.25; // seconds

/**
 * "Suit damage" feedback (Ticket 2.3): a translucent red halo around the
 * player that flashes briefly on `playerDamaged`. Implemented as a sibling
 * overlay rather than recoloring the model materials directly, so it works
 * the same whether the procedural Jester or a glb model is active. Also
 * kicks the camera-shake trauma so hits land physically.
 */
function DamageFlash() {
  const ref = useRef<Mesh>(null);
  const pending = useRef(false);
  const flashStart = useRef(-Infinity);

  useEffect(() => {
    const handler = (payload: { amount: number; source: string }) => {
      pending.current = true;
      telemetry.lastDamageSource = payload.source;
      addTrauma(Math.min(0.6, 0.15 + payload.amount * 0.012));
    };
    bus.on("playerDamaged", handler);
    return () => bus.off("playerDamaged", handler);
  }, []);

  useFrame((state) => {
    const now = state.clock.elapsedTime;
    if (pending.current) {
      pending.current = false;
      flashStart.current = now;
    }
    if (!ref.current) return;
    const mat = ref.current.material as MeshStandardMaterial;
    const elapsed = now - flashStart.current;
    mat.opacity = elapsed < FLASH_DURATION ? 0.6 * (1 - elapsed / FLASH_DURATION) : 0;
  });

  return (
    <mesh ref={ref} scale={1.25}>
      <capsuleGeometry args={[RADIUS, HALF_HEIGHT * 2, 8, 16]} />
      <meshStandardMaterial
        color="#ef4444"
        emissive="#ef4444"
        emissiveIntensity={2}
        transparent
        opacity={0}
        depthWrite={false}
      />
    </mesh>
  );
}

export interface FlightSettings {
  /** Top horizontal/vertical speed, m/s. */
  maxSpeed: number;
  /** Boost multiplier applied to maxSpeed while Shift is held. */
  boostMultiplier: number;
  /** Exponential approach rate toward desired velocity — higher = snappier, more "thrust". */
  acceleration: number;
  /** Pointer-lock mouse-look sensitivity (radians per pixel of movement). */
  mouseSensitivity: number;
}

interface PlayerProps {
  flightState: FlightState;
  settings: FlightSettings;
  /**
   * Gameplay flight is only active in "follow" camera mode while the app is
   * in the "playing" phase (see Game.tsx) — keeps pointer-lock mouse-look
   * from fighting the title screen and the dev cameras.
   */
  active: boolean;
}

export function Player({ flightState, settings, active }: PlayerProps) {
  const { gl } = useThree();
  const bodyRef = useRef<RapierRigidBody>(null);
  const input = useFlightInput(active ? gl.domElement : null);
  const anim = useMemo(() => createJesterAnim(), []);
  /** Clock time the current death beat started, or null while alive. */
  const deathAt = useRef<number | null>(null);
  const runId = useAppState((s) => s.runId);

  // New run → teleport the physics body back to spawn (the RigidBody's
  // position prop only applies at mount, and the player isn't remounted
  // between runs — only the arena is).
  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    const [sx, sy, sz] = activeArena.spawn;
    body.setTranslation({ x: sx, y: sy, z: sz }, true);
    body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    deathAt.current = null;
    grantSpawnShield();
  }, [runId]);

  // Enemy projectiles need something to hit — register the player in the
  // shared target registry. `flightState.position` is the live per-frame
  // Vector3, so the registry entry tracks automatically.
  useEffect(() => {
    const playerTarget: Targetable = {
      id: "player",
      position: flightState.position,
      radius: PLAYER_TARGET_RADIUS,
      owner: "player",
      onHit: (damage) => {
        applyPlayerDamage(damage, "drone-laser");
      },
    };
    registerTarget(playerTarget);
    return () => unregisterTarget(playerTarget);
  }, [flightState]);

  // Scratch objects reused every frame to avoid per-frame GC churn.
  const lookEuler = useMemo(() => new Euler(0, 0, 0, "YXZ"), []);
  const yawEuler = useMemo(() => new Euler(0, 0, 0, "YXZ"), []);
  const yawQuat = useMemo(() => new Quaternion(), []);
  const forward = useMemo(() => new Vector3(), []);
  const moveForward = useMemo(() => new Vector3(), []);
  const right = useMemo(() => new Vector3(), []);
  const desired = useMemo(() => new Vector3(), []);
  const currentVel = useMemo(() => new Vector3(), []);
  const zero = useMemo(() => new Vector3(), []);
  const muzzle = useMemo(() => new Vector3(), []);
  const up = useMemo(() => new Vector3(0, 1, 0), []);

  useFrame((frame, dt) => {
    const body = bodyRef.current;
    if (!body) return;

    // Death ceremony (Ticket 2.4 respawn + review §4 "death has no weight"):
    // health hitting 0 starts a short death beat — explosion, bark, screen
    // fade (DeathOverlay listens for `playerDied`), frozen in place — THEN
    // the checkpoint teleport. Dying also keeps half your suspicion now, so
    // stealth failures carry forward instead of death being a free wipe.
    const gs = useGameState.getState();
    if (gs.health <= 0 && deathAt.current === null) {
      deathAt.current = frame.clock.elapsedTime;
      playerTracking.alive = false;
      body.setLinvel(zero, true);
      bus.emit("playerDied", {});
      triggerBark("death");
      spawnExplosion(flightState.position, 0xc026d3, 0.9);
    }
    if (deathAt.current !== null) {
      playerTracking.alive = false;
      body.setLinvel(zero, true);
      flightState.velocity.set(0, 0, 0);
      flightState.speed = 0;
      if (frame.clock.elapsedTime - deathAt.current >= DEATH_BEAT_SECONDS) {
        const [cx, cy, cz] = gs.checkpoint;
        body.setTranslation({ x: cx, y: cy, z: cz }, true);
        flightState.position.set(cx, cy, cz);
        gs.respawn();
        grantSpawnShield();
        deathAt.current = null;
      }
      return;
    }
    playerTracking.alive = true;

    if (active) {
      telemetry.inputMode = input.locked ? "locked" : input.dragActive ? "drag" : "inactive";
      telemetry.keyboardTurnMode = input.keyboardTurnMode;

      flightState.yaw -= input.mouseDX * settings.mouseSensitivity;
      flightState.pitch = MathUtils.clamp(
        flightState.pitch - input.mouseDY * settings.mouseSensitivity,
        -PITCH_LIMIT,
        PITCH_LIMIT,
      );
      input.mouseDX = 0;
      input.mouseDY = 0;

      // Drag-to-look fallback (pointer lock denied/unavailable): the input
      // hook reports a continuous, screen-edge-independent offset from the
      // drag origin rather than raw per-event movement, so apply it here as
      // a per-frame turn rate (scaled by dt) instead of a one-shot delta —
      // this is what lets the player keep turning 360 degrees in either
      // direction even though the OS cursor itself is pinned near the
      // screen edge.
      if (input.dragActive && (input.dragTurnX !== 0 || input.dragTurnY !== 0)) {
        const dragTurnRate = settings.mouseSensitivity * DRAG_TURN_SCALE;
        flightState.yaw -= input.dragTurnX * dragTurnRate * dt;
        flightState.pitch = MathUtils.clamp(
          flightState.pitch - input.dragTurnY * dragTurnRate * dt,
          -PITCH_LIMIT,
          PITCH_LIMIT,
        );
      }

      // Ticket 6.3 — explicit keyboard-turn control mode (toggled via T,
      // see useFlightInput.ts). A genuine accessibility option: unlike the
      // drag-to-look fallback above (which only engages automatically when
      // pointer lock is unavailable), this is player-chosen and works
      // regardless of pointer-lock state, so a non-mouse-look-comfortable
      // player can turn/look entirely with the keyboard.
      if (input.keyboardTurnMode) {
        const turnX = (input.keys.has("ArrowRight") ? 1 : 0) - (input.keys.has("ArrowLeft") ? 1 : 0);
        const turnY = (input.keys.has("ArrowDown") ? 1 : 0) - (input.keys.has("ArrowUp") ? 1 : 0);
        if (turnX !== 0 || turnY !== 0) {
          const keyTurnRate = settings.mouseSensitivity * KEY_TURN_SCALE;
          flightState.yaw -= turnX * keyTurnRate * dt;
          flightState.pitch = MathUtils.clamp(
            flightState.pitch - turnY * keyTurnRate * dt,
            -PITCH_LIMIT,
            PITCH_LIMIT,
          );
        }
      }

      const keys = input.keys;
      const fwdIn = (keys.has("KeyW") ? 1 : 0) - (keys.has("KeyS") ? 1 : 0);
      const strafeIn = (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0);
      const vertIn =
        (keys.has("Space") ? 1 : 0) -
        (keys.has("ControlLeft") || keys.has("ControlRight") ? 1 : 0);
      const boosting = keys.has("ShiftLeft") || keys.has("ShiftRight");

      // Aim uses pitch, but WASD movement stays horizontal. Space/Ctrl are
      // the vertical controls, which keeps backing up from climbing/diving.
      lookEuler.set(flightState.pitch, flightState.yaw, 0);
      forward.set(0, 0, -1).applyEuler(lookEuler);
      yawEuler.set(0, flightState.yaw, 0);
      moveForward.set(0, 0, -1).applyEuler(yawEuler);
      right.set(1, 0, 0).applyEuler(yawEuler);

      // Ticket 3.1b — soft lock-on: re-acquire the nearest valid target in
      // front of the player every frame, regardless of fire state, so the
      // lock-on indicator updates live even before the player shoots.
      const lockedTarget = findNearestTarget(flightState.position, forward, {
        maxRange: LOCK_ON_MAX_RANGE,
        coneAngle: LOCK_ON_CONE_ANGLE,
        excludeOwner: "player",
      });
      lockOnState.targetId = lockedTarget?.id ?? null;

      // Hold-to-fire: `fire` is the one-shot click edge, `fireHeld` streams
      // shots while the trigger stays down (cooldown-gated in useWeapon).
      if (input.fire || input.fireHeld) {
        muzzle.copy(flightState.position).addScaledVector(forward, 1.2).addScaledVector(up, 0.2);
        const fired = fireProjectile(muzzle, forward, {
          covered: isCovered(),
          targetId: lockOnState.targetId,
        });
        if (fired) {
          anim.lastFireAt = frame.clock.elapsedTime;
          spawnMuzzleLight(muzzle, MUZZLE_FLASH_COLOR);
        }
        input.fire = false;
      }

      desired.set(0, 0, 0);
      if (fwdIn !== 0) desired.addScaledVector(moveForward, fwdIn);
      if (strafeIn !== 0) desired.addScaledVector(right, strafeIn);
      if (desired.lengthSq() > 1) desired.normalize();
      desired.y += vertIn;
      if (desired.lengthSq() > 1) desired.normalize();

      const topSpeed = settings.maxSpeed * (boosting ? settings.boostMultiplier : 1);
      desired.multiplyScalar(topSpeed);

      // Exponential smoothing toward desired velocity — frame-rate independent.
      const t = 1 - Math.exp(-settings.acceleration * dt);
      const lv = body.linvel();
      currentVel.set(lv.x, lv.y, lv.z).lerp(desired, t);

      body.setLinvel(currentVel, true);
      body.setRotation(yawQuat.setFromEuler(yawEuler), true);

      // Feed the character rig: local-space velocity (for banking/leaning),
      // thrust fraction (flame length), boost, and aim pitch.
      anim.localVel.copy(currentVel).applyAxisAngle(up, -flightState.yaw);
      anim.thrust = MathUtils.clamp(
        currentVel.length() / (settings.maxSpeed * settings.boostMultiplier),
        0,
        1,
      );
      anim.boosting = boosting && currentVel.lengthSq() > 1;
      anim.pitch = flightState.pitch;
      flightState.boosting = anim.boosting;
    } else {
      body.setLinvel(zero, true);
      anim.localVel.set(0, 0, 0);
      anim.thrust = 0;
      anim.boosting = false;
      flightState.boosting = false;
    }

    const p = body.translation();
    flightState.position.set(p.x, p.y, p.z);
    playerTracking.position.set(p.x, p.y, p.z);
    const v = body.linvel();
    flightState.velocity.set(v.x, v.y, v.z);
    flightState.speed = flightState.velocity.length();
    telemetry.speed = flightState.speed;
  });

  return (
    <RigidBody
      ref={bodyRef}
      type="dynamic"
      colliders={false}
      position={[flightState.position.x, flightState.position.y, flightState.position.z]}
      gravityScale={0}
      lockRotations
      linearDamping={0}
      angularDamping={1}
    >
      <CapsuleCollider args={[HALF_HEIGHT, RADIUS]} />
      <OptionalPlayerModel anim={anim} />
      <DamageFlash />
    </RigidBody>
  );
}
