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
import { MS_PER_DAY, SKILL_LADDER_DAYS } from "@/lib/spacing";

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
  /** Set the first time the chain reaches CHAIN_TARGET. Never cleared. */
  graduatedAt: string | null;
  /**
   * Passed re-checks in a row since the chain last hit ten. Ten in a row
   * proves he can spell it today; it says nothing about next week. So a
   * finished word comes back on the same 1-3-7-16-35-90 day ladder every
   * other skill in the app uses, for ONE blind write. Pass, and the gap
   * grows. Miss, and it is a working word again at zero — "finished" that
   * never re-checks is exactly the fake reward this app keeps removing.
   */
  checks: number;
  /** When the next re-check falls. Null until the chain first reaches ten. */
  dueAt: string | null;
};

export function newChain(word: string): ChainState {
  return {
    word: word.trim().toLowerCase(),
    current: 0,
    best: 0,
    reps: 0,
    attempts: 0,
    graduatedAt: null,
    checks: 0,
    dueAt: null,
  };
}

/**
 * Build a state from a stored row, tolerating anything missing. One place, so
 * the pages and the write route cannot each hydrate it slightly differently.
 */
export function fromRow(
  word: string,
  row: {
    current?: unknown;
    best?: unknown;
    reps?: unknown;
    attempts?: unknown;
    graduatedAt?: unknown;
    checks?: unknown;
    dueAt?: unknown;
  } | null | undefined
): ChainState {
  if (!row) return newChain(word);
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0);
  const iso = (v: unknown) => {
    if (v instanceof Date) return v.toISOString();
    if (typeof v === "string" && v) return new Date(v).toISOString();
    return null;
  };
  const graduatedAt = iso(row.graduatedAt);
  const current = num(row.current);
  let dueAt = iso(row.dueAt);
  // A row finished before re-checks existed has no dueAt. Left null it would
  // never come due and sit "Finished" for good — seventeen of his words were
  // in exactly that state. Schedule it from the day he finished, bottom of
  // the ladder, so it comes round as if the rule had always been there.
  if (dueAt === null && graduatedAt !== null && current >= CHAIN_TARGET) {
    dueAt = nextDue(0, graduatedAt);
  }
  return {
    word,
    current,
    best: num(row.best),
    reps: num(row.reps),
    attempts: num(row.attempts),
    graduatedAt,
    checks: num(row.checks),
    dueAt,
  };
}

/** The chain has reached ten and not been broken since. */
export function isFinished(state: ChainState): boolean {
  return state.graduatedAt !== null && state.current >= CHAIN_TARGET;
}

/** A finished word whose re-check has come round. */
export function checkDue(state: ChainState, nowIso: string): boolean {
  return isFinished(state) && state.dueAt !== null && nowIso >= state.dueAt;
}

/** The next re-check, `checks` steps up the ladder from now. */
function nextDue(checks: number, nowIso: string): string {
  const i = Math.min(Math.max(0, checks), SKILL_LADDER_DAYS.length - 1);
  return new Date(new Date(nowIso).getTime() + SKILL_LADDER_DAYS[i] * MS_PER_DAY).toISOString();
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
  // A re-check is a test, not practice: nothing on screen but the meaning.
  if (isFinished(state)) return "blind";
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

  if (isFinished(state) && !checkDue(state, nowIso)) {
    // Finished and not yet due: extra practice, not a check. It must not move
    // the ladder — six writes in one sitting would otherwise push a word out
    // ninety days in an evening. A miss is still a miss.
    if (!correct) {
      return {
        state: { ...state, current: 0, attempts, checks: 0, dueAt: null },
        correct: false,
      };
    }
    return { state: { ...state, reps: state.reps + 1, attempts }, correct: true };
  }

  if (isFinished(state)) {
    // A re-check. One blind write decides it.
    if (!correct) {
      // Back to a working word. graduatedAt stays: he did do it once.
      return {
        state: { ...state, current: 0, attempts, checks: 0, dueAt: null },
        correct: false,
      };
    }
    const checks = state.checks + 1;
    return {
      state: {
        ...state,
        reps: state.reps + 1,
        attempts,
        checks,
        dueAt: nextDue(checks, nowIso),
      },
      correct: true,
    };
  }

  if (!correct) {
    return { state: { ...state, current: 0, attempts }, correct: false };
  }
  const current = Math.min(CHAIN_TARGET, state.current + 1);
  const reps = state.reps + 1;
  const reached = current >= CHAIN_TARGET;
  return {
    state: {
      ...state,
      current,
      best: Math.max(state.best, current),
      reps,
      attempts,
      graduatedAt: state.graduatedAt ?? (reached ? nowIso : null),
      // The first re-check is tomorrow, the bottom of the ladder.
      checks: reached ? 0 : state.checks,
      dueAt: reached ? nextDue(0, nowIso) : state.dueAt,
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
