/**
 * "Write it ten times without a mistake."
 *
 * His father's rule, and it is not softened here: ten correct spellings in a
 * row, and any misspelling puts the count back to zero.
 *
 * The difficulty is that ten in a row is a lot for a boy who scored ~0/20
 * writing number words, and a reset at nine is exactly where a nine-year-old
 * decides he is bad at this. So two counts are kept, and only one of them
 * falls:
 *
 *   current — consecutive correct. Zeroes on a miss. This is the rule.
 *   reps    — lifetime correct writes. Never falls. This buys the support.
 *
 * The help he gets on screen is chosen from `reps`, so a reset costs him the
 * chain but never sends him back to copying letter by letter. He loses the
 * count, not the ground.
 *
 * Pure: no clock, no storage, no React. The server replays the same functions
 * over what he typed, which is why the phone can never assert a rep it did not
 * earn.
 */

import { spellingKey } from "@/lib/items";

/** The parent's number. Fixed. */
export const CHAIN_TARGET = 10;

export type ChainState = {
  /** Lowercase and trimmed, the WordList convention. The identity. */
  word: string;
  /** Consecutive correct. Zeroes on any miss. The visible counter. */
  current: number;
  /** Best run ever reached. Only rises — the marker he is chasing. */
  best: number;
  /** Lifetime correct writes. Only rises. Chooses the support rung. */
  reps: number;
  /** Lifetime submissions, right or wrong. For the parent's view. */
  attempts: number;
  /** Set the first time the chain reaches CHAIN_TARGET. */
  graduatedAt: string | null;
};

export function newChain(word: string): ChainState {
  return {
    word: word.trim().toLowerCase(),
    current: 0,
    best: 0,
    reps: 0,
    attempts: 0,
    graduatedAt: null,
  };
}

/**
 * How much of the word he can see, least to most demanding.
 *
 *   copy  — the word is on screen. He copies it. Nobody learns nothing here:
 *           copying is how the letter order gets into the hand at all.
 *   cover — shown, then hidden the moment he starts typing.
 *   chunk — only the part he gets wrong is masked ("fif__", "__ty").
 *   blind — nothing but the meaning and the sound. The rep that proves it.
 */
export type Rung = "copy" | "cover" | "chunk" | "blind";

export const RUNGS: readonly Rung[] = ["copy", "cover", "chunk", "blind"];

/**
 * Lifetime reps at which each rung starts. Deliberately early: the point is
 * that he spends most of his writing at `blind`, with the easier rungs as the
 * on-ramp rather than the destination.
 */
const RUNG_AT_REPS: readonly number[] = [0, 2, 4, 7];

/**
 * The support for the next write. Driven by lifetime reps, so a reset does not
 * take his ground away — that is the whole reason `reps` exists separately.
 *
 * A miss overrides it: the very next write after a mistake is always a copy,
 * so he sees the correct spelling immediately after producing a wrong one and
 * does not practise the error.
 */
export function rungFor(state: ChainState, afterMiss: boolean): Rung {
  if (afterMiss) return "copy";
  let rung: Rung = "copy";
  RUNG_AT_REPS.forEach((need, i) => {
    if (state.reps >= need) rung = RUNGS[i];
  });
  return rung;
}

export type ChainStep = {
  state: ChainState;
  correct: boolean;
};

/**
 * Apply one submission.
 *
 * `typed` is compared with spellingKey, the same normaliser the spell items
 * use, so punctuation and case never fail him for a spelling he got right.
 * An "almost" is not a pass: this drill is about the letters.
 */
export function applyWrite(
  state: ChainState,
  typed: string,
  nowIso: string
): ChainStep {
  const correct = spellingKey(typed) === spellingKey(state.word);
  const attempts = state.attempts + 1;
  if (!correct) {
    return { state: { ...state, current: 0, attempts }, correct: false };
  }
  const current = Math.min(CHAIN_TARGET, state.current + 1);
  const reps = state.reps + 1;
  return {
    state: {
      ...state,
      current,
      best: Math.max(state.best, current),
      reps,
      attempts,
      graduatedAt:
        state.graduatedAt ?? (current >= CHAIN_TARGET ? nowIso : null),
    },
    correct: true,
  };
}

/** How many more in a row he needs. What the counter on screen shows. */
export function remaining(state: ChainState): number {
  return Math.max(0, CHAIN_TARGET - state.current);
}

export function isGraduated(state: ChainState): boolean {
  return state.graduatedAt !== null;
}

/**
 * Replay a whole run of submissions from a starting state.
 *
 * The client posts what he typed, never whether it was right, and the server
 * runs exactly this. Same input, same result, so there is nothing to forge and
 * the two can never disagree about the count.
 */
export function replay(
  state: ChainState,
  typed: readonly string[],
  nowIso: string
): ChainState {
  return typed.reduce((acc, t) => applyWrite(acc, t, nowIso).state, state);
}

/**
 * The order words come up in a sitting.
 *
 * Not one word ten times in a row. Reps on the same word back to back are
 * copying, not remembering — he can hold the letters in his head for four
 * seconds without ever storing them. Rotating through a few words puts a gap
 * between each write of the same one, which is the gap that does the work.
 *
 * "Consecutive" still means what the parent asked: unbroken by a mistake on
 * that word. Another word in between is not a mistake.
 */
export function rotate(words: readonly string[], writeIndex: number): string {
  if (words.length === 0) return "";
  return words[writeIndex % words.length];
}

/** How many words share one sitting. Three keeps the gap real but short. */
export const ROTATE_WIDTH = 3;
