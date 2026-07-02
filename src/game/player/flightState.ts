import { Vector3 } from "three";

/**
 * Per-frame flight data shared between the flight controller and the follow
 * camera. Plain mutable object (not zustand) — this changes every frame and
 * has no business triggering React re-renders; see `ui/telemetry.ts` for the
 * same pattern.
 */
export interface FlightState {
  position: Vector3;
  velocity: Vector3;
  /** Radians. Yaw rotates around world Y; pitch is clamped, no roll. */
  yaw: number;
  pitch: number;
  /** Current speed magnitude — handy for HUD/debug readouts. */
  speed: number;
  /** True while boost is engaged AND the player is actually moving — drives the camera FOV kick + HUD indicator. */
  boosting: boolean;
}

export function createFlightState(
  spawn: [number, number, number] = [0, 2, 0],
  /** Initial facing. Default -π/2 = looking down +X, the arena's long axis toward the exit. */
  yaw = -Math.PI / 2,
): FlightState {
  return {
    position: new Vector3(...spawn),
    velocity: new Vector3(),
    yaw,
    pitch: 0,
    speed: 0,
    boosting: false,
  };
}
