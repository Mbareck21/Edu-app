// The Drill tab's "Suggested for you": one tap to the drill that helps most,
// turning between words and math so free practice stays varied. The boys
// still pick anything they like below it. Pure: no React, no Mongo.

import {
  MATH_MODES,
  MATH_MODE_LABEL,
  VOCAB_MODE_LABEL,
  mathHref,
  vocabHref,
  type DrillSource,
  type MathMode,
  type VocabMode,
} from "@/components/drill/options";
import { mulberry32 } from "@/lib/math/rng";
import { todayKey } from "@/lib/day";
import { MATH_SKILLS } from "@/lib/math";

export type SkillSeen = {
  id: string;
  name: string;
  /** Newest first, 0..100. */
  recentPcts: number[];
  /** ISO, or null when never played. */
  lastAt: string | null;
};

export type Suggestion = {
  kind: "words" | "math";
  title: string;
  line: string;
  href: string;
};

/** A score under this is a skill that is slipping. */
const SLIPPING_PCT = 80;

/** The math skill most worth a drill: slipping first, then the longest unplayed. */
export function weakestSkill(skills: readonly SkillSeen[]): { skill: SkillSeen; why: string } | null {
  if (skills.length === 0) return null;
  const slipping = skills
    .filter((s) => s.recentPcts.length > 0 && s.recentPcts[0] < SLIPPING_PCT)
    .sort((a, b) => a.recentPcts[0] - b.recentPcts[0]);
  if (slipping[0]) return { skill: slipping[0], why: `Last time ${slipping[0].recentPcts[0]}%. Beat it!` };
  const stalest = [...skills].sort((a, b) => (a.lastAt ?? "").localeCompare(b.lastAt ?? ""))[0];
  return { skill: stalest, why: stalest.lastAt ? "Not practised for a while" : "Not tried yet" };
}

/**
 * Word drill types the suggestion turns through. Not remember: it drills one
 * whole list and would ignore the words picked.
 */
export const SUGGESTED_WORD_MODES: readonly VocabMode[] = [
  "match",
  "listen",
  "spell",
  "use",
  "mixed",
  "flashcards",
  "write",
  "rescue",
];

/** One of `options`, picked by `seed`: the shuffle among equals. */
function shuffledPick<T>(options: readonly T[], seed: number): T {
  const rng = mulberry32(Math.abs(Math.floor(seed)) % 2147483647 || 1);
  return options[Math.floor(rng() * options.length) % options.length];
}

/**
 * The word drill type played least today; among those, a shuffled one, so
 * the order is new each time rather than Match, Listen, Spell… every day.
 */
export function nextWordMode(
  todayRefs: readonly string[],
  modes: readonly VocabMode[] = SUGGESTED_WORD_MODES,
  seed = 1
): VocabMode {
  const plays = (mode: VocabMode) => todayRefs.filter((r) => r === `drill:vocab:${mode}`).length;
  const fewest = Math.min(...modes.map(plays));
  return shuffledPick(
    modes.filter((m) => plays(m) === fewest),
    seed
  );
}

/**
 * Relaxed or timed: the mode played least today across math drills, shuffled
 * among equals. A slipping skill is drilled relaxed: speed comes after
 * getting it right.
 */
export function nextMathMode(todayRefs: readonly string[], slipping: boolean, seed = 1): MathMode {
  if (slipping) return "relaxed";
  const plays = (mode: MathMode) =>
    todayRefs.filter((r) => r.startsWith("drill:math:") && r.split("#")[0].endsWith(`:${mode}`)).length;
  const fewest = Math.min(...MATH_MODES.map(plays));
  return shuffledPick(
    MATH_MODES.filter((m) => plays(m) === fewest),
    seed
  );
}

/**
 * The skills drilled the fewest times today. Once every skill had been
 * drilled it fell back to all of them, and the weakest was the same slipping
 * skill every time: fractions forty times in a row.
 */
function leastDrilledToday(skills: readonly SkillSeen[], todayRefs: readonly string[]): readonly SkillSeen[] {
  const times = (s: SkillSeen) => todayRefs.filter((r) => r.startsWith(`drill:math:${s.id}:`)).length;
  const fewest = Math.min(...skills.map(times));
  return skills.filter((s) => times(s) === fewest);
}

/**
 * Words when there are words to drill and no word drill yet today, otherwise
 * math; after both, whichever was drilled less today. The words are the weak
 * ones, else the ones due, else the ones still to learn today: with no weak
 * word it used to be math every time, and the words were never drilled.
 */
export function suggestDrill(opts: {
  weakWords: number;
  /** Words due for review now, and words still to do today (the All chip). */
  dueWords?: number;
  toGoWords?: number;
  /** Word drill types that can fix the weak words (modesFor). Default: all. */
  wordModes?: readonly VocabMode[];
  skills: readonly SkillSeen[];
  /** Refs of the sessions played today. */
  todayRefs: readonly string[];
  /** Seeds the drill's own questions. */
  seed: number;
  /** Seeds the shuffle among equally good picks. Default: `seed`. */
  pickSeed?: number;
}): Suggestion | null {
  const pickSeed = opts.pickSeed ?? opts.seed;
  const wordDrills = opts.todayRefs.filter((r) => r.startsWith("drill:vocab")).length;
  const mathDrills = opts.todayRefs.filter((r) => r.startsWith("drill:math")).length;
  const math = weakestSkill(leastDrilledToday(opts.skills, opts.todayRefs));
  const words = wordPick(opts);
  const wordsFirst = words !== null && (wordDrills === 0 || !math || wordDrills <= mathDrills);

  if (wordsFirst || !math) {
    if (!words) return null;
    // The weak-skill types only fix weak words; due and new words get every type.
    // Rescue needs several words that make fair puzzles, so not on a handful of weak ones.
    const modes =
      words.source.kind === "weak"
        ? (opts.wordModes ?? SUGGESTED_WORD_MODES).filter((m) => m !== "rescue")
        : SUGGESTED_WORD_MODES;
    const mode = nextWordMode(opts.todayRefs, modes, pickSeed);
    return {
      kind: "words",
      title: `${words.title} · ${VOCAB_MODE_LABEL[mode]}`,
      line: words.line,
      href: vocabHref({ source: words.source, mode, count: 10, seed: opts.seed }),
    };
  }
  const slipping = math.skill.recentPcts.length > 0 && math.skill.recentPcts[0] < SLIPPING_PCT;
  const mode = nextMathMode(opts.todayRefs, slipping, pickSeed);
  return {
    kind: "math",
    title: mode === "relaxed" ? math.skill.name : `${math.skill.name} · ${MATH_MODE_LABEL[mode]}`,
    line: math.why,
    href: mathHref({ skill: math.skill.id, level: "auto", count: 10, mode, seed: opts.seed }),
  };
}

/** Which words the next word drill works on, or null when there are none. */
function wordPick(opts: { weakWords: number; dueWords?: number; toGoWords?: number }): {
  source: DrillSource;
  title: string;
  line: string;
} | null {
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  if (opts.weakWords > 0) {
    return { source: { kind: "weak" }, title: "Weak words", line: `${plural(opts.weakWords, "word needs", "words need")} practice` };
  }
  const due = opts.dueWords ?? 0;
  if (due > 0) return { source: { kind: "due" }, title: "Due words", line: `${plural(due, "word is", "words are")} due` };
  const toGo = opts.toGoWords ?? 0;
  if (toGo > 0) return { source: { kind: "all" }, title: "Your words", line: `${plural(toGo, "word", "words")} to go today` };
  return null;
}

/**
 * The suggestion from what the pages hold: the Drill tab's card and
 * /drill/next, which every finished drill goes on to, must agree.
 */
export function suggestionFor(opts: {
  weakWords: number;
  dueWords?: number;
  toGoWords?: number;
  wordModes?: readonly VocabMode[];
  /** Math progress rows, one per skill played. */
  played: readonly { skill: string; recentPcts: number[]; lastAt: string | null }[];
  activity: readonly { ref: string; at: string }[];
  now: Date;
}): Suggestion | null {
  const today = todayKey(opts.now);
  const todayRefs = opts.activity.filter((a) => todayKey(new Date(a.at)) === today).map((a) => a.ref);
  return suggestDrill({
    weakWords: opts.weakWords,
    dueWords: opts.dueWords,
    toGoWords: opts.toGoWords,
    wordModes: opts.wordModes,
    skills: MATH_SKILLS.map((s) => {
      const p = opts.played.find((x) => x.skill === s.id);
      return { id: s.id, name: s.name, recentPcts: p?.recentPcts ?? [], lastAt: p?.lastAt ?? null };
    }),
    todayRefs,
    seed: opts.now.getTime(),
    // The same day and the same drills played give the same pick, so the
    // Drill tab's card and Home's "Keep going: next drill" (/drill/next)
    // always agree; it moves on each time a drill is logged.
    pickSeed: Number(today.replaceAll("-", "")) * 100 + todayRefs.length,
  });
}
