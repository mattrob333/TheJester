import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
  Color,
  InstancedMesh,
  Object3D,
  type PointLight,
} from "three";
import { MAX_PARTICLES, particles, lightFlashes } from "./effects";

/**
 * Renders every live particle from the effects module through a single
 * additive instanced mesh (fade-out = instance color → black), plus a small
 * pool of point lights for explosion flashes. Mount once inside the scene.
 */
export function Effects() {
  const meshRef = useRef<InstancedMesh>(null);
  const lightRefs = useRef<(PointLight | null)[]>([null, null, null]);
  const dummy = useMemo(() => new Object3D(), []);
  const fadedColor = useMemo(() => new Color(), []);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20); // clamp tab-switch spikes

    // --- simulate + render particles ---
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        particles.splice(i, 1);
        continue;
      }
      p.velocity.y += p.gravity * dt;
      p.velocity.multiplyScalar(Math.pow(p.drag, dt));
      p.position.addScaledVector(p.velocity, dt);
    }

    const mesh = meshRef.current;
    if (mesh) {
      const count = Math.min(particles.length, MAX_PARTICLES);
      for (let i = 0; i < count; i++) {
        const p = particles[i];
        const t = 1 - p.life / p.maxLife; // 1 → 0 over lifetime
        dummy.position.copy(p.position);
        const s = p.size * (0.4 + 0.6 * t);
        dummy.scale.set(s, s, s);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        // Additive blending: fading toward black fades the particle out.
        fadedColor.copy(p.color).multiplyScalar(t * t);
        mesh.setColorAt(i, fadedColor);
      }
      mesh.count = count;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }

    // --- light flashes (pooled) ---
    for (let i = lightFlashes.length - 1; i >= 0; i--) {
      lightFlashes[i].life += dt;
      if (lightFlashes[i].life >= lightFlashes[i].maxLife) lightFlashes.splice(i, 1);
    }
    for (let li = 0; li < lightRefs.current.length; li++) {
      const light = lightRefs.current[li];
      if (!light) continue;
      const flash = lightFlashes[lightFlashes.length - 1 - li];
      if (!flash) {
        light.intensity = 0;
        continue;
      }
      const t = 1 - flash.life / flash.maxLife;
      light.position.copy(flash.position);
      light.color.copy(flash.color);
      light.intensity = flash.intensity * t * t;
    }
  });

  return (
    <group>
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, MAX_PARTICLES]}
        frustumCulled={false}
      >
        <sphereGeometry args={[1, 6, 6]} />
        <meshBasicMaterial
          color="#ffffff"
          blending={AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </instancedMesh>
      {[0, 1, 2].map((i) => (
        <pointLight
          key={i}
          ref={(el) => {
            lightRefs.current[i] = el;
          }}
          intensity={0}
          distance={22}
          decay={2}
        />
      ))}
    </group>
  );
}
