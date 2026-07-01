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
  /** Accumulated mouse-look delta since last read; consumer resets to 0. */
  mouseDX: number;
  mouseDY: number;
  /** One queued left-click shot request for the gameplay loop to consume. */
  fire: boolean;
  locked: boolean;
  /** Browser fallback when pointer lock is denied or unavailable. */
  cursorLook: boolean;
}

/**
 * Keyboard + mouse-look input for the flight controller.
 *
 * Click the target element to engage pointer lock. If pointer lock is denied,
 * mouse movement over the canvas still turns the camera so embedded browsers
 * remain playable.
 */
export function useFlightInput(domElement: HTMLElement | null): FlightInputState {
  const state = useRef<FlightInputState>({
    keys: new Set(),
    mouseDX: 0,
    mouseDY: 0,
    fire: false,
    locked: false,
    cursorLook: false,
  }).current;

  useEffect(() => {
    if (!domElement) return;

    const isInsideCanvas = (e: MouseEvent) => {
      const rect = domElement.getBoundingClientRect();
      return (
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom
      );
    };
    const isGameplayMouseEvent = (e: MouseEvent) =>
      state.locked || e.target === domElement || isInsideCanvas(e);

    const onKeyDown = (e: KeyboardEvent) => {
      if (TRACKED_KEYS.has(e.code)) state.keys.add(e.code);
      if (e.code === "Escape" && !state.locked) {
        state.cursorLook = false;
        state.fire = false;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      state.keys.delete(e.code);
    };
    const onMouseMove = (e: MouseEvent) => {
      if (state.locked || (state.cursorLook && isInsideCanvas(e))) {
        state.mouseDX += e.movementX;
        state.mouseDY += e.movementY;
      }
    };
    const onMouseDown = (e: MouseEvent) => {
      if (!isGameplayMouseEvent(e)) return;
      if (e.button === 0) {
        e.preventDefault();
        state.fire = true;
        state.cursorLook = true;
      }
      if (e.button === 2) {
        e.preventDefault();
        state.cursorLook = true;
      }
    };
    const onClick = (e: MouseEvent) => {
      if (!isGameplayMouseEvent(e)) return;
      state.cursorLook = true;
      try {
        const maybeLock = domElement.requestPointerLock() as Promise<void> | void;
        if (maybeLock) maybeLock.catch(() => (state.cursorLook = true));
      } catch {
        state.cursorLook = true;
      }
    };
    const onLockChange = () => {
      state.locked = document.pointerLockElement === domElement;
      state.cursorLook = state.locked || state.cursorLook;
      if (!state.locked) state.fire = false;
    };
    const onLockError = () => {
      state.locked = false;
      state.cursorLook = true;
    };
    const onContextMenu = (e: MouseEvent) => {
      if (!isGameplayMouseEvent(e)) return;
      e.preventDefault();
    };
    const onBlur = () => {
      state.keys.clear();
      state.fire = false;
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mousedown", onMouseDown);
    domElement.addEventListener("click", onClick);
    domElement.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("pointerlockchange", onLockChange);
    document.addEventListener("pointerlockerror", onLockError);
    window.addEventListener("blur", onBlur);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mousedown", onMouseDown);
      domElement.removeEventListener("click", onClick);
      domElement.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("pointerlockchange", onLockChange);
      document.removeEventListener("pointerlockerror", onLockError);
      window.removeEventListener("blur", onBlur);
      state.keys.clear();
      state.fire = false;
      state.cursorLook = false;
      if (document.pointerLockElement === domElement) {
        document.exitPointerLock();
      }
    };
  }, [domElement, state]);

  return state;
}
