/**
 * Ticket 3.1b — module-scoped lock-on state shared between the weapon system
 * (which computes the lock each frame) and the indicator renderer. Plain
 * object, not zustand — read/written every frame.
 */
export const lockOnState = {
  targetId: null as string | null,
};
