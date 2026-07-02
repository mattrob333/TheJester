import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
  Color,
  Group,
  MathUtils,
  Vector3,
  type Mesh,
  type MeshBasicMaterial,
  type PointLight,
} from "three";

/**
 * The Jester — procedural articulated player character.
 *
 * Built entirely from primitives (no glb dependency) but modeled and animated
 * like a real character: harlequin suit, three-point belled hat, glowing grin
 * mask, a compact SMG in the right hand that aims with your look pitch, and a
 * twin-nozzle jetpack whose flames scale with thrust. The rig banks into
 * strafes, leans into forward flight, and lets the legs trail with movement,
 * so flying reads as a body in motion instead of a sliding statue.
 *
 * `JesterAnim` is a plain mutable object written by Player.tsx every frame
 * (same pattern as flightState) — no React state in the hot path.
 */

export interface JesterAnim {
  /** Player-local velocity (x = strafe, y = vertical, z = forward-negative). */
  localVel: Vector3;
  /** 0..1 normalized thrust for flame length / light. */
  thrust: number;
  boosting: boolean;
  /** Look pitch (radians) so the gun arm tracks your aim. */
  pitch: number;
  /** Clock time (s) of the last shot, for muzzle flash + recoil. */
  lastFireAt: number;
}

export function createJesterAnim(): JesterAnim {
  return {
    localVel: new Vector3(),
    thrust: 0,
    boosting: false,
    pitch: 0,
    lastFireAt: -Infinity,
  };
}

// Palette
const SUIT = "#6d28d9"; // royal purple
const SUIT_DARK = "#3b0764";
const SUIT_ACCENT = "#c026d3"; // magenta
const GOLD = "#f59e0b";
const FACE = "#f4efe6";
const EYE = "#34e8eb";
const METAL = "#2a2f3a";
const METAL_LIGHT = "#4b5563";
const FLAME_CORE = new Color("#ffe9b0");
const FLAME_OUTER = new Color("#ff8c1a");

const MUZZLE_FLASH_DURATION = 0.07;
const RECOIL_RECOVERY = 14;

function Limb({
  length,
  radius,
  color,
}: {
  length: number;
  radius: number;
  color: string;
}) {
  // Cylinder pivoted at its top so rotating the parent group swings it naturally.
  return (
    <mesh castShadow position={[0, -length / 2, 0]}>
      <capsuleGeometry args={[radius, length - radius * 2, 4, 10]} />
      <meshStandardMaterial color={color} roughness={0.55} metalness={0.1} />
    </mesh>
  );
}

export function JesterModel({ anim }: { anim: JesterAnim }) {
  const rootRef = useRef<Group>(null);
  const hatRef = useRef<Group>(null);
  const legLRef = useRef<Group>(null);
  const legRRef = useRef<Group>(null);
  const armLRef = useRef<Group>(null);
  const gunArmRef = useRef<Group>(null);
  const gunRef = useRef<Group>(null);
  const muzzleRef = useRef<Mesh>(null);
  const flameLRef = useRef<Mesh>(null);
  const flameRRef = useRef<Mesh>(null);
  const flameMatL = useRef<MeshBasicMaterial>(null);
  const flameMatR = useRef<MeshBasicMaterial>(null);
  const jetLightRef = useRef<PointLight>(null);
  const recoil = useRef(0);
  const flameColor = useMemo(() => new Color(), []);

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    const root = rootRef.current;
    if (!root) return;

    const vx = anim.localVel.x;
    const vz = anim.localVel.z; // negative = moving forward
    const speedFactor = MathUtils.clamp(anim.localVel.length() / 12, 0, 1);

    // Whole-body attitude: bank into strafes, lean into forward flight,
    // gentle hover bob when idle.
    const targetRoll = MathUtils.clamp(-vx * 0.035, -0.45, 0.45);
    const targetLean = MathUtils.clamp(vz * 0.028, -0.4, 0.25);
    const ease = 1 - Math.exp(-8 * dt);
    root.rotation.z += (targetRoll - root.rotation.z) * ease;
    root.rotation.x += (targetLean - root.rotation.x) * ease;
    root.position.y = Math.sin(t * 1.8) * 0.05 * (1 - speedFactor);

    // Hat flops against the motion, bells and all.
    if (hatRef.current) {
      hatRef.current.rotation.z = -root.rotation.z * 1.6 + Math.sin(t * 2.3) * 0.04;
      hatRef.current.rotation.x = -root.rotation.x * 1.4;
    }

    // Legs trail behind acceleration and scissor gently while moving.
    const legTrail = MathUtils.clamp(-vz * 0.05, -0.3, 0.9);
    const scissor = Math.sin(t * 5) * 0.12 * speedFactor;
    if (legLRef.current) legLRef.current.rotation.x = legTrail + scissor + 0.08;
    if (legRRef.current) legRRef.current.rotation.x = legTrail - scissor + 0.02;

    // Left arm sways; right (gun) arm tracks look pitch.
    if (armLRef.current) {
      armLRef.current.rotation.x = 0.25 + Math.sin(t * 2.1) * 0.06 + legTrail * 0.3;
      armLRef.current.rotation.z = 0.35;
    }
    if (gunArmRef.current) {
      gunArmRef.current.rotation.x =
        -Math.PI / 2 - anim.pitch + recoil.current * 0.4;
    }

    // Muzzle flash + recoil.
    const sinceFire = t - anim.lastFireAt;
    if (sinceFire >= 0 && sinceFire < MUZZLE_FLASH_DURATION) {
      recoil.current = Math.min(1, recoil.current + 0.6);
      if (muzzleRef.current) {
        muzzleRef.current.visible = true;
        muzzleRef.current.rotation.y = Math.sin(anim.lastFireAt * 913) * Math.PI;
        const fl = 1 - sinceFire / MUZZLE_FLASH_DURATION;
        muzzleRef.current.scale.set(fl, fl, 0.6 + fl);
      }
    } else if (muzzleRef.current) {
      muzzleRef.current.visible = false;
    }
    recoil.current = Math.max(0, recoil.current - RECOIL_RECOVERY * dt * recoil.current);
    if (gunRef.current) gunRef.current.position.z = recoil.current * 0.1;

    // Jetpack flames: idle pilot light → full boost columns, with flicker.
    const flicker = 0.85 + Math.sin(t * 47) * 0.08 + Math.sin(t * 31 + 1.7) * 0.07;
    const flameLen = (0.25 + anim.thrust * 1.1 + (anim.boosting ? 0.5 : 0)) * flicker;
    flameColor.copy(FLAME_OUTER).lerp(FLAME_CORE, MathUtils.clamp(anim.thrust + (anim.boosting ? 0.4 : 0), 0, 1));
    for (const [flame, mat] of [
      [flameLRef.current, flameMatL.current],
      [flameRRef.current, flameMatR.current],
    ] as const) {
      if (!flame || !mat) continue;
      flame.scale.set(0.75 + anim.thrust * 0.35, flameLen, 0.75 + anim.thrust * 0.35);
      // Cone pivots at its center — drop it so the base stays at the nozzle
      // mouth (local y = -0.4) while the tip stretches downward.
      flame.position.y = -0.4 - flameLen / 2;
      mat.color.copy(flameColor);
    }
    if (jetLightRef.current) {
      jetLightRef.current.intensity = 1.5 + anim.thrust * 8 + (anim.boosting ? 5 : 0);
    }
  });

  return (
    <group ref={rootRef}>
      {/* ——— head ——— */}
      <group position={[0, 0.62, 0]}>
        {/* face mask */}
        <mesh castShadow>
          <sphereGeometry args={[0.26, 20, 16]} />
          <meshStandardMaterial color={FACE} roughness={0.35} metalness={0.05} />
        </mesh>
        {/* eyes — glowing, mischievous */}
        <mesh position={[-0.1, 0.05, -0.21]}>
          <sphereGeometry args={[0.045, 10, 10]} />
          <meshStandardMaterial color={EYE} emissive={EYE} emissiveIntensity={3} toneMapped={false} />
        </mesh>
        <mesh position={[0.1, 0.05, -0.21]}>
          <sphereGeometry args={[0.045, 10, 10]} />
          <meshStandardMaterial color={EYE} emissive={EYE} emissiveIntensity={3} toneMapped={false} />
        </mesh>
        {/* grin — glowing arc */}
        <mesh position={[0, -0.07, -0.2]} rotation={[0.25, 0, Math.PI]}>
          <torusGeometry args={[0.1, 0.02, 8, 16, Math.PI]} />
          <meshStandardMaterial color={SUIT_ACCENT} emissive={SUIT_ACCENT} emissiveIntensity={2.5} toneMapped={false} />
        </mesh>

        {/* ——— three-point jester hat ——— */}
        <group ref={hatRef} position={[0, 0.12, 0]}>
          {/* brim */}
          <mesh castShadow position={[0, 0.06, 0]}>
            <cylinderGeometry args={[0.27, 0.29, 0.12, 16]} />
            <meshStandardMaterial color={SUIT_DARK} roughness={0.6} />
          </mesh>
          {/* center spike */}
          <group position={[0, 0.12, 0]}>
            <mesh castShadow position={[0, 0.22, 0]} rotation={[0.15, 0, 0]}>
              <coneGeometry args={[0.12, 0.45, 10]} />
              <meshStandardMaterial color={SUIT} roughness={0.55} />
            </mesh>
            <mesh position={[0, 0.46, -0.06]}>
              <sphereGeometry args={[0.055, 10, 10]} />
              <meshStandardMaterial color={GOLD} emissive={GOLD} emissiveIntensity={1.6} metalness={0.7} roughness={0.25} />
            </mesh>
          </group>
          {/* side spikes, drooping */}
          <group position={[-0.14, 0.1, 0]} rotation={[0, 0, 0.85]}>
            <mesh castShadow position={[0, 0.18, 0]}>
              <coneGeometry args={[0.1, 0.4, 10]} />
              <meshStandardMaterial color={SUIT_ACCENT} roughness={0.55} />
            </mesh>
            <mesh position={[0, 0.4, 0]}>
              <sphereGeometry args={[0.05, 10, 10]} />
              <meshStandardMaterial color={GOLD} emissive={GOLD} emissiveIntensity={1.6} metalness={0.7} roughness={0.25} />
            </mesh>
          </group>
          <group position={[0.14, 0.1, 0]} rotation={[0, 0, -0.85]}>
            <mesh castShadow position={[0, 0.18, 0]}>
              <coneGeometry args={[0.1, 0.4, 10]} />
              <meshStandardMaterial color={SUIT_ACCENT} roughness={0.55} />
            </mesh>
            <mesh position={[0, 0.4, 0]}>
              <sphereGeometry args={[0.05, 10, 10]} />
              <meshStandardMaterial color={GOLD} emissive={GOLD} emissiveIntensity={1.6} metalness={0.7} roughness={0.25} />
            </mesh>
          </group>
        </group>

        {/* ruff collar */}
        <mesh position={[0, -0.24, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.2, 0.07, 8, 16]} />
          <meshStandardMaterial color={GOLD} roughness={0.4} metalness={0.5} />
        </mesh>
      </group>

      {/* ——— torso ——— */}
      <mesh castShadow position={[0, 0.1, 0]} scale={[1, 1.25, 0.8]}>
        <sphereGeometry args={[0.32, 20, 16]} />
        <meshStandardMaterial color={SUIT} roughness={0.5} metalness={0.15} />
      </mesh>
      {/* chest plate accent */}
      <mesh castShadow position={[0, 0.18, -0.2]} scale={[0.85, 0.8, 0.5]}>
        <sphereGeometry args={[0.24, 16, 12]} />
        <meshStandardMaterial color={SUIT_DARK} roughness={0.35} metalness={0.45} />
      </mesh>
      {/* belt */}
      <mesh position={[0, -0.22, 0]}>
        <cylinderGeometry args={[0.29, 0.29, 0.09, 16]} />
        <meshStandardMaterial color={SUIT_DARK} roughness={0.4} metalness={0.3} />
      </mesh>
      <mesh position={[0, -0.22, -0.27]}>
        <boxGeometry args={[0.12, 0.1, 0.04]} />
        <meshStandardMaterial color={GOLD} emissive={GOLD} emissiveIntensity={0.8} metalness={0.7} roughness={0.25} />
      </mesh>
      {/* hips */}
      <mesh castShadow position={[0, -0.34, 0]} scale={[0.9, 0.6, 0.75]}>
        <sphereGeometry args={[0.28, 16, 12]} />
        <meshStandardMaterial color={SUIT_DARK} roughness={0.55} />
      </mesh>

      {/* ——— legs (pivot at hip) ——— */}
      <group ref={legLRef} position={[-0.15, -0.42, 0]}>
        <Limb length={0.42} radius={0.09} color={SUIT} />
        <group position={[0, -0.42, 0]} rotation={[0.35, 0, 0]}>
          <Limb length={0.38} radius={0.075} color={SUIT_ACCENT} />
          {/* curled jester boot */}
          <mesh castShadow position={[0, -0.4, -0.08]}>
            <boxGeometry args={[0.14, 0.1, 0.3]} />
            <meshStandardMaterial color={SUIT_DARK} roughness={0.4} metalness={0.2} />
          </mesh>
          <mesh position={[0, -0.36, -0.26]}>
            <sphereGeometry args={[0.045, 8, 8]} />
            <meshStandardMaterial color={GOLD} emissive={GOLD} emissiveIntensity={1.2} metalness={0.7} roughness={0.25} />
          </mesh>
        </group>
      </group>
      <group ref={legRRef} position={[0.15, -0.42, 0]}>
        <Limb length={0.42} radius={0.09} color={SUIT_ACCENT} />
        <group position={[0, -0.42, 0]} rotation={[0.35, 0, 0]}>
          <Limb length={0.38} radius={0.075} color={SUIT} />
          <mesh castShadow position={[0, -0.4, -0.08]}>
            <boxGeometry args={[0.14, 0.1, 0.3]} />
            <meshStandardMaterial color={SUIT_DARK} roughness={0.4} metalness={0.2} />
          </mesh>
          <mesh position={[0, -0.36, -0.26]}>
            <sphereGeometry args={[0.045, 8, 8]} />
            <meshStandardMaterial color={GOLD} emissive={GOLD} emissiveIntensity={1.2} metalness={0.7} roughness={0.25} />
          </mesh>
        </group>
      </group>

      {/* ——— left arm ——— */}
      <group ref={armLRef} position={[-0.36, 0.28, 0]} rotation={[0.25, 0, 0.35]}>
        <mesh castShadow>
          <sphereGeometry args={[0.11, 12, 10]} />
          <meshStandardMaterial color={SUIT_DARK} roughness={0.4} metalness={0.4} />
        </mesh>
        <Limb length={0.36} radius={0.07} color={SUIT_ACCENT} />
        <group position={[0, -0.36, 0]} rotation={[-0.5, 0, 0]}>
          <Limb length={0.32} radius={0.06} color={SUIT} />
          <mesh castShadow position={[0, -0.36, 0]}>
            <sphereGeometry args={[0.08, 10, 8]} />
            <meshStandardMaterial color={FACE} roughness={0.5} />
          </mesh>
        </group>
      </group>

      {/* ——— right arm + gun, aims with pitch ——— */}
      <group position={[0.36, 0.28, 0]}>
        <mesh castShadow>
          <sphereGeometry args={[0.11, 12, 10]} />
          <meshStandardMaterial color={SUIT_DARK} roughness={0.4} metalness={0.4} />
        </mesh>
        <group ref={gunArmRef} rotation={[-Math.PI / 2, 0, 0]}>
          <Limb length={0.34} radius={0.07} color={SUIT} />
          {/* glove */}
          <mesh castShadow position={[0, -0.36, 0]}>
            <sphereGeometry args={[0.085, 10, 8]} />
            <meshStandardMaterial color={SUIT_DARK} roughness={0.45} />
          </mesh>
          {/* the "hidden weapon" — compact SMG, barrel along the arm axis */}
          <group ref={gunRef} position={[0, -0.42, 0.02]}>
            {/* receiver */}
            <mesh castShadow position={[0, -0.1, 0]}>
              <boxGeometry args={[0.11, 0.34, 0.16]} />
              <meshStandardMaterial color={METAL} roughness={0.35} metalness={0.75} />
            </mesh>
            {/* barrel */}
            <mesh castShadow position={[0, -0.34, 0.01]}>
              <cylinderGeometry args={[0.035, 0.035, 0.24, 10]} />
              <meshStandardMaterial color={METAL_LIGHT} roughness={0.3} metalness={0.85} />
            </mesh>
            {/* energy cell glow strip */}
            <mesh position={[0.058, -0.1, 0]}>
              <boxGeometry args={[0.012, 0.22, 0.05]} />
              <meshStandardMaterial color={EYE} emissive={EYE} emissiveIntensity={2.2} toneMapped={false} />
            </mesh>
            {/* muzzle tip */}
            <mesh position={[0, -0.47, 0.01]}>
              <cylinderGeometry args={[0.045, 0.045, 0.04, 10]} />
              <meshStandardMaterial color={GOLD} emissive={GOLD} emissiveIntensity={1} metalness={0.7} roughness={0.3} />
            </mesh>
            {/* muzzle flash — flipped on for a few frames per shot */}
            <mesh ref={muzzleRef} visible={false} position={[0, -0.58, 0.01]} rotation={[Math.PI, 0, 0]}>
              <coneGeometry args={[0.12, 0.35, 8]} />
              <meshBasicMaterial
                color="#ffd786"
                transparent
                opacity={0.95}
                blending={AdditiveBlending}
                depthWrite={false}
                toneMapped={false}
              />
            </mesh>
          </group>
        </group>
      </group>

      {/* ——— jetpack ——— */}
      <group position={[0, 0.12, 0.3]}>
        <mesh castShadow>
          <boxGeometry args={[0.4, 0.5, 0.18]} />
          <meshStandardMaterial color={METAL} roughness={0.35} metalness={0.8} />
        </mesh>
        {/* core glow */}
        <mesh position={[0, 0.05, 0.1]}>
          <boxGeometry args={[0.16, 0.2, 0.02]} />
          <meshStandardMaterial color={GOLD} emissive={GOLD} emissiveIntensity={1.8} toneMapped={false} />
        </mesh>
        {/* nozzles */}
        {[-0.13, 0.13].map((x) => (
          <group key={x} position={[x, -0.3, 0]}>
            <mesh castShadow>
              <cylinderGeometry args={[0.07, 0.1, 0.18, 10]} />
              <meshStandardMaterial color={METAL_LIGHT} roughness={0.3} metalness={0.85} />
            </mesh>
          </group>
        ))}
        {/* flames — cone pivot at nozzle mouth, stretches downward with thrust */}
        <mesh ref={flameLRef} position={[-0.13, -0.4, 0]} rotation={[Math.PI, 0, 0]} scale={[0.75, 0.3, 0.75]}>
          <coneGeometry args={[0.09, 1, 8, 1, true]} />
          <meshBasicMaterial
            ref={flameMatL}
            color="#ff8c1a"
            transparent
            opacity={0.85}
            blending={AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
        <mesh ref={flameRRef} position={[0.13, -0.4, 0]} rotation={[Math.PI, 0, 0]} scale={[0.75, 0.3, 0.75]}>
          <coneGeometry args={[0.09, 1, 8, 1, true]} />
          <meshBasicMaterial
            ref={flameMatR}
            color="#ff8c1a"
            transparent
            opacity={0.85}
            blending={AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
        <pointLight ref={jetLightRef} position={[0, -0.7, 0]} color="#ff9a33" intensity={2} distance={7} decay={2} />
      </group>
    </group>
  );
}
