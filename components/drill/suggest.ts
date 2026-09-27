// The Drill tab's "Suggested for you": one tap to the drill that helps most,
// turning between words and math so free practice stays varied. The boys
// still pick anything they like below it. Pure: no React, no Mongo.

import { mathHref, vocabHref } from "@/components/drill/options";

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
  const math = weakestSkill(opts.skills);
  const wordsFirst = opts.weakWords > 0 && (wordDrills === 0 || !math || wordDrills <= mathDrills);

  if (wordsFirst || !math) {
    if (opts.weakWords === 0) return null;
    return {
      kind: "words",
      title: "Weak words",
      line: `${opts.weakWords} ${opts.weakWords === 1 ? "word needs" : "words need"} practice`,
      href: vocabHref({ source: { kind: "weak" }, mode: "mixed", count: 10, seed: opts.seed }),
    };
  }
  return {
    kind: "math",
    title: math.skill.name,
    line: math.why,
    href: mathHref({ skill: math.skill.id, level: "auto", count: 10, mode: "relaxed", seed: opts.seed }),
  };
}
