import { isNewWord } from "@/lib/lesson-builder";
import type { ClientWord } from "@/lib/models/WordList";

/**
 * The list "three new words" teaches from: the first one that still has a word
 * he has never met. The first list alone ran dry once its words were all met,
 * and the beat served none while the next unit still had plenty.
 */
export function newWordsList<L extends { words: readonly ClientWord[] }>(lists: readonly L[]): L | undefined {
  return lists.find((l) => l.words.some(isNewWord)) ?? lists[0];
}

/**
 * The unit "Write and use" works on: the one Home points the quest at, which
 * is never the Stuck-words pool. It used to take the head of the practice
 * lists, and those put the pool first — so from his first stuck word on, every
 * production round spelled and used the pool's own copies, which the Me page
 * rightly leaves out, and the unit's words got none of it.
 *
 * The day a unit's last new words are taught, Home moves on to the next unit,
 * where he has met nothing, and production spelled and used words he had never
 * been taught. So it stays on the nearest earlier unit with words he has met.
 */
export function productionList<L extends { words: readonly ClientWord[]; kind: string }>(
  lists: readonly L[]
): L | undefined {
  const units = unitLists(lists);
  const home = newWordsList(units);
  const met = (l: L) => l.words.filter((w) => !isNewWord(w)).length;
  // Production itself needs two met words before it leaves out the new ones.
  if (!home || met(home) >= 2) return home;
  for (let i = units.indexOf(home) - 1; i >= 0; i--) {
    if (met(units[i]) >= 2) return units[i];
  }
  return units.find((l) => met(l) >= 2) ?? home;
}

/**
 * The school lists, without the Stuck-words pool. Review and New words run on
 * these: a pool word is a second copy of a unit word, so reviewing both spent
 * two of the day's review slots on one word and left the unit copy — the one
 * that counts toward Known — short of reviews. The pool gets its own practice
 * on the Words tab and in the drills.
 */
export function unitLists<L extends { kind: string }>(lists: readonly L[]): L[] {
  return lists.filter((l) => l.kind !== "pool");
}
