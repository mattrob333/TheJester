import { RigidBody, CuboidCollider } from "@react-three/rapier";
import { DoubleSide } from "three";

/**
 * Simple static test-box bounds (Ticket 1.3 — collision).
 *
 * Four walls + a ceiling around the dev floor so flying into geometry has
 * something to collide with. Rendered as faint translucent panels so the
 * boundary reads visually without occluding the scene. Real arena geometry
 * (from config) arrives in Phase 2 — this is just the Phase 1 proving ground.
 */

const WIDTH = 60;
const HEIGHT = 24;
const DEPTH = 60;

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

export function Bounds() {
  const hw = WIDTH / 2;
  const hh = HEIGHT / 2;
  const hd = DEPTH / 2;
  const t = 0.25; // wall thickness (half-extent)

  return (
    <group>
      <Wall position={[hw, hh, 0]} args={[t, hh, hd]} />
      <Wall position={[-hw, hh, 0]} args={[t, hh, hd]} />
      <Wall position={[0, hh, hd]} args={[hw, hh, t]} />
      <Wall position={[0, hh, -hd]} args={[hw, hh, t]} />
      <Wall position={[0, HEIGHT, 0]} args={[hw, t, hd]} />
    </group>
  );
}
