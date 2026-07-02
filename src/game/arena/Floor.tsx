import { Grid } from "@react-three/drei";
import { RigidBody, CuboidCollider } from "@react-three/rapier";

/**
 * Static ground with a matching physics body, sized to the arena's footprint.
 * Visual: brushed dark-metal deck with an emissive runway strip pointing at
 * the exit, edge trim glow, and a subtle engineering grid on top.
 */
export function Floor({ width, depth }: { width: number; depth: number }) {
  return (
    <RigidBody type="fixed" colliders={false}>
      <CuboidCollider args={[width / 2, 0.1, depth / 2]} position={[0, -0.1, 0]} />

      {/* metal deck */}
      <mesh receiveShadow position={[0, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color="#0d1220" roughness={0.45} metalness={0.75} />
      </mesh>

      {/* runway strip toward the exit (arena long axis = X) */}
      <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width * 0.96, 1.1]} />
        <meshStandardMaterial
          color="#7c3aed"
          emissive="#7c3aed"
          emissiveIntensity={0.55}
          roughness={0.4}
          metalness={0.3}
          toneMapped={false}
        />
      </mesh>

      {/* edge trim glow, all four sides */}
      {(
        [
          [0, depth / 2 - 0.35, width - 0.6, 0.22],
          [0, -(depth / 2 - 0.35), width - 0.6, 0.22],
        ] as const
      ).map(([x, z, w, h], i) => (
        <mesh key={`h${i}`} position={[x, 0.004, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[w, h]} />
          <meshStandardMaterial
            color="#22d3ee"
            emissive="#22d3ee"
            emissiveIntensity={0.8}
            toneMapped={false}
          />
        </mesh>
      ))}
      {(
        [
          [width / 2 - 0.35, 0, 0.22, depth - 0.6],
          [-(width / 2 - 0.35), 0, 0.22, depth - 0.6],
        ] as const
      ).map(([x, z, w, d], i) => (
        <mesh key={`v${i}`} position={[x, 0.004, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[w, d]} />
          <meshStandardMaterial
            color="#22d3ee"
            emissive="#22d3ee"
            emissiveIntensity={0.8}
            toneMapped={false}
          />
        </mesh>
      ))}

      {/* engineering grid overlay */}
      <Grid
        args={[width, depth]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#1c2740"
        sectionSize={10}
        sectionThickness={1.1}
        sectionColor="#3b4f8a"
        fadeDistance={130}
        fadeStrength={1}
        followCamera={false}
        position={[0, 0.01, 0]}
      />
    </RigidBody>
  );
}
