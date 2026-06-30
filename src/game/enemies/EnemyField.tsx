import type { EnemyConfig } from "../types";
import { ArenaGuard } from "./ArenaGuard";

/** Renders one enemy component per config entry, dispatched by `type`. Same dispatch pattern as HazardField.tsx. */
export function EnemyField({ enemies }: { enemies: EnemyConfig[] }) {
  return (
    <group>
      {enemies.map((enemy, i) => {
        switch (enemy.type) {
          case "arena-guard":
            return <ArenaGuard key={i} config={enemy} />;
          default:
            return null;
        }
      })}
    </group>
  );
}
