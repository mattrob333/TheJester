import { useMemo } from "react";
import { RigidBody, CuboidCollider } from "@react-three/rapier";
import type { ArenaBounds } from "../types";

/**
 * Arena bounds (Ticket 1.3 collision, made data-driven in Ticket 2.1).
 *
 * Four walls + a ceiling, centered at the world origin, sized from
 * `config.bounds`. Visual upgrade: the walls are now solid industrial
 * panels with vertical support ribs and two glowing trim lines, so the
 * arena reads as a built place instead of a translucent box. The ceiling
 * stays invisible (collider only) so the starfield shows through.
 */

const WALL_COLOR = "#131a2b";
const RIB_COLOR = "#27334d";
const TRIM_COLOR = "#7c3aed";
const TRIM_COLOR_2 = "#22d3ee";

function Wall({
  position,
  args,
  rotationY = 0,
  span,
  height,
  inward,
}: {
  position: [number, number, number];
  args: [number, number, number];
  rotationY?: number;
  /** Wall's horizontal length (for rib placement). */
  span: number;
  height: number;
  /** Which local-Z side faces the arena interior (ribs/trim mount there). */
  inward: 1 | -1;
}) {
  const ribs = useMemo(() => {
    const list: number[] = [];
    const step = 10;
    for (let x = -span / 2 + step / 2; x < span / 2; x += step) list.push(x);
    return list;
  }, [span]);

  return (
    <RigidBody type="fixed" colliders={false} position={position}>
      <CuboidCollider args={args} />
      <group rotation={[0, rotationY, 0]}>
        {/* main panel */}
        <mesh receiveShadow>
          <boxGeometry args={[span, height, 0.5]} />
          <meshStandardMaterial color={WALL_COLOR} roughness={0.55} metalness={0.6} />
        </mesh>
        {/* vertical support ribs */}
        {ribs.map((x) => (
          <mesh key={x} position={[x, 0, inward * 0.3]}>
            <boxGeometry args={[0.6, height, 0.25]} />
            <meshStandardMaterial color={RIB_COLOR} roughness={0.4} metalness={0.75} />
          </mesh>
        ))}
        {/* glowing trim lines */}
        <mesh position={[0, -height / 2 + 1.4, inward * 0.29]}>
          <boxGeometry args={[span - 0.5, 0.12, 0.06]} />
          <meshStandardMaterial
            color={TRIM_COLOR}
            emissive={TRIM_COLOR}
            emissiveIntensity={1.2}
            toneMapped={false}
          />
        </mesh>
        <mesh position={[0, height / 2 - 2.5, inward * 0.29]}>
          <boxGeometry args={[span - 0.5, 0.12, 0.06]} />
          <meshStandardMaterial
            color={TRIM_COLOR_2}
            emissive={TRIM_COLOR_2}
            emissiveIntensity={0.9}
            toneMapped={false}
          />
        </mesh>
      </group>
    </RigidBody>
  );
}

export function Bounds({ width, height, depth }: ArenaBounds) {
  const hw = width / 2;
  const hh = height / 2;
  const hd = depth / 2;
  const t = 0.25; // wall thickness (half-extent)

  return (
    <group>
      {/* +X / -X end walls */}
      <Wall
        position={[hw, hh, 0]}
        args={[t, hh, hd]}
        rotationY={Math.PI / 2}
        span={depth}
        height={height}
        inward={-1}
      />
      <Wall
        position={[-hw, hh, 0]}
        args={[t, hh, hd]}
        rotationY={Math.PI / 2}
        span={depth}
        height={height}
        inward={1}
      />
      {/* +Z / -Z side walls */}
      <Wall position={[0, hh, hd]} args={[hw, hh, t]} span={width} height={height} inward={-1} />
      <Wall position={[0, hh, -hd]} args={[hw, hh, t]} span={width} height={height} inward={1} />
      {/* ceiling — collider only, keeps the sky visible */}
      <RigidBody type="fixed" colliders={false} position={[0, height, 0]}>
        <CuboidCollider args={[hw, t, hd]} />
      </RigidBody>
    </group>
  );
}
