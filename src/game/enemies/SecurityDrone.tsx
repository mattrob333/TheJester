import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { RigidBody, type RapierRigidBody } from "@react-three/rapier";
import { Vector3, type Mesh, type MeshStandardMaterial } from "three";
import type { SecurityDroneConfig } from "../types";
import { bus } from "../systems/events";
import { useGameState } from "../systems/gameState";
import { coverState } from "../systems/coverState";
import { registerTarget, unregisterTarget, type Targetable } from "../combat/targets";
import { fireProjectile } from "../combat/useWeapon";
import { playerTracking } from "../player/playerTracking";

const FIRE_COOLDOWN = 1.4; // seconds between laser shots
const DRONE_RADIUS = 0.5;
const FLASH_DURATION = 0.25;
/**
 * Suspicion bumped when the drone spots the player firing unsafely within
 * its sight range — a SECOND, stacking source of suspicion on top of 3.3's
 * base shotFired model (per 4.2 spec: "stacking ... not replacing it").
 */
const SPOTTED_FIRING_SUSPICION = 8;

/**
 * Ticket 4.2 — Security Drone. Stationary flying enemy (hovers at its spawn
 * position) that:
 *  1. Fires laser projectiles at the player when within `sightRange` and
 *     line-of-sight is trivially approximated as "within range" (no
 *     occlusion raycast yet — same simplification level as 4.1's chase
 *     logic, a follow-up ticket territory).
 *  2. Listens for `shotFired` and, if the player fired while NOT covered
 *     (open shot) AND is within the drone's sightRange, adds a second,
 *     separate suspicion bump via its own tuning constant — this is what
 *     ties combat to the suspicion loop per the ticket's framing.
 *
 * Reuses Projectile.tsx/fireProjectile directly with `owner: "enemy"` —
 * already parameterized since 3.1/3.1b, no fork needed.
 */
export function SecurityDrone({ config }: { config: SecurityDroneConfig }) {
  const bodyRef = useRef<RapierRigidBody>(null);
  const meshRef = useRef<Mesh>(null);
  const position = useRef(new Vector3(...config.pos)).current;
  const health = useRef(config.health);
  const lastFire = useRef(-Infinity);
  const flashStart = useRef(-Infinity);
  const dead = useRef(false);
  const [isDead, setIsDead] = useState(false);

  const toPlayer = useMemo(() => new Vector3(), []);
  const id = useMemo(() => `security-drone-${config.pos.join(",")}`, [config.pos]);

  const target = useRef<Targetable>({
    id,
    position,
    radius: DRONE_RADIUS,
    owner: "enemy" as const,
    onHit: () => {
      if (dead.current) return;
      flashStart.current = performance.now() / 1000;
      health.current -= 1;
      if (health.current <= 0) {
        dead.current = true;
        bus.emit("enemyKilled", { id, byHazard: false });
        setIsDead(true);
      }
    },
  }).current;

  useEffect(() => {
    registerTarget(target);
    return () => unregisterTarget(target);
  }, [target]);

  // Ticket 4.2 — spot the player firing unsafely within sight range.
  useEffect(() => {
    const handler = ({ covered }: { covered: boolean }) => {
      if (dead.current) return;
      if (covered) return;
      const distToPlayer = toPlayer.copy(playerTracking.position).sub(position).length();
      if (distToPlayer > config.sightRange) return;
      // Open shot spotted by this drone — stacking bump separate from 3.3's
      // base model, and independent of coverState's siren/smoke factors
      // (those already lower 3.3's own multiplier; this is purely "a drone
      // saw you do it").
      useGameState.getState().addSuspicion(SPOTTED_FIRING_SUSPICION);
    };
    bus.on("shotFired", handler);
    return () => bus.off("shotFired", handler);
  }, [config.sightRange, position, toPlayer]);

  useFrame((state) => {
    if (dead.current) return;
    const body = bodyRef.current;
    if (!body) return;

    toPlayer.copy(playerTracking.position).sub(position);
    const distToPlayer = toPlayer.length();
    const now = state.clock.elapsedTime;

    if (
      playerTracking.alive &&
      distToPlayer <= config.sightRange &&
      distToPlayer > 1e-4 &&
      now - lastFire.current >= FIRE_COOLDOWN
    ) {
      lastFire.current = now;
      const dir = toPlayer.clone().normalize();
      fireProjectile(position, dir, { owner: "enemy", covered: coverState.sirenActive || coverState.smokeActive });
    }

    // Stationary hover — body stays put, but keep position synced in case a
    // future ticket adds movement (bob/strafe).
    body.setTranslation({ x: position.x, y: position.y, z: position.z }, true);

    if (meshRef.current) {
      const mat = meshRef.current.material as MeshStandardMaterial;
      const elapsed = now - flashStart.current;
      const flashing = elapsed < FLASH_DURATION;
      mat.emissive.setHex(flashing ? 0xff0000 : 0x0ea5e9);
      mat.emissiveIntensity = flashing ? 2 : 0.8;
    }
  });

  if (isDead) return null;

  return (
    <RigidBody
      ref={bodyRef}
      type="kinematicPosition"
      colliders="ball"
      position={[position.x, position.y, position.z]}
      gravityScale={0}
    >
      <mesh ref={meshRef} castShadow>
        <octahedronGeometry args={[DRONE_RADIUS, 0]} />
        <meshStandardMaterial color="#0ea5e9" roughness={0.3} metalness={0.6} />
      </mesh>
    </RigidBody>
  );
}
