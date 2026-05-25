// Pure SRS (spaced repetition) algorithm. Server + client safe.
//
// Two-button SRS, multiplicative-with-cap.
//   • "easy" doubles the interval; capped at MAX_INTERVAL_DAYS.
//   • "hard" resets to NEW_INTERVAL_DAYS (1 day).
//   • New cards have interval = 0 and are due immediately.

import type { ClientWord, SrsState } from "@/lib/models/WordList";

export const MAX_INTERVAL_DAYS = 60;
export const NEW_INTERVAL_DAYS = 1;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type Rating = "easy" | "hard";

export function scheduleNext(state: SrsState, rating: Rating, now: Date): SrsState {
  let newInterval: number;
  if (rating === "hard") {
    newInterval = NEW_INTERVAL_DAYS;
  } else {
    newInterval =
      state.interval === 0
        ? NEW_INTERVAL_DAYS
        : Math.min(MAX_INTERVAL_DAYS, state.interval * 2);
  }
  const dueAt = new Date(now.getTime() + newInterval * MS_PER_DAY);
  return {
    interval: newInterval,
    dueAt: dueAt.toISOString(),
    lastReviewed: now.toISOString(),
    reviewCount: state.reviewCount + 1,
    easyCount: state.easyCount + (rating === "easy" ? 1 : 0),
    hardCount: state.hardCount + (rating === "hard" ? 1 : 0),
  };
}

export function isDue(state: SrsState, now: Date): boolean {
  return new Date(state.dueAt).getTime() <= now.getTime();
}

export function dueWords(words: ClientWord[], now: Date): ClientWord[] {
  return words
    .filter((w) => isDue(w.srs, now))
    .sort(
      (a, b) =>
        new Date(a.srs.dueAt).getTime() - new Date(b.srs.dueAt).getTime()
    );
}

// Soonest dueAt across non-due cards, used by the UI's "all caught up" copy.
export function nextDueAt(words: ClientWord[], now: Date): Date | null {
  const future = words
    .filter((w) => !isDue(w.srs, now))
    .map((w) => new Date(w.srs.dueAt).getTime());
  if (future.length === 0) return null;
  return new Date(Math.min(...future));
}
