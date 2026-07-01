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
 * `loadGltf` pipeline helper and rendered in place of the capsule; otherwise
 * we fall back to the primitive capsule below.
 */

const PLAYER_MODEL_URL = "/models/player.glb";

// Capsule dimensions shared by the visual mesh and the physics collider.
const RADIUS = 0.5;
const HALF_HEIGHT = 0.6; // cylinder half-height (excludes the two caps)

const PITCH_LIMIT = MathUtils.degToRad(85);
/**
 * Scales the drag-to-look pixel offset (already 0..DRAG_MAX_PX from
 * useFlightInput) into a turn rate comparable to raw pointer-lock
 * movementX/Y at full deflection. Tuned so dragging to the clamp edge
 * turns roughly as fast as a brisk pointer-lock mouse swipe.
 */
const DRAG_TURN_SCALE = 12;

// Ticket 3.1b — soft lock-on search parameters.
const LOCK_ON_MAX_RANGE = 50; // meters
const LOCK_ON_CONE_ANGLE = MathUtils.degToRad(25); // half-angle

function CapsuleVisual() {
  return (
    <mesh castShadow position={[0, 0, 0]}>
      <capsuleGeometry args={[RADIUS, HALF_HEIGHT * 2, 8, 16]} />
      <meshStandardMaterial color="#c026d3" roughness={0.4} metalness={0.1} />
    </mesh>
  );
}

function PlayerModel() {
  const { scene } = loadGltf(PLAYER_MODEL_URL);
  return <primitive object={scene} />;
}

function OptionalPlayerModel() {
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

  if (!modelAvailable) return <CapsuleVisual />;

  return (
    <ModelBoundary fallback={<CapsuleVisual />}>
      <Suspense fallback={<CapsuleVisual />}>
        <PlayerModel />
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
 * overlay rather than recoloring the capsule/glb material directly, so it
 * works the same whether the placeholder capsule or a real model is active.
 */
function DamageFlash() {
  const ref = useRef<Mesh>(null);
  const pending = useRef(false);
  const flashStart = useRef(-Infinity);

  useEffect(() => {
    const handler = () => {
      pending.current = true;
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
   * Gameplay flight is only active in "follow" camera mode (see Game.tsx) —
   * keeps pointer-lock mouse-look from fighting OrbitControls/FlyControls
   * when a dev is just inspecting the scene.
   */
  active: boolean;
}

export function Player({ flightState, settings, active }: PlayerProps) {
  const { gl } = useThree();
  const bodyRef = useRef<RapierRigidBody>(null);
  const input = useFlightInput(active ? gl.domElement : null);

  // Scratch objects reused every frame to avoid per-frame GC churn.
  const lookEuler = useMemo(() => new Euler(0, 0, 0, "YXZ"), []);
  const yawEuler = useMemo(() => new Euler(0, 0, 0, "YXZ"), []);
  const yawQuat = useMemo(() => new Quaternion(), []);
  const forward = useMemo(() => new Vector3(), []);
  const right = useMemo(() => new Vector3(), []);
  const desired = useMemo(() => new Vector3(), []);
  const currentVel = useMemo(() => new Vector3(), []);
  const zero = useMemo(() => new Vector3(), []);
  const muzzle = useMemo(() => new Vector3(), []);
  const up = useMemo(() => new Vector3(0, 1, 0), []);

  useFrame((_, dt) => {
    const body = bodyRef.current;
    if (!body) return;

    // Elimination respawn (Ticket 2.4): teleport to the last checkpoint,
    // clear velocity, restore health, and reset suspicion.
    const gs = useGameState.getState();
    playerTracking.alive = gs.health > 0;
    if (gs.health <= 0) {
      const [cx, cy, cz] = gs.checkpoint;
      body.setTranslation({ x: cx, y: cy, z: cz }, true);
      body.setLinvel(zero, true);
      flightState.position.set(cx, cy, cz);
      flightState.velocity.set(0, 0, 0);
      flightState.speed = 0;
      gs.respawn();
      return;
    }

    if (active) {
      telemetry.inputMode = input.locked ? "locked" : input.dragActive ? "drag" : "inactive";

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

      const keys = input.keys;
      const fwdIn = (keys.has("KeyW") ? 1 : 0) - (keys.has("KeyS") ? 1 : 0);
      const strafeIn = (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0);
      const vertIn =
        (keys.has("Space") ? 1 : 0) -
        (keys.has("ControlLeft") || keys.has("ControlRight") ? 1 : 0);
      const boosting = keys.has("ShiftLeft") || keys.has("ShiftRight");

      // Forward thrust follows full look direction (pitch included) — looking
      // up and pressing W flies up, true jetpack flight. Strafe stays flat
      // (yaw-only) so it doesn't tilt with the camera.
      lookEuler.set(flightState.pitch, flightState.yaw, 0);
      forward.set(0, 0, -1).applyEuler(lookEuler);
      yawEuler.set(0, flightState.yaw, 0);
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

      if (input.fire) {
        muzzle.copy(flightState.position).addScaledVector(forward, 1.2).addScaledVector(up, 0.2);
        fireProjectile(muzzle, forward, { covered: isCovered(), targetId: lockOnState.targetId });
        input.fire = false;
      }

      desired.set(0, 0, 0);
      if (fwdIn !== 0) desired.addScaledVector(forward, fwdIn);
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
    } else {
      body.setLinvel(zero, true);
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
      <OptionalPlayerModel />
      <DamageFlash />
    </RigidBody>
  );
}
