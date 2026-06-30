import { useEffect } from "react";
import type { ArenaConfig, Vec3 } from "../types";
import arena01 from "../config/arenas/arena-01.json";

/**
 * Arena loader STUB (sets up data-driven content).
 *
 * Phase 0: read an arena config, log it, and render debug markers at `spawn`
 * (green) and `exit` (red). No hazard/enemy/checkpoint spawning yet — those are
 * Phases 2 and 4.
 */

// JSON imports widen tuples to number[]; assert the validated shape via unknown.
const arena = arena01 as unknown as ArenaConfig;

function Marker({ pos, color }: { pos: Vec3; color: string }) {
  return (
    <mesh position={pos} castShadow>
      <sphereGeometry args={[0.5, 16, 16]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.6}
      />
    </mesh>
  );
}

export function ArenaLoader({ config = arena }: { config?: ArenaConfig }) {
  useEffect(() => {
    // Prove the data-driven load works end-to-end.
    console.info("[ArenaLoader] loaded arena:", config);
  }, [config]);

  return (
    <group>
      {/* spawn — green */}
      <Marker pos={config.spawn} color="#22c55e" />
      {/* exit — red */}
      <Marker pos={config.exit} color="#ef4444" />
    </group>
  );
}
