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
}

export function createFlightState(spawn: [number, number, number] = [0, 2, 0]): FlightState {
  return {
    position: new Vector3(...spawn),
    velocity: new Vector3(),
    yaw: 0,
    pitch: 0,
    speed: 0,
  };
}
