// The Drill tab's "Suggested for you": one tap to the drill that helps most,
// turning between words and math so free practice stays varied. The boys
// still pick anything they like below it. Pure: no React, no Mongo.

import { VOCAB_MODE_LABEL, mathHref, vocabHref, type VocabMode } from "@/components/drill/options";
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
 * Word drill types the suggestion turns through, in the order ties go.
 * Not mixed or rescue, and not remember: it drills one whole list and would
 * ignore the weak words.
 */
export const SUGGESTED_WORD_MODES: readonly VocabMode[] = ["match", "listen", "spell", "use", "flashcards", "write"];

/** The word drill type played least today; ties go to the earlier one. */
export function nextWordMode(todayRefs: readonly string[]): VocabMode {
  const plays = (mode: VocabMode) => todayRefs.filter((r) => r === `drill:vocab:${mode}`).length;
  return SUGGESTED_WORD_MODES.reduce((best, mode) => (plays(mode) < plays(best) ? mode : best));
}

/** Skills not drilled today, or every skill once all have been. */
function notDrilledToday(skills: readonly SkillSeen[], todayRefs: readonly string[]): readonly SkillSeen[] {
  const fresh = skills.filter((s) => !todayRefs.some((r) => r.startsWith(`drill:math:${s.id}:`)));
  return fresh.length > 0 ? fresh : skills;
}

/**
 * Words when there are weak words and no word drill yet today, otherwise
 * math; after both, whichever was drilled less today.
 */
export function suggestDrill(opts: {
  weakWords: number;
  skills: readonly SkillSeen[];
  /** Refs of the sessions played today. */
  todayRefs: readonly string[];
  seed: number;
}): Suggestion | null {
  const wordDrills = opts.todayRefs.filter((r) => r.startsWith("drill:vocab")).length;
  const mathDrills = opts.todayRefs.filter((r) => r.startsWith("drill:math")).length;
  const math = weakestSkill(notDrilledToday(opts.skills, opts.todayRefs));
  const wordsFirst = opts.weakWords > 0 && (wordDrills === 0 || !math || wordDrills <= mathDrills);

  if (wordsFirst || !math) {
    if (opts.weakWords === 0) return null;
    const mode = nextWordMode(opts.todayRefs);
    return {
      kind: "words",
      title: `Weak words · ${VOCAB_MODE_LABEL[mode]}`,
      line: `${opts.weakWords} ${opts.weakWords === 1 ? "word needs" : "words need"} practice`,
      href: vocabHref({ source: { kind: "weak" }, mode, count: 10, seed: opts.seed }),
    };
  }
  return {
    kind: "math",
    title: math.skill.name,
    line: math.why,
    href: mathHref({ skill: math.skill.id, level: "auto", count: 10, mode: "relaxed", seed: opts.seed }),
  };
}

/**
 * The suggestion from what the pages hold: the Drill tab's card and
 * /drill/next, which every finished drill goes on to, must agree.
 */
export function suggestionFor(opts: {
  weakWords: number;
  /** Math progress rows, one per skill played. */
  played: readonly { skill: string; recentPcts: number[]; lastAt: string | null }[];
  activity: readonly { ref: string; at: string }[];
  now: Date;
}): Suggestion | null {
  const today = todayKey(opts.now);
  return suggestDrill({
    weakWords: opts.weakWords,
    skills: MATH_SKILLS.map((s) => {
      const p = opts.played.find((x) => x.skill === s.id);
      return { id: s.id, name: s.name, recentPcts: p?.recentPcts ?? [], lastAt: p?.lastAt ?? null };
    }),
    todayRefs: opts.activity.filter((a) => todayKey(new Date(a.at)) === today).map((a) => a.ref),
    seed: opts.now.getTime(),
  });
}
