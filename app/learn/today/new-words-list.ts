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
 */
export function productionList<L extends { words: readonly ClientWord[]; kind: string }>(
  lists: readonly L[]
): L | undefined {
  return newWordsList(lists.filter((l) => l.kind !== "pool"));
}
