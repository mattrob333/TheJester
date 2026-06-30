import { Component, Suspense, type ReactNode } from "react";
import { RigidBody, CapsuleCollider } from "@react-three/rapier";
import { loadGltf } from "../../lib/loadGltf";

/**
 * Placeholder player.
 *
 * Phase 0: a capsule mesh + a STATIC ("fixed") Rapier body. No flight, no
 * movement, no input — that arrives in Ticket 1.1.
 *
 * Asset slot: if `public/models/player.glb` exists it is loaded via the
 * `loadGltf` pipeline helper and rendered in place of the capsule; otherwise we
 * fall back to the primitive capsule below. The GLTF path is real (it suspends
 * + auto-detects via the error boundary), so dropping a glb in activates it.
 */

const PLAYER_MODEL_URL = "/models/player.glb";

// Capsule dimensions shared by the visual mesh and the physics collider.
const RADIUS = 0.5;
const HALF_HEIGHT = 0.6; // cylinder half-height (excludes the two caps)

function CapsuleVisual() {
  return (
    <mesh castShadow position={[0, 0, 0]}>
      <capsuleGeometry args={[RADIUS, HALF_HEIGHT * 2, 8, 16]} />
      <meshStandardMaterial color="#c026d3" roughness={0.4} metalness={0.1} />
    </mesh>
  );
}

function PlayerModel() {
  const { scene } = loadGltf(PLAYER_MODEL_URL);
  return <primitive object={scene} />;
}

/** Falls back to children's fallback if the glb fails to load (e.g. 404). */
class ModelBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function Player() {
  return (
    <RigidBody type="fixed" colliders={false} position={[0, 1.1, 0]}>
      <CapsuleCollider args={[HALF_HEIGHT, RADIUS]} />
      <ModelBoundary fallback={<CapsuleVisual />}>
        <Suspense fallback={<CapsuleVisual />}>
          <PlayerModel />
        </Suspense>
      </ModelBoundary>
    </RigidBody>
  );
}
