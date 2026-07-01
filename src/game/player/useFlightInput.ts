import { useEffect, useRef } from "react";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

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
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
]);

/** Max drag offset (px) from the origin click before turn rate saturates. */
const DRAG_MAX_PX = 160;

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
  /**
   * True while the player is holding the mouse down in drag-to-look mode
   * (pointer lock unavailable/denied). Distinct from `cursorLook`, which
   * only means "pointer lock isn't active" — `dragActive` means the
   * continuous drag-turn signal below is live and should be applied every
   * frame, not just while the OS cursor is physically moving.
   */
  dragActive: boolean;
  /**
   * Signed pixel offset from the drag origin, clamped to
   * +/-DRAG_MAX_PX. Consumer multiplies by a turn-rate constant and `dt`
   * every frame (continuous, NOT reset to 0 after read) so turning keeps
   * going even once the OS cursor has hit the screen edge — this is the
   * fix for "cursor fallback can't turn past the edge of the screen."
   */
  dragTurnX: number;
  dragTurnY: number;
  /**
   * Ticket 6.3 — explicit, exposed control-mode toggle (T key). When true,
   * ArrowLeft/ArrowRight/ArrowUp/ArrowDown drive a continuous turn rate
   * every frame, exactly like `dragTurnX`/`dragTurnY` above but sourced
   * from discrete key state rather than mouse position. This is a genuine
   * accessibility option for players uncomfortable with mouse-look (FPS
   * pointer-lock or drag-to-look both require a mouse) — distinct from the
   * automatic drag-to-look FALLBACK shipped in 6.2, which only activates
   * when pointer lock is denied/unavailable. Keyboard-turn mode can be
   * toggled on/off regardless of pointer-lock state.
   */
  keyboardTurnMode: boolean;
}

/**
 * Keyboard + mouse-look input for the flight controller.
 *
 * Click the target element to engage pointer lock (the normal desktop/browser
 * path). If pointer lock is denied or unavailable (embedded/in-app browsers),
 * mouse-DOWN-and-drag over the canvas turns the camera continuously based on
 * drag offset from the origin click point, not raw cursor movement — so
 * turning is unbounded even though the OS cursor itself is confined to the
 * screen. Release to stop turning; click again to set a fresh origin
 * (re-click recapture).
 */
export function useFlightInput(domElement: HTMLElement | null): FlightInputState {
  const state = useRef<FlightInputState>({
    keys: new Set(),
    mouseDX: 0,
    mouseDY: 0,
    fire: false,
    locked: false,
    cursorLook: false,
    dragActive: false,
    dragTurnX: 0,
    dragTurnY: 0,
    keyboardTurnMode: false,
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

    // Drag-to-look origin, tracked in module-local closure state (not on the
    // returned FlightInputState — it's an internal detail of this fallback).
    let dragOriginX = 0;
    let dragOriginY = 0;

    const onKeyDown = (e: KeyboardEvent) => {
      if (TRACKED_KEYS.has(e.code)) state.keys.add(e.code);
      if (e.code === "KeyT") {
        state.keyboardTurnMode = !state.keyboardTurnMode;
      }
      if (e.code === "Escape" && !state.locked) {
        state.cursorLook = false;
        state.fire = false;
        state.dragActive = false;
        state.dragTurnX = 0;
        state.dragTurnY = 0;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      state.keys.delete(e.code);
    };
    const onMouseMove = (e: MouseEvent) => {
      if (state.locked) {
        state.mouseDX += e.movementX;
        state.mouseDY += e.movementY;
        return;
      }
      if (state.dragActive) {
        // Continuous offset-from-origin, clamped — NOT raw movementX/Y.
        // This is what allows turning to keep going even once the OS
        // cursor has physically hit the edge of the screen: the offset
        // saturates at DRAG_MAX_PX rather than the cursor running out of
        // room to move further.
        const dx = e.clientX - dragOriginX;
        const dy = e.clientY - dragOriginY;
        state.dragTurnX = clamp(dx, -DRAG_MAX_PX, DRAG_MAX_PX);
        state.dragTurnY = clamp(dy, -DRAG_MAX_PX, DRAG_MAX_PX);
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
      if (!state.locked && (e.button === 0 || e.button === 2)) {
        dragOriginX = e.clientX;
        dragOriginY = e.clientY;
        state.dragActive = true;
        state.dragTurnX = 0;
        state.dragTurnY = 0;
      }
    };
    const onMouseUp = () => {
      state.dragActive = false;
      state.dragTurnX = 0;
      state.dragTurnY = 0;
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
      if (state.locked) {
        state.dragActive = false;
        state.dragTurnX = 0;
        state.dragTurnY = 0;
      }
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
      state.dragActive = false;
      state.dragTurnX = 0;
      state.dragTurnY = 0;
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);
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
      window.removeEventListener("mouseup", onMouseUp);
      domElement.removeEventListener("click", onClick);
      domElement.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("pointerlockchange", onLockChange);
      document.removeEventListener("pointerlockerror", onLockError);
      window.removeEventListener("blur", onBlur);
      state.keys.clear();
      state.fire = false;
      state.cursorLook = false;
      state.dragActive = false;
      state.dragTurnX = 0;
      state.dragTurnY = 0;
      if (document.pointerLockElement === domElement) {
        document.exitPointerLock();
      }
    };
  }, [domElement, state]);

  return state;
}
