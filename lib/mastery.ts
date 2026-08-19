// Per-skill mastery. Pure functions — server + client safe, no Mongo.
//
// A word is only "known" when every one of the four skills (recognize,
// listen, spell, use) has stuck three times in a row. "Mastered" also needs
// the flashcard SRS interval to have grown past a week.

import { SKILL_IDS, type ClientWord, type SkillId, type SkillState } from "@/lib/models/WordList";

export const KNOWN_STREAK = 3;
export const MASTERED_STREAK = 4;
/** Flashcard SRS interval a word needs before it counts as known / mastered. */
export const KNOWN_INTERVAL_DAYS = 7;
export const MASTERED_INTERVAL_DAYS = 16;
/** Days to the next review, indexed by streak (see docs/pedagogy.md). */
export const SKILL_LADDER_DAYS = [1, 3, 7, 16, 35, 90] as const;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Gap in days after `streak` right answers in a row. */
export function skillGapDays(streak: number): number {
  const i = Math.max(1, Math.floor(streak)) - 1;
  return SKILL_LADDER_DAYS[Math.min(i, SKILL_LADDER_DAYS.length - 1)];
}

export type Knowledge = "new" | "learning" | "known" | "mastered";

/** Ordered weakest → strongest, so callers can do `rank(a) >= rank("known")`. */
export const KNOWLEDGE_ORDER: readonly Knowledge[] = [
  "new",
  "learning",
  "known",
  "mastered",
];

export function knowledgeRank(k: Knowledge): number {
  return KNOWLEDGE_ORDER.indexOf(k);
}

export function newSkillState(now: Date = new Date()): SkillState {
  return {
    correct: 0,
    wrong: 0,
    streak: 0,
    lastAt: null,
    dueAt: now.toISOString(),
  };
}

export function skillDue(skill: SkillState, now: Date): boolean {
  return new Date(skill.dueAt).getTime() <= now.getTime();
}

/**
 * One answer for one skill.
 * Right → streak + 1 and the next review moves out along the day ladder.
 * Wrong → streak back to 0 and the word is due again straight away.
 */
export function scheduleSkill(state: SkillState, correct: boolean, now: Date): SkillState {
  if (!correct) {
    return {
      correct: state.correct,
      wrong: state.wrong + 1,
      streak: 0,
      lastAt: now.toISOString(),
      dueAt: now.toISOString(),
    };
  }
  const streak = state.streak + 1;
  const days = skillGapDays(streak);
  return {
    correct: state.correct + 1,
    wrong: state.wrong,
    streak,
    lastAt: now.toISOString(),
    dueAt: new Date(now.getTime() + days * MS_PER_DAY).toISOString(),
  };
}

function touched(word: ClientWord): boolean {
  if (word.srs.reviewCount > 0) return true;
  return SKILL_IDS.some((id) => {
    const s = word.skills[id];
    return s.correct > 0 || s.wrong > 0;
  });
}

/**
 * Recognising a word is not knowing it — the kid has to have produced it at
 * least once (spelled it or used it) and held it across a week of reviews.
 */
export function wordKnowledge(word: ClientWord): Knowledge {
  const produced = word.skills.spell.correct >= 1 || word.skills.use.correct >= 1;
  const known =
    produced &&
    word.srs.interval >= KNOWN_INTERVAL_DAYS &&
    SKILL_IDS.every((id) => word.skills[id].streak >= KNOWN_STREAK);
  if (!known) return touched(word) ? "learning" : "new";

  const mastered =
    word.srs.interval >= MASTERED_INTERVAL_DAYS &&
    SKILL_IDS.every((id) => word.skills[id].streak >= MASTERED_STREAK);
  return mastered ? "mastered" : "known";
}

export type KnowledgeCounts = Record<Knowledge, number>;

export function countKnowledge(words: ClientWord[]): KnowledgeCounts {
  const counts: KnowledgeCounts = { new: 0, learning: 0, known: 0, mastered: 0 };
  for (const w of words) counts[wordKnowledge(w)]++;
  return counts;
}

/** Words known = known or better. What /me shows as "words known". */
export function countKnown(words: ClientWord[]): number {
  return words.filter((w) => knowledgeRank(wordKnowledge(w)) >= knowledgeRank("known"))
    .length;
}

/** The skills that are due for a word right now, weakest first. */
export function dueSkills(word: ClientWord, now: Date): SkillId[] {
  return SKILL_IDS.filter((id) => skillDue(word.skills[id], now)).sort(
    (a, b) => word.skills[a].streak - word.skills[b].streak
  );
}
