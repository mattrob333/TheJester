import { RigidBody, CuboidCollider } from "@react-three/rapier";
import { DoubleSide } from "three";
import type { ArenaBounds } from "../types";

/**
 * Arena bounds (Ticket 1.3 collision, made data-driven in Ticket 2.1).
 *
 * Four walls + a ceiling, centered at the world origin, sized from
 * `config.bounds`. Rendered as faint translucent panels so the boundary
 * reads visually without occluding the scene.
 */

function Wall({
  position,
  args,
}: {
  position: [number, number, number];
  args: [number, number, number];
}) {
  return (
    <RigidBody type="fixed" colliders={false} position={position}>
      <CuboidCollider args={args} />
      <mesh>
        <boxGeometry args={[args[0] * 2, args[1] * 2, args[2] * 2]} />
        <meshStandardMaterial
          color="#1e293b"
          transparent
          opacity={0.1}
          side={DoubleSide}
          depthWrite={false}
        />
      </mesh>
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
      <Wall position={[hw, hh, 0]} args={[t, hh, hd]} />
      <Wall position={[-hw, hh, 0]} args={[t, hh, hd]} />
      <Wall position={[0, hh, hd]} args={[hw, hh, t]} />
      <Wall position={[0, hh, -hd]} args={[hw, hh, t]} />
      <Wall position={[0, height, 0]} args={[hw, t, hd]} />
    </group>
  );
}
