import lines from "../config/announcer/lines.json";
import type { StoryProgress } from "../systems/gameState";

/**
 * Ticket 5.1 — Bark system. Extended in Ticket 5.2 (character arc flag).
 *
 * Data-driven announcer line lookup. Per the project's guiding principle of
 * data-driven content (consistent with how arenas are configured), bark text
 * lives in JSON rather than hardcoded strings, so writers/designers can edit
 * `lines.json` without touching code.
 *
 * `arena-01.json`'s `announcer` field references bark ids by string (e.g.
 * `intro: "arena01_intro"`); this module resolves those ids to display text.
 *
 * **Ticket 5.2:** `lines.json` is now nested by `storyProgress` tier
 * (`believer` | `doubter` | `ally`), each a flat id->text map. `believer` is
 * the default/fallback tier — it must define every bark id used anywhere in
 * the game. `doubter`/`ally` only need to define the ids whose *text* should
 * change for that tier; any id missing from the active tier falls back to
 * the `believer` text for that id. This keeps existing arena configs and
 * bark ids working unchanged while letting later tiers override only the
 * lines that should read differently as the story progresses.
 */
const TIERED_LINES = lines as Record<string, Record<string, string>>;

const DEFAULT_TIER: StoryProgress = "believer";

/**
 * Resolve a bark id to its display text for the given story tier (defaults
 * to "believer" if omitted). Falls back to the believer-tier text if the
 * active tier has no override for this id. Returns undefined for unknown
 * ids (not present in any tier).
 */
export function getBarkLine(
  id: string,
  tier: StoryProgress = DEFAULT_TIER,
): string | undefined {
  const tierOverride = TIERED_LINES[tier]?.[id];
  if (tierOverride !== undefined) return tierOverride;
  return TIERED_LINES[DEFAULT_TIER]?.[id];
}
