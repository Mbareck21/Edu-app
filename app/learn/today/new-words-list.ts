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
