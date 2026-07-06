import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RigidBody, CuboidCollider } from "@react-three/rapier";
import { AdditiveBlending, type Mesh, type MeshBasicMaterial, type MeshStandardMaterial } from "three";
import { applyPlayerDamage } from "../../systems/playerDamage";
import { telemetry } from "../../../ui/telemetry";
import { cyclePhase, HIT_COOLDOWN } from "./hazardTiming";
import type { LaserHazardConfig } from "../../types";

const DAMAGE = 15;
const ACTIVE_DURATION = 1.0;
const BEAM_THICKNESS = 0.15;

const WARNING_COLOR = "#facc15";
const ACTIVE_COLOR = "#f43f5e";

/**
 * Laser gate — twin emitter pylons charge (glowing warning line + heating
 * emitter tips), then fire a solid two-layer beam (hot core + additive glow
 * shell) along `axis` for `ACTIVE_DURATION`, on a config-driven cycle. The
 * danger sensor spans the full beam volume and is only lethal while
 * phase === "active".
 */
export function LaserHazard({ config }: { config: LaserHazardConfig }) {
  const coreRef = useRef<Mesh>(null);
  const glowRef = useRef<Mesh>(null);
  const emitterMats = useRef<(MeshStandardMaterial | null)[]>([null, null]);
  const overlapCount = useRef(0);
  const lastHit = useRef(-Infinity);

  const along: [number, number, number] =
    config.axis === "x"
      ? [config.length, BEAM_THICKNESS, BEAM_THICKNESS]
      : [BEAM_THICKNESS, BEAM_THICKNESS, config.length];
  const halfExtents: [number, number, number] = [along[0] / 2, along[1] / 2, along[2] / 2];
  const endOffsets: [number, number, number][] =
    config.axis === "x"
      ? [
          [-config.length / 2, 0, 0],
          [config.length / 2, 0, 0],
        ]
      : [
          [0, 0, -config.length / 2],
          [0, 0, config.length / 2],
        ];

  useFrame((state) => {
    const now = state.clock.elapsedTime;
    const phase = cyclePhase(now, config.interval, ACTIVE_DURATION);

    const core = coreRef.current;
    const glow = glowRef.current;
    if (core && glow) {
      const coreMat = core.material as MeshBasicMaterial;
      const glowMat = glow.material as MeshBasicMaterial;
      if (phase === "active") {
        core.visible = true;
        glow.visible = true;
        coreMat.color.set("#ffffff");
        glowMat.color.set(ACTIVE_COLOR);
        const pulse = 1 + Math.sin(now * 40) * 0.15;
        core.scale.set(1, pulse, pulse);
        glow.scale.set(1, 3.2 * pulse, 3.2 * pulse);
      } else if (phase === "warning") {
        // Thin targeting line flickers while charging.
        core.visible = Math.sin(now * 30) > -0.4;
        glow.visible = false;
        coreMat.color.set(WARNING_COLOR);
        core.scale.set(1, 0.35, 0.35);
      } else {
        core.visible = false;
        glow.visible = false;
      }
    }
    for (const mat of emitterMats.current) {
      if (!mat) continue;
      if (phase === "active") {
        mat.emissive.set(ACTIVE_COLOR);
        mat.emissiveIntensity = 3;
      } else if (phase === "warning") {
        mat.emissive.set(WARNING_COLOR);
        mat.emissiveIntensity = 1.5 + Math.sin(now * 24) * 1.2;
      } else {
        mat.emissive.set("#1f2937");
        mat.emissiveIntensity = 0.4;
      }
    }

    if (phase === "active" && overlapCount.current > 0) {
      if (now - lastHit.current >= HIT_COOLDOWN && applyPlayerDamage(DAMAGE, "laser")) {
        lastHit.current = now;
      }
    }
    if (overlapCount.current > 0) {
      telemetry.hazardPhase = `laser:${phase}`;
    } else if (telemetry.hazardPhase?.startsWith("laser:")) {
      telemetry.hazardPhase = null;
    }
  });

  return (
    <group position={config.pos}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider
          args={halfExtents}
          sensor
          onIntersectionEnter={() => {
            overlapCount.current += 1;
          }}
          onIntersectionExit={() => {
            overlapCount.current = Math.max(0, overlapCount.current - 1);
          }}
        />
      </RigidBody>

      {/* beam core — hot line */}
      <mesh ref={coreRef} visible={false}>
        <boxGeometry args={along} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </mesh>
      {/* beam glow shell — additive halo around the core */}
      <mesh ref={glowRef} visible={false}>
        <boxGeometry args={along} />
        <meshBasicMaterial
          color={ACTIVE_COLOR}
          transparent
          opacity={0.35}
          blending={AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      {/* emitter pylons at each end */}
      {endOffsets.map((offset, i) => (
        <group key={i} position={offset}>
          {/* column to the floor */}
          <mesh castShadow position={[0, -config.pos[1] / 2, 0]}>
            <boxGeometry args={[0.35, config.pos[1], 0.35]} />
            <meshStandardMaterial color="#1e293b" roughness={0.35} metalness={0.8} />
          </mesh>
          {/* emitter head */}
          <mesh castShadow>
            <boxGeometry args={[0.5, 0.5, 0.5]} />
            <meshStandardMaterial color="#334155" roughness={0.3} metalness={0.85} />
          </mesh>
          {/* focusing lens — heats with the cycle */}
          <mesh
            rotation={config.axis === "x" ? [0, 0, Math.PI / 2] : [Math.PI / 2, 0, 0]}
          >
            <cylinderGeometry args={[0.14, 0.14, 0.54, 12]} />
            <meshStandardMaterial
              ref={(el) => {
                emitterMats.current[i] = el;
              }}
              color="#0f172a"
              emissive="#1f2937"
              emissiveIntensity={0.4}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}
