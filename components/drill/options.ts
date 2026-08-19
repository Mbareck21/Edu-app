/**
 * Drill settings: the small vocabulary shared by the setup screens, the URLs
 * they build and the pages that read those URLs back.
 *
 * Pure and dependency-free on purpose — both a server page and a "use client"
 * setup card import it, so it must never pull Mongoose in.
 */

import type { Level } from "@/lib/math/types";

/* ------------------------------------------------------------------ *
 * Vocab drills
 * ------------------------------------------------------------------ */

export const VOCAB_MODES = [
  "flashcards",
  "match",
  "listen",
  "spell",
  "use",
  "write",
  "remember",
  "mixed",
] as const;

export type VocabMode = (typeof VOCAB_MODES)[number];

export function isVocabMode(value: string): value is VocabMode {
  return (VOCAB_MODES as readonly string[]).includes(value);
}

/** Short, Grade-3 labels for the mode chips. */
export const VOCAB_MODE_LABEL: Record<VocabMode, string> = {
  flashcards: "Cards",
  match: "Match",
  listen: "Listen",
  spell: "Spell",
  use: "Use",
  write: "Spelling test",
  remember: "Remember",
  mixed: "Mixed",
};

/** One line under the mode row, so he knows what he picked. */
export const VOCAB_MODE_BLURB: Record<VocabMode, string> = {
  flashcards: "Flip a card. Easy or hard.",
  match: "Read the meaning. Pick the word.",
  listen: "Hear the word. Pick it.",
  spell: "Build or type the word.",
  use: "Put the word in a sentence.",
  write: "Hear it, then write it. No help.",
  remember: "90 seconds. Write every word you remember.",
  mixed: "A bit of everything.",
};

/** Modes that need one list, not a pile of words from everywhere. */
export function needsOneList(mode: VocabMode): boolean {
  return mode === "remember";
}

export const DRILL_LENGTHS = [10, 20, 40] as const;
export type DrillLength = (typeof DRILL_LENGTHS)[number];

export function parseLength(value: string | undefined): DrillLength {
  const n = Number(value);
  return (DRILL_LENGTHS as readonly number[]).includes(n) ? (n as DrillLength) : 10;
}

export type DrillSource =
  | { kind: "all" }
  | { kind: "weak" }
  | { kind: "due" }
  | { kind: "list"; listId: string };

/** "all" | "weak" | "due" | "list:<id>" */
export function parseSource(value: string | undefined): DrillSource {
  if (!value) return { kind: "all" };
  if (value === "weak" || value === "due" || value === "all") return { kind: value };
  if (value.startsWith("list:")) {
    const listId = value.slice(5);
    if (listId) return { kind: "list", listId };
  }
  return { kind: "all" };
}

export function sourceParam(source: DrillSource): string {
  return source.kind === "list" ? `list:${source.listId}` : source.kind;
}

/** Leave `seed` out for a base URL the runner can re-seed on "Again". */
export function vocabHref(opts: {
  source: DrillSource;
  mode: VocabMode;
  count: number;
  seed?: number;
}): string {
  const q = new URLSearchParams({
    src: sourceParam(opts.source),
    mode: opts.mode,
    n: String(opts.count),
  });
  if (opts.seed !== undefined) q.set("seed", String(opts.seed));
  return `/drill/vocab?${q.toString()}`;
}

/* ------------------------------------------------------------------ *
 * Math drills
 * ------------------------------------------------------------------ */

export const MATH_MODES = ["relaxed", "t60", "t120"] as const;
export type MathMode = (typeof MATH_MODES)[number];

export const MATH_MODE_LABEL: Record<MathMode, string> = {
  relaxed: "Relaxed",
  t60: "Timed 60s",
  t120: "Timed 120s",
};

export function isMathMode(value: string): value is MathMode {
  return (MATH_MODES as readonly string[]).includes(value);
}

export function parseMathMode(value: string | undefined): MathMode {
  return value && isMathMode(value) ? value : "relaxed";
}

/** Seconds on the clock, or null when the drill is untimed. */
export function timedSeconds(mode: MathMode): number | null {
  if (mode === "t60") return 60;
  if (mode === "t120") return 120;
  return null;
}

export type LevelChoice = Level | "auto";

export function parseLevelChoice(value: string | undefined): LevelChoice {
  if (value === "1" || value === "2" || value === "3") return Number(value) as Level;
  return "auto";
}

export const MIXED_SKILL = "mixed";

/** Leave `seed` out for a base URL the runner can re-seed on "Again". */
export function mathHref(opts: {
  skill: string;
  level: LevelChoice;
  count: number;
  mode: MathMode;
  seed?: number;
}): string {
  const q = new URLSearchParams({
    skill: opts.skill,
    level: String(opts.level),
    n: String(opts.count),
    mode: opts.mode,
  });
  if (opts.seed !== undefined) q.set("seed", String(opts.seed));
  return `/drill/math?${q.toString()}`;
}

/**
 * Activity ref for one math drill.
 *
 * Timed drills append `#<correct>`: `Profile.activity` keeps `pct` but not the
 * number answered, and "as many as you can" is a count, not a percentage. The
 * ref is the only field that survives, so the score rides in it. Refs are never
 * shown anywhere — /me only reads `at` off them.
 */
export function mathDrillRef(skill: string, mode: MathMode, correct?: number): string {
  const base = `drill:math:${skill}:${mode}`;
  return mode === "relaxed" || correct === undefined ? base : `${base}#${correct}`;
}

export type ActivityLike = { ref: string; pct: number };

/**
 * Best score for one skill + mode: the count for timed drills, the percentage
 * for relaxed ones. `null` when it was never played.
 */
export function bestDrillScore(
  activity: readonly ActivityLike[],
  skill: string,
  mode: MathMode
): number | null {
  const base = `drill:math:${skill}:${mode}`;
  let best: number | null = null;
  for (const entry of activity) {
    if (entry.ref !== base && !entry.ref.startsWith(`${base}#`)) continue;
    const hash = entry.ref.indexOf("#");
    const score = mode === "relaxed" ? entry.pct : hash < 0 ? 0 : Number(entry.ref.slice(hash + 1));
    if (!Number.isFinite(score)) continue;
    if (best === null || score > best) best = score;
  }
  return best;
}

/** "Best 14" / "Best 90%" / "" */
export function bestLabel(score: number | null, mode: MathMode): string {
  if (score === null) return "";
  return mode === "relaxed" ? `Best ${score}%` : `Best ${score} right`;
}
