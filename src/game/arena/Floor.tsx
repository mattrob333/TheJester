import { Grid } from "@react-three/drei";
import { RigidBody, CuboidCollider } from "@react-three/rapier";

/** Static ground with a matching physics body, sized to the arena's footprint. */
export function Floor({ width, depth }: { width: number; depth: number }) {
  return (
    <RigidBody type="fixed" colliders={false}>
      <CuboidCollider args={[width / 2, 0.1, depth / 2]} position={[0, -0.1, 0]} />
      <Grid
        args={[width, depth]}
        cellSize={1}
        cellThickness={0.6}
        cellColor="#1f2937"
        sectionSize={10}
        sectionThickness={1.2}
        sectionColor="#3b82f6"
        fadeDistance={120}
        fadeStrength={1}
        followCamera={false}
      />
    </RigidBody>
  );
}
