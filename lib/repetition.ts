/**
 * Same-session repetition for missed words.
 *
 * Nour learns by seeing the SAME word again and again in one sitting. The old
 * rule gave a miss exactly one comeback and then dropped it — one shot at a
 * word he wrote "fefte" for is how "fifty" stayed wrong on the worksheet. So a
 * miss now earns several returns, spaced further apart each time.
 *
 * Pure: no React, no clock, rng always injected. The runner owns the queue;
 * this file only decides how many returns a miss earns and where each one
 * lands.
 */

import type { ItemKind } from "@/lib/items";
import type { Rng } from "@/lib/math/types";

/**
 * Extra returns a missed spelling item earns. Spelling (tile building and
 * typed dictation) is his weakest skill — 0/20 on written number words against
 * 12/12 on the digits — so those words come back the most.
 */
export const SPELL_REPEATS = 3;

/**
 * Extra returns for every other kind. Meaning and usage stick faster for him
 * than letters do, so two more sightings is enough there.
 */
export const OTHER_REPEATS = 2;

/**
 * Total extra returns one session may schedule, all items combined. A bad run
 * on a long lesson must not turn it endless — past this, a miss behaves the
 * old way: answered, gone.
 */
export const SESSION_REPEAT_CAP = 12;

/**
 * How far back in the queue each return lands, by repeat index. The first
 * comeback is soon, while being told still helps; later ones sit further out
 * so he is recalling the word, not copying what he just saw. Returns past the
 * end of the list reuse the last gap.
 */
export const REPEAT_GAPS: readonly number[] = [2, 4, 7];

/** The kinds where he types or builds the word letter by letter. */
export function isSpellingKind(kind: ItemKind): boolean {
  return kind === "spell" || kind === "write";
}

/** Extra same-session returns a miss on this kind earns. */
export function repeatsFor(kind: ItemKind): number {
  return isSpellingKind(kind) ? SPELL_REPEATS : OTHER_REPEATS;
}

/**
 * Put a returning item back into the queue at the gap for this repeat index,
 * plus a little jitter so the returns are not metronomic. The jitter only adds
 * — never below the base gap — so an item can never land at index 0 or 1,
 * which would be copying the answer still on screen. A queue shorter than the
 * gap gets the item at its end; it is never dropped.
 */
export function insertRepeat<T>(
  queue: readonly T[],
  item: T,
  repeatIndex: number,
  rng: Rng
): T[] {
  const base = REPEAT_GAPS[Math.min(Math.max(repeatIndex, 0), REPEAT_GAPS.length - 1)];
  const gap = base + Math.floor(rng() * 2);
  const at = Math.min(queue.length, gap);
  const next = queue.slice();
  next.splice(at, 0, item);
  return next;
}
