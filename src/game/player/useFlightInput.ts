import { useEffect, useRef } from "react";

const TRACKED_KEYS = new Set([
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
  "Space",
  "ShiftLeft",
  "ShiftRight",
  "ControlLeft",
  "ControlRight",
]);

export interface FlightInputState {
  keys: Set<string>;
  /** Accumulated pointer-lock mouse delta since last read; consumer resets to 0. */
  mouseDX: number;
  mouseDY: number;
  /** Left mouse button is held (only updated while pointer lock is active). */
  fire: boolean;
  locked: boolean;
}

/**
 * Keyboard + pointer-lock mouse-look input for the flight controller.
 *
 * Click the target element to engage pointer lock (browser default releases it
 * on Esc). Pass `null` to fully detach — used when gameplay flight is inactive
 * (dev camera modes) so this never fights OrbitControls/FlyControls for the
 * mouse.
 */
export function useFlightInput(domElement: HTMLElement | null): FlightInputState {
  const state = useRef<FlightInputState>({
    keys: new Set(),
    mouseDX: 0,
    mouseDY: 0,
    fire: false,
    locked: false,
  }).current;

  useEffect(() => {
    if (!domElement) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (TRACKED_KEYS.has(e.code)) state.keys.add(e.code);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      state.keys.delete(e.code);
    };
    const onMouseMove = (e: MouseEvent) => {
      if (state.locked) {
        state.mouseDX += e.movementX;
        state.mouseDY += e.movementY;
      }
    };
    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0 && state.locked) state.fire = true;
    };
    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 0) state.fire = false;
    };
    const onClick = () => {
      domElement.requestPointerLock();
    };
    const onLockChange = () => {
      state.locked = document.pointerLockElement === domElement;
      if (!state.locked) state.fire = false;
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);
    domElement.addEventListener("click", onClick);
    document.addEventListener("pointerlockchange", onLockChange);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
      domElement.removeEventListener("click", onClick);
      document.removeEventListener("pointerlockchange", onLockChange);
      state.keys.clear();
      state.fire = false;
      if (document.pointerLockElement === domElement) {
        document.exitPointerLock();
      }
    };
  }, [domElement, state]);

  return state;
}
