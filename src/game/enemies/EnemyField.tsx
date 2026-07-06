import type { EnemyConfig } from "../types";
import { ArenaGuard } from "./ArenaGuard";
import { SecurityDrone } from "./SecurityDrone";

/** Renders one enemy component per config entry, dispatched by `type`. Same dispatch pattern as HazardField.tsx. */
export function EnemyField({ enemies }: { enemies: EnemyConfig[] }) {
  return (
    <group>
      {enemies.map((enemy) => {
        // Stable identity (type + spawn pos), not array index — safe for
        // runtime spawn/despawn later (code-review §2.6).
        const key = `${enemy.type}@${enemy.pos.join(",")}`;
        switch (enemy.type) {
          case "arena-guard":
            return <ArenaGuard key={key} config={enemy} />;
          case "security-drone":
            return <SecurityDrone key={key} config={enemy} />;
          default:
            return null;
        }
      })}
    </group>
  );
}
