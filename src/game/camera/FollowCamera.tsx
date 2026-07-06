import { useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useRapier } from "@react-three/rapier";
import { Euler, MathUtils, Vector3, type PerspectiveCamera } from "three";
import type { FlightState } from "../player/flightState";
import { shake } from "../effects/effects";

const DISTANCE = 6;
const HEIGHT = 1.8;
const EYE_HEIGHT = 1.1;
/** How much look-pitch tilts the camera (vs. a fixed over-the-shoulder angle) — keeps extreme up/down looks from flipping the view. */
const PITCH_INFLUENCE = 0.5;
const MIN_DISTANCE = 1.5;
/** Pull the camera in this much short of a wall hit so it never clips through. */
const SKIN = 0.3;
const POSITION_SMOOTH = 8;
const LOOK_SMOOTH = 10;

const BASE_FOV = 55;
/** FOV widens with speed and kicks hard on boost — classic speed feel. */
const SPEED_FOV_GAIN = 8;
const BOOST_FOV_KICK = 8;
const FOV_SMOOTH = 6;

/** How fast camera-shake trauma bleeds off, per second. */
const TRAUMA_DECAY = 1.7;
const SHAKE_MAX_OFFSET = 0.35;
const SHAKE_MAX_ROLL = 0.05;

/**
 * Third-person follow camera (Ticket 1.2).
 *
 * Reads `state.position/yaw/pitch` — written every frame by the flight
 * controller — rather than driving the player directly, keeping camera and
 * movement fully decoupled. Raycasts from the player toward the desired
 * camera position each frame and pulls the camera in if it would clip through
 * level geometry.
 *
 * Juice layer: FOV stretches with speed/boost, and impacts feed a trauma
 * value (effects.ts) converted here into decaying positional + roll shake —
 * squared so small bumps stay subtle and big hits feel violent.
 */
export function FollowCamera({ state }: { state: FlightState }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const { world, rapier } = useRapier();

  const desiredPos = useMemo(() => new Vector3(), []);
  const origin = useMemo(() => new Vector3(), []);
  const eyeOffset = useMemo(() => new Vector3(0, EYE_HEIGHT, 0), []);
  const dir = useMemo(() => new Vector3(), []);
  const offset = useMemo(() => new Vector3(), []);
  const lookTarget = useMemo(() => new Vector3(), []);
  const currentLook = useMemo(() => state.position.clone().add(eyeOffset), [state, eyeOffset]);
  const euler = useMemo(() => new Euler(0, 0, 0, "YXZ"), []);
  // One reusable ray — the previous `new rapier.Ray(...)` per frame was the
  // lone GC leak in an otherwise allocation-free loop (code-review §2.6).
  const ray = useMemo(() => new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }), [rapier]);

  useFrame(({ clock }, dt) => {
    euler.set(state.pitch * PITCH_INFLUENCE, state.yaw, 0);
    offset.set(0, HEIGHT, DISTANCE).applyEuler(euler);
    desiredPos.copy(state.position).add(offset);

    origin.copy(state.position).add(eyeOffset);
    dir.copy(desiredPos).sub(origin);
    const dist = dir.length();

    if (dist > 1e-4) {
      dir.normalize();
      ray.origin.x = origin.x;
      ray.origin.y = origin.y;
      ray.origin.z = origin.z;
      ray.dir.x = dir.x;
      ray.dir.y = dir.y;
      ray.dir.z = dir.z;
      // solid=false: a ray starting inside the player's own collider won't
      // register a false hit against it, only against geometry it actually
      // crosses. EXCLUDE_SENSORS: checkpoint/hazard/beacon trigger volumes
      // must never yank the camera in — only real walls should.
      const hit = world.castRay(ray, dist, false, rapier.QueryFilterFlags.EXCLUDE_SENSORS);
      if (hit) {
        const allowed = Math.max(MIN_DISTANCE, hit.timeOfImpact - SKIN);
        desiredPos.copy(origin).addScaledVector(dir, allowed);
      }
    }

    const posT = 1 - Math.exp(-POSITION_SMOOTH * dt);
    camera.position.lerp(desiredPos, posT);

    lookTarget.copy(state.position).add(eyeOffset);
    const lookT = 1 - Math.exp(-LOOK_SMOOTH * dt);
    currentLook.lerp(lookTarget, lookT);
    camera.lookAt(currentLook);

    // --- shake (after lookAt so it perturbs the final orientation) ---
    shake.trauma = Math.max(0, shake.trauma - TRAUMA_DECAY * dt);
    const s = shake.trauma * shake.trauma;
    if (s > 1e-4) {
      const t = clock.elapsedTime;
      // Cheap layered-sine noise — decorrelated per axis, no allocation.
      const nx = Math.sin(t * 39.7) * 0.6 + Math.sin(t * 71.3 + 2.1) * 0.4;
      const ny = Math.sin(t * 47.1 + 1.3) * 0.6 + Math.sin(t * 63.9 + 4.2) * 0.4;
      const nr = Math.sin(t * 53.7 + 3.1) * 0.6 + Math.sin(t * 79.3 + 0.7) * 0.4;
      camera.position.x += nx * s * SHAKE_MAX_OFFSET;
      camera.position.y += ny * s * SHAKE_MAX_OFFSET;
      camera.rotation.z += nr * s * SHAKE_MAX_ROLL;
    }

    // --- speed/boost FOV ---
    const speedFrac = MathUtils.clamp(state.speed / 22, 0, 1);
    const targetFov =
      BASE_FOV + speedFrac * SPEED_FOV_GAIN + (state.boosting ? BOOST_FOV_KICK : 0);
    const fovT = 1 - Math.exp(-FOV_SMOOTH * dt);
    const nextFov = camera.fov + (targetFov - camera.fov) * fovT;
    if (Math.abs(nextFov - camera.fov) > 1e-3) {
      camera.fov = nextFov;
      camera.updateProjectionMatrix();
    }
  });

  return null;
}
