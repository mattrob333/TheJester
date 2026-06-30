import type { HazardConfig } from "../../types";
import { RazorHazard } from "./RazorHazard";
import { CrusherHazard } from "./CrusherHazard";
import { LaserHazard } from "./LaserHazard";

/** Renders one hazard component per config entry, dispatched by `type`. */
export function HazardField({ hazards }: { hazards: HazardConfig[] }) {
  return (
    <group>
      {hazards.map((hazard, i) => {
        switch (hazard.type) {
          case "razor":
            return <RazorHazard key={i} config={hazard} />;
          case "crusher":
            return <CrusherHazard key={i} config={hazard} />;
          case "laser":
            return <LaserHazard key={i} config={hazard} />;
          default:
            return null;
        }
      })}
    </group>
  );
}
