import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { RigidBody, BallCollider, type RapierRigidBody } from "@react-three/rapier";
import { Group, MathUtils, Vector3, type Mesh, type MeshStandardMaterial } from "three";
import type { SecurityDroneConfig } from "../types";
import { bus, type GameEvents } from "../systems/events";
import { useGameState } from "../systems/gameState";
import { coverState } from "../systems/coverState";
import { registerTarget, unregisterTarget, type Targetable } from "../combat/targets";
import { fireProjectile } from "../combat/useWeapon";
import { playerTracking } from "../player/playerTracking";
import { spawnExplosion, spawnMuzzleLight } from "../effects/effects";
import { useAppState } from "../systems/appState";
import { isLockdownActive } from "../systems/lockdown";

const FIRE_COOLDOWN = 1.4; // seconds between laser shots
const DRONE_RADIUS = 0.5;
const FLASH_DURATION = 0.25;
/**
 * Suspicion bumped when the drone spots the player firing unsafely within
 * its sight range — a SECOND, stacking source of suspicion on top of 3.3's
 * base shotFired model (per 4.2 spec: "stacking ... not replacing it").
 */
const SPOTTED_FIRING_SUSPICION = 8;

const HULL = "#1b2432";
const HULL_LIGHT = "#3d4b63";
const EYE_IDLE = 0x0ea5e9;
const EYE_TRACKING = 0xff3344;

/**
 * Ticket 4.2 — Security Drone. Hovering enemy that:
 *  1. Fires laser projectiles at the player when within `sightRange`.
 *  2. Listens for `shotFired` and, if the player fired while NOT covered
 *     (open shot) AND is within the drone's sightRange, adds a second,
 *     separate suspicion bump via its own tuning constant.
 *
 * Visual is a proper machine now: armored hull with four rotor pods
 * (spinning blade discs), an underslung barrel that aims at the player, a
 * surveillance eye that goes red when it has you, hover bob + tilt, and a
 * proper explosion on death.
 */
export function SecurityDrone({ config }: { config: SecurityDroneConfig }) {
  const bodyRef = useRef<RapierRigidBody>(null);
  const rigRef = useRef<Group>(null);
  const gimbalRef = useRef<Group>(null);
  const eyeMat = useRef<MeshStandardMaterial>(null);
  const rotorRefs = useRef<(Mesh | null)[]>([null, null, null, null]);
  const position = useRef(new Vector3(...config.pos)).current;
  const health = useRef(config.health);
  const lastFire = useRef(-Infinity);
  const flashStart = useRef(-Infinity);
  const dead = useRef(false);
  const [isDead, setIsDead] = useState(false);

  const toPlayer = useMemo(() => new Vector3(), []);
  const muzzleWorld = useMemo(() => new Vector3(), []);
  const id = useMemo(() => `security-drone-${config.pos.join(",")}`, [config.pos]);

  const target = useRef<Targetable>({
    id,
    position,
    radius: DRONE_RADIUS,
    owner: "enemy" as const,
    onHit: (damage: number) => {
      if (dead.current) return;
      flashStart.current = performance.now() / 1000;
      health.current -= damage;
      if (health.current <= 0) {
        dead.current = true;
        spawnExplosion(position, 0x38bdf8, 1);
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
    const handler = ({ covered, owner }: GameEvents["shotFired"]) => {
      if (dead.current) return;
      if (owner !== "player") return;
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

  useFrame((state, dt) => {
    if (dead.current) return;
    const body = bodyRef.current;
    if (!body) return;

    toPlayer.copy(playerTracking.position).sub(position);
    const distToPlayer = toPlayer.length();
    const now = state.clock.elapsedTime;
    // Passive until the match starts — no sniping the player off the title screen.
    const tracking =
      playerTracking.alive &&
      useAppState.getState().phase === "playing" &&
      distToPlayer <= config.sightRange;

    // Lockdown doubles the fire rate — detection should threaten, not just
    // hand the player a free siren-cover discount.
    const fireCooldown = FIRE_COOLDOWN * (isLockdownActive() ? 0.5 : 1);
    if (tracking && distToPlayer > 1e-4 && now - lastFire.current >= fireCooldown) {
      const dir = toPlayer.clone().normalize();
      muzzleWorld.copy(position).addScaledVector(dir, 0.7);
      // The weapon system owns the cooldown per shooter id; only mark a shot
      // taken if one actually spawned (the old code marked it regardless —
      // code-review §2.1).
      const fired = fireProjectile(muzzleWorld, dir, {
        owner: "enemy",
        shooterId: id,
        cooldown: fireCooldown,
        covered: coverState.sirenActive || coverState.smokeActive,
      });
      if (fired) {
        lastFire.current = now;
        spawnMuzzleLight(muzzleWorld, 0xff4444);
      }
    }

    // Hover bob — the collider position stays synced to the bobbing height.
    const bobY = config.pos[1] + Math.sin(now * 1.6 + config.pos[0]) * 0.25;
    position.y += (bobY - position.y) * (1 - Math.exp(-4 * dt));
    body.setTranslation({ x: position.x, y: position.y, z: position.z }, true);

    const rig = rigRef.current;
    if (rig) {
      // Face the player while tracking; slow scan rotation otherwise.
      if (tracking && distToPlayer > 1e-4) {
        const targetYaw = Math.atan2(toPlayer.x, toPlayer.z);
        let deltaYaw = targetYaw - rig.rotation.y;
        deltaYaw = Math.atan2(Math.sin(deltaYaw), Math.cos(deltaYaw));
        rig.rotation.y += deltaYaw * (1 - Math.exp(-6 * dt));
      } else {
        rig.rotation.y += dt * 0.5;
      }
      // Slight hover sway.
      rig.rotation.z = Math.sin(now * 2.1) * 0.05;
      rig.rotation.x = Math.sin(now * 1.7 + 1) * 0.05;
    }

    // Gun gimbal pitches to keep the barrel on the player.
    if (gimbalRef.current && tracking && distToPlayer > 1e-4) {
      const pitch = Math.atan2(toPlayer.y, Math.hypot(toPlayer.x, toPlayer.z));
      gimbalRef.current.rotation.x = MathUtils.clamp(-pitch, -1.1, 1.1);
    }

    // Rotors spin hard.
    for (const rotor of rotorRefs.current) {
      if (rotor) rotor.rotation.y += dt * 40;
    }

    if (eyeMat.current) {
      const elapsed = now - flashStart.current;
      const flashing = elapsed < FLASH_DURATION;
      eyeMat.current.emissive.setHex(flashing ? 0xffffff : tracking ? EYE_TRACKING : EYE_IDLE);
      eyeMat.current.emissiveIntensity = flashing ? 4 : tracking ? 3 : 1.6;
    }
  });

  if (isDead) return null;

  return (
    <RigidBody
      ref={bodyRef}
      type="kinematicPosition"
      colliders={false}
      position={[position.x, position.y, position.z]}
      gravityScale={0}
    >
      <BallCollider args={[DRONE_RADIUS]} />
      <group ref={rigRef}>
        {/* hull core */}
        <mesh castShadow scale={[1, 0.6, 1]}>
          <sphereGeometry args={[0.42, 16, 12]} />
          <meshStandardMaterial color={HULL} roughness={0.3} metalness={0.8} />
        </mesh>
        {/* top sensor dome */}
        <mesh castShadow position={[0, 0.22, 0]}>
          <sphereGeometry args={[0.16, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color={HULL_LIGHT} roughness={0.25} metalness={0.85} />
        </mesh>
        {/* surveillance eye */}
        <mesh position={[0, 0, 0.36]}>
          <sphereGeometry args={[0.13, 12, 10]} />
          <meshStandardMaterial
            ref={eyeMat}
            color="#04121f"
            emissive="#0ea5e9"
            emissiveIntensity={1.6}
            toneMapped={false}
          />
        </mesh>
        {/* eye housing ring */}
        <mesh position={[0, 0, 0.34]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.15, 0.03, 8, 16]} />
          <meshStandardMaterial color={HULL_LIGHT} roughness={0.3} metalness={0.85} />
        </mesh>

        {/* four rotor pods */}
        {[
          [-0.5, 0.5],
          [0.5, 0.5],
          [-0.5, -0.5],
          [0.5, -0.5],
        ].map(([x, z], i) => (
          <group key={i} position={[x, 0.08, z]}>
            {/* arm */}
            <mesh castShadow position={[-x * 0.35, -0.04, -z * 0.35]} rotation={[0, Math.atan2(x, z), 0.0]}>
              <boxGeometry args={[0.08, 0.05, 0.45]} />
              <meshStandardMaterial color={HULL_LIGHT} roughness={0.35} metalness={0.75} />
            </mesh>
            {/* pod */}
            <mesh castShadow>
              <cylinderGeometry args={[0.09, 0.11, 0.1, 10]} />
              <meshStandardMaterial color={HULL} roughness={0.3} metalness={0.8} />
            </mesh>
            {/* spinning blade disc */}
            <mesh
              ref={(el) => {
                rotorRefs.current[i] = el;
              }}
              position={[0, 0.07, 0]}
            >
              <cylinderGeometry args={[0.28, 0.28, 0.012, 16]} />
              <meshStandardMaterial
                color="#94a3b8"
                transparent
                opacity={0.35}
                roughness={0.2}
                metalness={0.9}
              />
            </mesh>
          </group>
        ))}

        {/* underslung laser barrel on a pitch gimbal */}
        <group ref={gimbalRef} position={[0, -0.24, 0.1]}>
          <mesh castShadow>
            <sphereGeometry args={[0.1, 10, 8]} />
            <meshStandardMaterial color={HULL_LIGHT} roughness={0.3} metalness={0.85} />
          </mesh>
          <mesh castShadow position={[0, 0, 0.22]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.035, 0.045, 0.4, 8]} />
            <meshStandardMaterial color="#0c1420" roughness={0.25} metalness={0.9} />
          </mesh>
          <mesh position={[0, 0, 0.43]}>
            <sphereGeometry args={[0.045, 8, 8]} />
            <meshStandardMaterial
              color="#ff3344"
              emissive="#ff3344"
              emissiveIntensity={2}
              toneMapped={false}
            />
          </mesh>
        </group>

        {/* belly running light */}
        <mesh position={[0, -0.26, -0.1]}>
          <sphereGeometry args={[0.04, 8, 8]} />
          <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={2} toneMapped={false} />
        </mesh>
      </group>
    </RigidBody>
  );
}
