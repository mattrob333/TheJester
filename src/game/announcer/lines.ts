import lines from "../config/announcer/lines.json";

/**
 * Ticket 5.1 — Bark system.
 *
 * Data-driven announcer line lookup. Per the project's guiding principle of
 * data-driven content (consistent with how arenas are configured), bark text
 * lives in JSON rather than hardcoded strings, so writers/designers can edit
 * `lines.json` without touching code.
 *
 * `arena-01.json`'s `announcer` field references bark ids by string (e.g.
 * `intro: "arena01_intro"`); this module resolves those ids to display text.
 *
 * Ticket 5.2 (character arc flag) will extend this to select between line
 * sets keyed by `storyProgress` — kept as a flat id->text map for now since
 * no second line set exists yet (YAGNI).
 */
const BARK_LINES: Record<string, string> = lines;

/** Resolve a bark id to its display text. Returns undefined for unknown ids. */
export function getBarkLine(id: string): string | undefined {
  return BARK_LINES[id];
}
