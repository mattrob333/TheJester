import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { RigidBody, CapsuleCollider, type RapierRigidBody } from "@react-three/rapier";
import { Group, MathUtils, Vector3, type MeshStandardMaterial } from "three";
import type { ArenaGuardConfig } from "../types";
import { bus } from "../systems/events";
import { applyPlayerDamage } from "../systems/playerDamage";
import { registerTarget, unregisterTarget, type Targetable } from "../combat/targets";
import { playerTracking } from "../player/playerTracking";
import { spawnExplosion } from "../effects/effects";
import { useAppState } from "../systems/appState";
import { isLockdownActive } from "../systems/lockdown";
import { activeArena } from "../config/activeArena";

// Keep kinematic guards inside the arena shell (walls are 0.5 thick + guard radius).
const BOUND_X = activeArena.bounds.width / 2 - 1;
const BOUND_Z = activeArena.bounds.depth / 2 - 1;

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

const ARMOR = "#3f1d1d";
const ARMOR_DARK = "#1c0f0f";
const ARMOR_TRIM = "#7f1d1d";
const VISOR: Record<Exclude<GuardState, "dead">, number> = {
  patrol: 0xff3333,
  chase: 0xff6a00,
  attack: 0xffb300,
};

/**
 * Ticket 4.1 — Arena Guard. Patrols back and forth, chases the player when
 * close, deals melee damage in attack range, and dies (in a shower of
 * sparks) when its own health reaches zero.
 *
 * Movement is driven kinematically (position computed in JS, written to the
 * RigidBody each frame). The visual is a full articulated rig: armored
 * humanoid with a glowing visor that shifts color with its AI state, a
 * shock baton, a walk cycle that speeds up with chase, and an attack lunge.
 */
export function ArenaGuard({ config }: { config: ArenaGuardConfig }) {
  const bodyRef = useRef<RapierRigidBody>(null);
  const rigRef = useRef<Group>(null);
  const legLRef = useRef<Group>(null);
  const legRRef = useRef<Group>(null);
  const armLRef = useRef<Group>(null);
  const armRRef = useRef<Group>(null);
  const visorMat = useRef<MeshStandardMaterial>(null);
  const batonMat = useRef<MeshStandardMaterial>(null);
  const position = useRef(new Vector3(...config.pos)).current;
  const health = useRef(config.health);
  const stateRef = useRef<GuardState>("patrol");
  const patrolDir = useRef(1);
  const lastAttack = useRef(-Infinity);
  const flashStart = useRef(-Infinity);
  const facing = useRef(0); // smoothed yaw
  const walkPhase = useRef(0);
  const engaged = useRef(false); // leash hysteresis state
  const [dead, setDead] = useState(false);

  const toPlayer = useMemo(() => new Vector3(), []);
  const id = useMemo(() => `arena-guard-${config.pos.join(",")}`, [config.pos]);

  const target = useRef<Targetable>({
    id,
    position,
    radius: GUARD_RADIUS,
    owner: "enemy" as const,
    onHit: (damage: number) => {
      if (stateRef.current === "dead") return;
      flashStart.current = performance.now() / 1000;
      health.current -= damage;
      if (health.current <= 0) {
        stateRef.current = "dead";
        spawnExplosion(position, 0xff5533, 1.2);
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

    // Enemies stay passive (patrol only) until the match actually starts —
    // otherwise they maul the player at spawn while the title screen is up.
    // Leash with hysteresis: engage while the player is near the patrol HOME
    // (CHASE_RANGE), but once engaged keep pressure until they're clearly out
    // (CHASE_RANGE + 4) — no flip-flopping at the boundary, and no kiting the
    // guard across the whole arena.
    const distFromHome = Math.hypot(
      playerTracking.position.x - config.pos[0],
      playerTracking.position.z - config.pos[2],
    );
    const leashRange = engaged.current ? CHASE_RANGE + 4 : CHASE_RANGE;
    const live =
      playerTracking.alive &&
      useAppState.getState().phase === "playing" &&
      distFromHome <= leashRange;
    engaged.current = live && distToPlayer <= CHASE_RANGE;

    if (live && distToPlayer <= ATTACK_RANGE) {
      stateRef.current = "attack";
    } else if (live && distToPlayer <= CHASE_RANGE) {
      stateRef.current = "chase";
    } else {
      stateRef.current = "patrol";
    }

    const now = state.clock.elapsedTime;
    let moveSpeed = 0;
    let targetYaw = facing.current;

    if (stateRef.current === "attack") {
      targetYaw = Math.atan2(toPlayer.x, toPlayer.z);
      if (now - lastAttack.current >= ATTACK_COOLDOWN && applyPlayerDamage(ATTACK_DAMAGE, "arena-guard")) {
        lastAttack.current = now;
      }
    } else if (stateRef.current === "chase") {
      // Chase on the horizontal plane only — a ground unit must not float up
      // after a flying player (code-review §2.3). Lockdown makes it MEAN.
      toPlayer.y = 0;
      const planarDist = toPlayer.length();
      if (planarDist > 1e-4) {
        toPlayer.normalize();
        const chaseSpeed = CHASE_SPEED * (isLockdownActive() ? 1.5 : 1);
        position.addScaledVector(toPlayer, chaseSpeed * dt);
        targetYaw = Math.atan2(toPlayer.x, toPlayer.z);
        moveSpeed = chaseSpeed;
      }
    } else {
      // Patrol back and forth along X around the spawn pos; drift back to the
      // home Z line if a chase dragged the guard off it.
      position.x += patrolDir.current * PATROL_SPEED * dt;
      position.z += (config.pos[2] - position.z) * (1 - Math.exp(-1.5 * dt));
      const offset = position.x - config.pos[0];
      if (Math.abs(offset) >= config.patrolRadius) {
        position.x = config.pos[0] + Math.sign(offset) * config.patrolRadius;
        patrolDir.current *= -1;
      }
      targetYaw = Math.atan2(patrolDir.current, 0);
      moveSpeed = PATROL_SPEED;
    }

    // Ground clamp: the guard walks at its configured height, always — no
    // sinking, no hovering, no drifting upward out of a chase.
    position.y = config.pos[1];
    // Arena-bounds clamp so kiting can't steer it through a wall (kinematic
    // bodies don't collision-resolve on their own).
    position.x = MathUtils.clamp(position.x, -BOUND_X, BOUND_X);
    position.z = MathUtils.clamp(position.z, -BOUND_Z, BOUND_Z);

    body.setTranslation({ x: position.x, y: position.y, z: position.z }, true);

    // --- rig animation ---
    const rig = rigRef.current;
    if (rig) {
      // Face movement/player, taking the short way around the circle.
      let deltaYaw = targetYaw - facing.current;
      deltaYaw = Math.atan2(Math.sin(deltaYaw), Math.cos(deltaYaw));
      facing.current += deltaYaw * (1 - Math.exp(-8 * dt));
      rig.rotation.y = facing.current;

      // Attack lunge: quick forward jab that decays over the cooldown.
      const sinceAttack = now - lastAttack.current;
      const lunge =
        stateRef.current === "attack" && sinceAttack < 0.3
          ? Math.sin((sinceAttack / 0.3) * Math.PI)
          : 0;
      rig.rotation.x = lunge * 0.35;

      // Walk cycle, cadence scaled by actual movement speed.
      walkPhase.current += dt * (2 + moveSpeed * 2.2);
      const swing = Math.sin(walkPhase.current) * MathUtils.clamp(moveSpeed / CHASE_SPEED, 0, 1) * 0.55;
      if (legLRef.current) legLRef.current.rotation.x = swing;
      if (legRRef.current) legRRef.current.rotation.x = -swing;
      if (armLRef.current) armLRef.current.rotation.x = -swing * 0.7;
      if (armRRef.current) {
        // Baton arm: raised and jabbing while attacking, else counter-swings.
        armRRef.current.rotation.x =
          stateRef.current === "attack" ? -1.2 - lunge * 0.8 : swing * 0.7;
      }
    }

    if (visorMat.current) {
      const elapsed = now - flashStart.current;
      const flashing = elapsed < FLASH_DURATION;
      // stateRef.current is never "dead" here — the dead path bails out above.
      visorMat.current.emissive.setHex(flashing ? 0xffffff : VISOR[stateRef.current]);
      visorMat.current.emissiveIntensity = flashing ? 4 : 2.4;
    }
    if (batonMat.current) {
      batonMat.current.emissiveIntensity =
        stateRef.current === "attack" ? 3 : 1.2 + Math.sin(now * 6) * 0.3;
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
      <group ref={rigRef}>
        {/* helmet */}
        <mesh castShadow position={[0, 0.62, 0]}>
          <sphereGeometry args={[0.24, 16, 12]} />
          <meshStandardMaterial color={ARMOR_DARK} roughness={0.35} metalness={0.7} />
        </mesh>
        {/* visor strip — state-colored */}
        <mesh position={[0, 0.64, 0.17]}>
          <boxGeometry args={[0.3, 0.07, 0.12]} />
          <meshStandardMaterial
            ref={visorMat}
            color="#200000"
            emissive="#ff3333"
            emissiveIntensity={2.4}
            toneMapped={false}
          />
        </mesh>
        {/* torso armor */}
        <mesh castShadow position={[0, 0.15, 0]} scale={[1, 1.15, 0.75]}>
          <sphereGeometry args={[0.34, 16, 12]} />
          <meshStandardMaterial color={ARMOR} roughness={0.4} metalness={0.55} />
        </mesh>
        {/* chest plate */}
        <mesh castShadow position={[0, 0.22, 0.2]} scale={[0.8, 0.7, 0.4]}>
          <sphereGeometry args={[0.28, 12, 10]} />
          <meshStandardMaterial color={ARMOR_DARK} roughness={0.3} metalness={0.75} />
        </mesh>
        {/* shoulder pauldrons */}
        {[-0.4, 0.4].map((x) => (
          <mesh key={x} castShadow position={[x, 0.42, 0]}>
            <sphereGeometry args={[0.16, 12, 10]} />
            <meshStandardMaterial color={ARMOR_TRIM} roughness={0.35} metalness={0.6} />
          </mesh>
        ))}
        {/* hips */}
        <mesh castShadow position={[0, -0.28, 0]} scale={[0.85, 0.55, 0.7]}>
          <sphereGeometry args={[0.3, 12, 10]} />
          <meshStandardMaterial color={ARMOR_DARK} roughness={0.5} metalness={0.4} />
        </mesh>

        {/* legs — pivot at hip */}
        <group ref={legLRef} position={[-0.17, -0.38, 0]}>
          <mesh castShadow position={[0, -0.32, 0]}>
            <capsuleGeometry args={[0.09, 0.45, 4, 10]} />
            <meshStandardMaterial color={ARMOR} roughness={0.45} metalness={0.4} />
          </mesh>
          <mesh castShadow position={[0, -0.62, 0.04]}>
            <boxGeometry args={[0.16, 0.12, 0.28]} />
            <meshStandardMaterial color={ARMOR_DARK} roughness={0.4} metalness={0.5} />
          </mesh>
        </group>
        <group ref={legRRef} position={[0.17, -0.38, 0]}>
          <mesh castShadow position={[0, -0.32, 0]}>
            <capsuleGeometry args={[0.09, 0.45, 4, 10]} />
            <meshStandardMaterial color={ARMOR} roughness={0.45} metalness={0.4} />
          </mesh>
          <mesh castShadow position={[0, -0.62, 0.04]}>
            <boxGeometry args={[0.16, 0.12, 0.28]} />
            <meshStandardMaterial color={ARMOR_DARK} roughness={0.4} metalness={0.5} />
          </mesh>
        </group>

        {/* left arm */}
        <group ref={armLRef} position={[-0.42, 0.32, 0]}>
          <mesh castShadow position={[0, -0.26, 0]}>
            <capsuleGeometry args={[0.075, 0.38, 4, 10]} />
            <meshStandardMaterial color={ARMOR} roughness={0.45} metalness={0.4} />
          </mesh>
        </group>
        {/* right arm + shock baton */}
        <group ref={armRRef} position={[0.42, 0.32, 0]}>
          <mesh castShadow position={[0, -0.26, 0]}>
            <capsuleGeometry args={[0.075, 0.38, 4, 10]} />
            <meshStandardMaterial color={ARMOR} roughness={0.45} metalness={0.4} />
          </mesh>
          <group position={[0, -0.5, 0]} rotation={[-0.4, 0, 0]}>
            <mesh castShadow position={[0, 0, -0.25]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.035, 0.035, 0.55, 8]} />
              <meshStandardMaterial color="#334155" roughness={0.3} metalness={0.8} />
            </mesh>
            <mesh position={[0, 0, -0.55]} rotation={[Math.PI / 2, 0, 0]}>
              <capsuleGeometry args={[0.05, 0.16, 4, 8]} />
              <meshStandardMaterial
                ref={batonMat}
                color="#7dd3fc"
                emissive="#38bdf8"
                emissiveIntensity={1.2}
                toneMapped={false}
              />
            </mesh>
          </group>
        </group>
      </group>
    </RigidBody>
  );
}
