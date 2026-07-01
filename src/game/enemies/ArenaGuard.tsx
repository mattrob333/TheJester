import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { RigidBody, CapsuleCollider, type RapierRigidBody } from "@react-three/rapier";
import { Vector3, type Mesh, type MeshStandardMaterial } from "three";
import type { ArenaGuardConfig } from "../types";
import { useGameState } from "../systems/gameState";
import { bus } from "../systems/events";
import { registerTarget, unregisterTarget, type Targetable } from "../combat/targets";
import { playerTracking } from "../player/playerTracking";

type GuardState = "patrol" | "chase" | "attack" | "dead";

const PATROL_SPEED = 2; // m/s
const CHASE_SPEED = 4.5; // m/s
const CHASE_RANGE = 14; // start chasing once player is this close
const ATTACK_RANGE = 2; // melee range
const ATTACK_DAMAGE = 12;
const ATTACK_COOLDOWN = 1; // seconds between melee hits
const FLASH_DURATION = 0.25;
const GUARD_RADIUS = 0.6;
const GUARD_HALF_HEIGHT = 0.5;

/**
 * Ticket 4.1 — Arena Guard. Patrols back and forth, chases the player when
 * close, deals melee damage in attack range, and dies when its own health
 * (separate from `GameState.health`, which is player-only) reaches zero.
 *
 * Movement is driven kinematically (position computed in JS, written to the
 * RigidBody each frame) rather than via velocity — simplest controller for a
 * patrol/chase state machine, and we don't need dynamic collision response
 * for the guard itself, just to be a damageable, player-blocking obstacle.
 */
export function ArenaGuard({ config }: { config: ArenaGuardConfig }) {
  const bodyRef = useRef<RapierRigidBody>(null);
  const meshRef = useRef<Mesh>(null);
  const position = useRef(new Vector3(...config.pos)).current;
  const health = useRef(config.health);
  const stateRef = useRef<GuardState>("patrol");
  const patrolDir = useRef(1);
  const lastAttack = useRef(-Infinity);
  const flashStart = useRef(-Infinity);
  const [dead, setDead] = useState(false);

  const toPlayer = useMemo(() => new Vector3(), []);
  const id = useMemo(() => `arena-guard-${config.pos.join(",")}`, [config.pos]);

  const target = useRef<Targetable>({
    id,
    position,
    radius: GUARD_RADIUS,
    owner: "enemy" as const,
    onHit: () => {
      if (stateRef.current === "dead") return;
      flashStart.current = performance.now() / 1000;
      health.current -= 1;
      if (health.current <= 0) {
        stateRef.current = "dead";
        bus.emit("enemyKilled", { id, byHazard: false });
        setDead(true);
      }
    },
  }).current;

  useEffect(() => {
    registerTarget(target);
    return () => unregisterTarget(target);
  }, [target]);

  useFrame((state, dt) => {
    if (dead) return;
    const body = bodyRef.current;
    if (!body) return;

    toPlayer.copy(playerTracking.position).sub(position);
    const distToPlayer = toPlayer.length();

    if (playerTracking.alive && distToPlayer <= ATTACK_RANGE) {
      stateRef.current = "attack";
    } else if (playerTracking.alive && distToPlayer <= CHASE_RANGE) {
      stateRef.current = "chase";
    } else {
      stateRef.current = "patrol";
    }

    const now = state.clock.elapsedTime;

    if (stateRef.current === "attack") {
      if (now - lastAttack.current >= ATTACK_COOLDOWN) {
        lastAttack.current = now;
        useGameState.getState().damage(ATTACK_DAMAGE);
        bus.emit("playerDamaged", { amount: ATTACK_DAMAGE, source: "arena-guard" });
      }
    } else if (stateRef.current === "chase") {
      if (distToPlayer > 1e-4) {
        toPlayer.normalize();
        position.addScaledVector(toPlayer, CHASE_SPEED * dt);
      }
    } else {
      // Patrol back and forth along X around the spawn pos.
      position.x += patrolDir.current * PATROL_SPEED * dt;
      const offset = position.x - config.pos[0];
      if (Math.abs(offset) >= config.patrolRadius) {
        position.x = config.pos[0] + Math.sign(offset) * config.patrolRadius;
        patrolDir.current *= -1;
      }
    }

    body.setTranslation({ x: position.x, y: position.y, z: position.z }, true);

    if (meshRef.current) {
      const mat = meshRef.current.material as MeshStandardMaterial;
      const elapsed = now - flashStart.current;
      const flashing = elapsed < FLASH_DURATION;
      mat.emissive.setHex(flashing ? 0xff0000 : stateRef.current === "attack" ? 0xea580c : 0x000000);
      mat.emissiveIntensity = flashing ? 2 : stateRef.current === "attack" ? 1 : 0;
    }
  });

  if (dead) return null;

  return (
    <RigidBody
      ref={bodyRef}
      type="kinematicPosition"
      colliders={false}
      position={[position.x, position.y, position.z]}
    >
      <CapsuleCollider args={[GUARD_HALF_HEIGHT, GUARD_RADIUS]} />
      <mesh ref={meshRef} castShadow>
        <capsuleGeometry args={[GUARD_RADIUS, GUARD_HALF_HEIGHT * 2, 8, 16]} />
        <meshStandardMaterial color="#7f1d1d" roughness={0.5} metalness={0.2} />
      </mesh>
    </RigidBody>
  );
}
