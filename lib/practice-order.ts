/**
 * The order practice words come in.
 *
 * Weakest first was a strict sort on (due, streak, dueAt). `dueAt` is a
 * millisecond stamp, so two words practically never tie on all three — which
 * made the shuffle sitting above that sort dead code. Every "Again" rebuilt
 * the identical set in the identical order no matter what seed it was given.
 * Nour ran the same mixed drill six times in one evening for that reason.
 *
 * So a word's rank is its streak plus a little noise. A streak-0 word and a
 * streak-1 word trade places freely; a streak-0 word still comes before a
 * streak-3 one. Being due is not a preference and gets no noise at all — an
 * owed review always goes first.
 *
 * Pure: the same words and the same seed still give the same order, because
 * the noise is drawn once per item in array order.
 */

import type { Rng } from "@/lib/math/types";

/** How many streaks' worth of noise. Big enough to reshuffle the weak pile. */
export const ORDER_JITTER = 1.5;

export type PracticeNeed = {
  /** Due for review right now. */
  due: boolean;
  /** Lower is weaker. */
  streak: number;
};

export function orderByNeed<T>(
  items: readonly T[],
  rng: Rng,
  needOf: (item: T) => PracticeNeed
): T[] {
  return items
    .map((item) => {
      const need = needOf(item);
      return { item, due: need.due, rank: need.streak + rng() * ORDER_JITTER };
    })
    .sort((a, b) => (a.due === b.due ? a.rank - b.rank : a.due ? -1 : 1))
    .map((x) => x.item);
}
