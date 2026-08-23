/**
 * Time on task, not time on the clock.
 *
 * Runners used to post `Date.now() - mountedAt`, which counts every minute a
 * phone spent face-down in the middle of a lesson. His real data holds a
 * 2.5-hour "reading" and a 51-minute math session of ten questions — numbers
 * the finish screen showed him as his time.
 *
 * A stopwatch adds up the gaps between things he actually did, and refuses to
 * believe any single gap longer than IDLE_GAP_MS. Pure and clock-injectable,
 * so it is testable without a browser.
 */

/** Longer than this between two actions and he had walked away, not worked. */
export const IDLE_GAP_MS = 120_000;

export type Stopwatch = {
  /** Fold the time since the last mark into the total. Call on every answer. */
  mark: () => void;
  /** Active ms so far, including the gap since the last mark. */
  read: () => number;
};

export function startStopwatch(now: () => number = Date.now): Stopwatch {
  let total = 0;
  let last = now();
  const gap = () => Math.min(Math.max(0, now() - last), IDLE_GAP_MS);
  return {
    mark: () => {
      total += gap();
      last = now();
    },
    read: () => total + gap(),
  };
}
