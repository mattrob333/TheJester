import { useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useRapier } from "@react-three/rapier";
import { Euler, Vector3 } from "three";
import type { FlightState } from "../player/flightState";

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

/**
 * Third-person follow camera (Ticket 1.2).
 *
 * Reads `state.position/yaw/pitch` — written every frame by the flight
 * controller — rather than driving the player directly, keeping camera and
 * movement fully decoupled. Raycasts from the player toward the desired
 * camera position each frame and pulls the camera in if it would clip through
 * level geometry.
 */
export function FollowCamera({ state }: { state: FlightState }) {
  const { camera } = useThree();
  const { world, rapier } = useRapier();

  const desiredPos = useMemo(() => new Vector3(), []);
  const origin = useMemo(() => new Vector3(), []);
  const eyeOffset = useMemo(() => new Vector3(0, EYE_HEIGHT, 0), []);
  const dir = useMemo(() => new Vector3(), []);
  const offset = useMemo(() => new Vector3(), []);
  const lookTarget = useMemo(() => new Vector3(), []);
  const currentLook = useMemo(() => state.position.clone().add(eyeOffset), [state, eyeOffset]);
  const euler = useMemo(() => new Euler(0, 0, 0, "YXZ"), []);

  useFrame((_, dt) => {
    euler.set(state.pitch * PITCH_INFLUENCE, state.yaw, 0);
    offset.set(0, HEIGHT, DISTANCE).applyEuler(euler);
    desiredPos.copy(state.position).add(offset);

    origin.copy(state.position).add(eyeOffset);
    dir.copy(desiredPos).sub(origin);
    const dist = dir.length();

    if (dist > 1e-4) {
      dir.normalize();
      const ray = new rapier.Ray(origin, dir);
      // solid=false: a ray starting inside the player's own collider won't
      // register a false hit against it, only against geometry it actually crosses.
      const hit = world.castRay(ray, dist, false);
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
  });

  return null;
}
