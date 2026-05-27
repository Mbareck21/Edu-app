// Intra-session study queue. Layers a Leitner-style re-queue on top of the
// daily SRS scheduler in lib/srs.ts.
//
// The SRS scheduler decides WHICH words come into today's session (due first,
// then top-up from soonest not-yet-due). The session queue decides the ORDER
// within the session and handles Hard ratings by re-inserting the word a few
// positions later so the kid encounters it again within the same sitting.
//
// All functions here are pure — no React, no I/O, no Math.random unless
// rng is omitted. Inject rng for deterministic tests.

import type { ClientWord } from "@/lib/models/WordList";
import { isDue } from "@/lib/srs";

export const DEFAULT_SESSION_SIZE = 10;

export type Rating = "easy" | "hard";

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

// After the user rates the head of the queue:
//   - "easy": remove the head and return the rest.
//   - "hard": remove the head, then splice it back at position
//     min(rest.length, random 2 or 3). If rest is empty (single-card queue),
//     return [head] — the same word reappears immediately because there is
//     nowhere else to put it.
// Generic on T so the caller can pass either ClientWord[] or string[] (id queue).
export function applyRating<T>(
  queue: T[],
  rating: Rating,
  rng: () => number = Math.random,
): T[] {
  if (queue.length === 0) return queue;
  const [head, ...rest] = queue;
  if (rating === "easy") return rest;
  if (rest.length === 0) return [head];
  const offset = 2 + Math.floor(rng() * 2); // 2 or 3
  const insertAt = Math.min(rest.length, offset);
  const next = rest.slice();
  next.splice(insertAt, 0, head);
  return next;
}
