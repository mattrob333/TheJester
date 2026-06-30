import { bus } from "./events";

/**
 * Ticket 3.2 — cover state.
 *
 * Design decision (per DEVELOPMENT_LOG.md 3.2 notes): siren is modeled as a
 * source-registry feeding ONE global `sirenActive` boolean, not a per-hazard
 * flag read directly by the suspicion system. The config schema marks siren
 * as a property of an individual hazard (`RazorHazardConfig.siren?: boolean`)
 * because that's how level designers author it — "this hazard's alarm is
 * on" — but 3.3's suspicion model wants a single global cover multiplier
 * ("is *a* siren going off anywhere in the arena right now"). The registry
 * pattern reconciles both: any number of hazards can register as siren
 * sources (keyed by their own id) and report their own active/inactive
 * state every frame (or once on mount, for always-armed hazards like the
 * razor); the global flag is true iff at least one source is currently
 * active. Smoke zones use the identical pattern for the same reason — a
 * single global "am I in cover" flag is what 3.3 needs to multiply against,
 * regardless of how many smoke zones exist or overlap.
 *
 * Kept as its own small module (not folded into gameState.ts) because, like
 * flightState.ts and lockOn.ts, this is high-frequency/transient data with
 * no business living in zustand or triggering React re-renders on every
 * hazard tick — only the *transition* edges matter for the bus event.
 */
export interface CoverState {
  sirenActive: boolean;
  smokeActive: boolean;
}

export const coverState: CoverState = {
  sirenActive: false,
  smokeActive: false,
};

const sirenSources = new Map<string, boolean>();
const smokeSources = new Map<string, boolean>();

function anyActive(sources: Map<string, boolean>): boolean {
  for (const active of sources.values()) {
    if (active) return true;
  }
  return false;
}

function recomputeSiren() {
  const active = anyActive(sirenSources);
  if (active !== coverState.sirenActive) {
    coverState.sirenActive = active;
    bus.emit("sirenActive", { on: active });
  }
}

function recomputeSmoke() {
  const active = anyActive(smokeSources);
  if (active !== coverState.smokeActive) {
    coverState.smokeActive = active;
    bus.emit("smokeActive", { on: active });
  }
}

/** A siren-flagged hazard reports its own active/inactive state under its id. */
export function setSirenSourceActive(id: string, active: boolean) {
  sirenSources.set(id, active);
  recomputeSiren();
}

/** Call on unmount so a despawned hazard can't keep the siren stuck on. */
export function clearSirenSource(id: string) {
  sirenSources.delete(id);
  recomputeSiren();
}

/** A smoke zone reports whether the player is currently inside it under its id. */
export function setSmokeSourceActive(id: string, active: boolean) {
  smokeSources.set(id, active);
  recomputeSmoke();
}

/** Call on unmount so a despawned smoke zone can't keep cover stuck on. */
export function clearSmokeSource(id: string) {
  smokeSources.delete(id);
  recomputeSmoke();
}

/**
 * Simple covered/uncovered readout for this ticket's debug overlay only.
 * 3.3 owns the real cover *factor* math (×0.1 / ×0.15 / etc.) — don't
 * preempt that here, this is detection only.
 */
export function isCovered(): boolean {
  return coverState.sirenActive || coverState.smokeActive;
}
