// Per-skill mastery. Pure functions — server + client safe, no Mongo.
//
// A word is only "known" when every one of the four skills (recognize,
// listen, spell, use) has stuck three times in a row, and every one of those
// three was recalled in its own review window rather than ground out in one
// sitting.
//
// It used to also require the flashcard SRS interval to pass a week. That
// interval only grows when the child himself taps "Easy", so the app's headline
// "words known" rested on a nine-year-old marking his own homework. The spacing
// that clause was really buying is now enforced objectively in scheduleSkill.

import { SKILL_IDS, type ClientWord, type SkillId, type SkillState } from "@/lib/models/WordList";
import { MS_PER_DAY, skillGapDays } from "@/lib/spacing";

export const KNOWN_STREAK = 3;
export const MASTERED_STREAK = 4;
/** Days to the next review, indexed by streak (see docs/pedagogy.md). */
// The ladder lives in lib/spacing.ts, which imports nothing, so pure modules
// that run in the browser can share it without dragging the model along.
// Re-exported here so existing callers and tests keep working.
export { SKILL_LADDER_DAYS, skillGapDays } from "@/lib/spacing";

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
 *
 * A right answer given BEFORE the word was due keeps the streak where it is.
 * He practises the same list several times a day on purpose, and that repetition
 * is how he learns — but three recalls in one afternoon are not the evidence
 * three recalls a week apart are, and only the second kind should be allowed to
 * call a word known.
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
  // Practice before it was due still counts as practice, just not as progress.
  const early = now.getTime() < new Date(state.dueAt).getTime();
  const streak = early ? state.streak : state.streak + 1;
  const days = skillGapDays(Math.max(1, streak));
  return {
    correct: state.correct + 1,
    wrong: state.wrong,
    streak,
    lastAt: now.toISOString(),
    dueAt: early ? state.dueAt : new Date(now.getTime() + days * MS_PER_DAY).toISOString(),
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
 * Recognising a word is not knowing it — he has to have produced it at least
 * once (spelled it or used it) and held all four skills across three separate
 * review windows. scheduleSkill is what makes those windows real.
 */
export function wordKnowledge(word: ClientWord): Knowledge {
  const produced = word.skills.spell.correct >= 1 || word.skills.use.correct >= 1;
  const known =
    produced && SKILL_IDS.every((id) => word.skills[id].streak >= KNOWN_STREAK);
  if (!known) return touched(word) ? "learning" : "new";

  const mastered = SKILL_IDS.every((id) => word.skills[id].streak >= MASTERED_STREAK);
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
