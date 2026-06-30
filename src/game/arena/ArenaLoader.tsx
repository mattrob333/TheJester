import { useEffect } from "react";
import type { ArenaConfig, Vec3 } from "../types";
import { activeArena } from "../config/activeArena";
import { Floor } from "./Floor";
import { Bounds } from "./Bounds";
import { HazardField } from "./hazards/HazardField";
import { CheckpointZone } from "./CheckpointZone";
import { TargetDummy } from "../combat/TargetDummy";
import { SmokeZones } from "./SmokeZone";

/**
 * Arena loader (Ticket 2.1) — builds the level from a JSON config: floor,
 * walls, hazards, checkpoints, and spawn/exit markers. Editing the config
 * moves all of it. Must be rendered inside <Physics> — floor/walls/hazards
 * are all Rapier bodies.
 */

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

export function ArenaLoader({ config = activeArena }: { config?: ArenaConfig }) {
  useEffect(() => {
    // Prove the data-driven load works end-to-end.
    console.info("[ArenaLoader] loaded arena:", config);
  }, [config]);

  return (
    <group>
      <Floor width={config.bounds.width} depth={config.bounds.depth} />
      <Bounds {...config.bounds} />

      <HazardField hazards={config.hazards} />
      <SmokeZones zones={config.smokeZones} />

      {config.dummies.map((dummy, i) => (
        <TargetDummy key={i} config={dummy} />
      ))}

      {config.checkpoints.map((pos, i) => (
        <CheckpointZone key={i} pos={pos} />
      ))}

      {/* spawn — green */}
      <Marker pos={config.spawn} color="#22c55e" />
      {/* exit — red */}
      <Marker pos={config.exit} color="#ef4444" />
    </group>
  );
}
