import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RigidBody, CuboidCollider } from "@react-three/rapier";
import { Vector3, type Mesh, type MeshStandardMaterial } from "three";
import { useGameState } from "../../systems/gameState";
import { bus } from "../../systems/events";
import { telemetry } from "../../../ui/telemetry";
import { cyclePhase, HAZARD_COLOR, HIT_COOLDOWN, TELEGRAPH_DURATION } from "./hazardTiming";
import { spawnSparks, addTrauma } from "../../effects/effects";
import { playerTracking } from "../../player/playerTracking";
import type { CrusherHazardConfig } from "../../types";

const DAMAGE = 40;
const ACTIVE_DURATION = 0.4;
const RAISED_Y = 2.4;
const LOWERED_Y = 0.4;
/** Shudder height added during the telegraph — anticipation before the slam. */
const WINDUP_RISE = 0.35;

/**
 * Crusher — an industrial piston that slams down on a config-driven cycle,
 * telegraphed by a blinking beacon and a visible wind-up. The danger sensor
 * is a static box at the lowered position; damage is gated purely by the
 * timing phase, but the head now *animates* the full slam: it creeps up
 * during the warning, drops hard at the phase edge, throws impact dust, and
 * rattles the camera if the player is nearby.
 */
export function CrusherHazard({ config }: { config: CrusherHazardConfig }) {
  const headRef = useRef<Mesh>(null);
  const beaconRef = useRef<Mesh>(null);
  const overlapCount = useRef(0);
  const lastHit = useRef(-Infinity);
  const wasActive = useRef(false);
  const impactPos = useRef(new Vector3(config.pos[0], config.pos[1] + LOWERED_Y - 0.4, config.pos[2])).current;
  const toPlayer = useRef(new Vector3()).current;

  useFrame((state, dt) => {
    const now = state.clock.elapsedTime;
    const phase = cyclePhase(now, config.interval, ACTIVE_DURATION);
    const cycle = ((now % config.interval) + config.interval) % config.interval;
    const activeStart = config.interval - ACTIVE_DURATION;

    if (headRef.current) {
      let targetY: number;
      if (phase === "active") {
        // Slam: near-instant drop right at the phase edge (damage timing unchanged).
        const sinceSlam = cycle - activeStart;
        targetY = sinceSlam < 0.08 ? RAISED_Y - (sinceSlam / 0.08) * (RAISED_Y - LOWERED_Y) : LOWERED_Y;
      } else if (phase === "warning") {
        // Wind-up: rise slightly with a nervous shudder.
        const warnT = (cycle - (activeStart - TELEGRAPH_DURATION)) / TELEGRAPH_DURATION;
        targetY = RAISED_Y + WINDUP_RISE * warnT + Math.sin(now * 45) * 0.03;
      } else {
        // Recover: ease back up after the slam.
        targetY = RAISED_Y;
        headRef.current.position.y += (targetY - headRef.current.position.y) * (1 - Math.exp(-6 * dt));
        targetY = headRef.current.position.y;
      }
      headRef.current.position.y = targetY;
    }

    // Impact moment: dust burst + proximity camera shake, once per slam.
    if (phase === "active" && !wasActive.current) {
      spawnSparks(impactPos, null, 0xd9c9a3, 16, 6);
      const dist = toPlayer.copy(playerTracking.position).sub(impactPos).length();
      if (dist < 14) addTrauma(0.35 * (1 - dist / 14));
    }
    wasActive.current = phase === "active";

    if (beaconRef.current) {
      const mat = beaconRef.current.material as MeshStandardMaterial;
      mat.color.set(HAZARD_COLOR[phase]);
      mat.emissive.set(HAZARD_COLOR[phase]);
      // Blink hard during the telegraph.
      mat.emissiveIntensity =
        phase === "warning" ? 1.4 + Math.sin(now * 24) * 1.2 : phase === "active" ? 2.4 : 0.3;
    }

    if (overlapCount.current > 0) {
      telemetry.hazardPhase = `crusher:${phase}`;
      if (phase === "active" && now - lastHit.current >= HIT_COOLDOWN) {
        lastHit.current = now;
        useGameState.getState().damage(DAMAGE);
        bus.emit("playerDamaged", { amount: DAMAGE, source: "crusher" });
      }
    } else if (telemetry.hazardPhase?.startsWith("crusher:")) {
      telemetry.hazardPhase = null;
    }
  });

  return (
    <group position={config.pos}>
      <RigidBody type="fixed" colliders={false} position={[0, LOWERED_Y, 0]}>
        <CuboidCollider args={[0.6, 0.4, 0.6]} sensor
          onIntersectionEnter={() => {
            overlapCount.current += 1;
          }}
          onIntersectionExit={() => {
            overlapCount.current = Math.max(0, overlapCount.current - 1);
          }}
        />
      </RigidBody>

      {/* gantry frame: two side rails (grounded to the arena floor) + crossbeam */}
      {[-0.85, 0.85].map((x) => {
        const railHeight = config.pos[1] + RAISED_Y * 1.5 + 0.7;
        return (
          <mesh key={x} castShadow position={[x, railHeight / 2 - config.pos[1], 0]}>
            <boxGeometry args={[0.18, railHeight, 0.18]} />
            <meshStandardMaterial color="#1e293b" roughness={0.35} metalness={0.8} />
          </mesh>
        );
      })}
      <mesh castShadow position={[0, RAISED_Y * 1.5 + 0.6, 0]}>
        <boxGeometry args={[2.0, 0.25, 0.35]} />
        <meshStandardMaterial color="#334155" roughness={0.35} metalness={0.8} />
      </mesh>
      {/* piston rod */}
      <mesh castShadow position={[0, RAISED_Y * 1.2, 0]}>
        <cylinderGeometry args={[0.12, 0.12, RAISED_Y * 1.2, 10]} />
        <meshStandardMaterial color="#64748b" roughness={0.25} metalness={0.9} />
      </mesh>

      {/* crusher head with hazard-striped skirt */}
      <mesh ref={headRef} castShadow position={[0, RAISED_Y, 0]}>
        <boxGeometry args={[1.2, 0.8, 1.2]} />
        <meshStandardMaterial color="#475569" metalness={0.7} roughness={0.3} />
      </mesh>

      {/* anvil plate spanning the rails, just below the head's lowered travel */}
      <mesh receiveShadow position={[0, LOWERED_Y - 0.48, 0]}>
        <boxGeometry args={[1.9, 0.1, 0.5]} />
        <meshStandardMaterial color="#f59e0b" emissive="#b45309" emissiveIntensity={0.25} roughness={0.5} metalness={0.4} />
      </mesh>

      <mesh ref={beaconRef} position={[0, RAISED_Y * 1.5 + 0.95, 0]}>
        <sphereGeometry args={[0.15, 12, 12]} />
        <meshStandardMaterial color="#1f2937" emissive="#1f2937" emissiveIntensity={0.3} toneMapped={false} />
      </mesh>
    </group>
  );
}
