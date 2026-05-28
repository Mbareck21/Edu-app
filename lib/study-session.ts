// Intra-session study queue. Layers a Leitner-style re-queue on top of the
// daily SRS scheduler in lib/srs.ts.
//
// The SRS scheduler decides WHICH words come into today's session (due first,
// then top-up from soonest not-yet-due). The session queue decides the ORDER
// within the session: Hard re-inserts the word a few positions later AND
// resets its mastery counter; Easy re-inserts it the same way but increments
// the counter, and only removes the word once the kid has tapped Easy the
// (MASTERY_CONFIRMATIONS + 1)th time on it within the session.
//
// All functions here are pure — no React, no I/O, no Math.random unless rng
// is omitted. Inject rng for deterministic tests.

import type { ClientWord } from "@/lib/models/WordList";
import { isDue } from "@/lib/srs";

export const DEFAULT_SESSION_SIZE = 10;

// Number of Easy taps AFTER the initial one before a word is considered
// mastered. With MASTERY_CONFIRMATIONS = 3, the kid must tap Easy 4 times
// total on the same word (within the same session) to remove it from the
// queue. Any Hard tap resets the counter to 0.
export const MASTERY_CONFIRMATIONS = 3;

export type Rating = "easy" | "hard";

// One slot in the intra-session queue. `id` is the word's `word` field (used
// as a stable client-side key); `easys` is the number of Easy taps the kid
// has logged for this word so far in this session.
export type SessionEntry = { id: string; easys: number };

function byDueAtAsc(a: ClientWord, b: ClientWord): number {
  return new Date(a.srs.dueAt).getTime() - new Date(b.srs.dueAt).getTime();
}

// Build the session queue: all due words first (dueAt ascending), then
// top-up from not-yet-due words (also dueAt ascending) until we have
// targetCount or run out of words. Lists with fewer than targetCount total
// words use everything available.
export function selectSessionWords(
  words: ClientWord[],
  targetCount: number,
  now: Date,
): ClientWord[] {
  const due = words.filter((w) => isDue(w.srs, now)).sort(byDueAtAsc);
  if (due.length >= targetCount) return due.slice(0, targetCount);
  const notDue = words.filter((w) => !isDue(w.srs, now)).sort(byDueAtAsc);
  return [...due, ...notDue.slice(0, targetCount - due.length)];
}

// Re-insert `item` 2 or 3 positions ahead of the queue head. If `rest` is
// empty (single-card queue), the same word reappears immediately because
// there is nowhere else to put it — acceptable on tiny lists.
function spliceAhead(
  rest: SessionEntry[],
  item: SessionEntry,
  rng: () => number,
): SessionEntry[] {
  if (rest.length === 0) return [item];
  const offset = 2 + Math.floor(rng() * 2); // 2 or 3
  const insertAt = Math.min(rest.length, offset);
  const next = rest.slice();
  next.splice(insertAt, 0, item);
  return next;
}

// After the user rates the head of the queue:
//   - "easy" on a word with `easys < MASTERY_CONFIRMATIONS`:
//       increment easys, splice 2-3 positions ahead. Not mastered yet.
//   - "easy" on a word with `easys === MASTERY_CONFIRMATIONS`
//     (i.e. this is the kid's (MASTERY_CONFIRMATIONS + 1)th Easy tap):
//       drop the word from the queue. Mastered.
//   - "hard": splice 2-3 positions ahead with easys reset to 0. Never
//     masters.
// Returns the new queue and a `mastered` flag the caller uses to bump the
// X / N mastered display.
export function applyRating(
  queue: SessionEntry[],
  rating: Rating,
  rng: () => number = Math.random,
): { queue: SessionEntry[]; mastered: boolean } {
  if (queue.length === 0) return { queue, mastered: false };
  const [head, ...rest] = queue;

  if (rating === "easy") {
    const newEasys = head.easys + 1;
    if (newEasys > MASTERY_CONFIRMATIONS) {
      return { queue: rest, mastered: true };
    }
    return {
      queue: spliceAhead(rest, { id: head.id, easys: newEasys }, rng),
      mastered: false,
    };
  }

  // Hard: keep the word in the session and zero its mastery progress.
  return {
    queue: spliceAhead(rest, { id: head.id, easys: 0 }, rng),
    mastered: false,
  };
}
