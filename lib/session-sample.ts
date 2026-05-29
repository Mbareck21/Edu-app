// Per-session word-game sampler. The crossword, scramble, and word-search
// pages call this to cap any one session at WORD_GAME_SESSION_SIZE words.
// Each page render produces a fresh random sample because the pages are
// `export const dynamic = "force-dynamic"`.
//
// Pure function — Math.random is the default rng so the sample changes per
// request; pass a seeded rng for deterministic tests.

export const WORD_GAME_SESSION_SIZE = 10;

// Partial Fisher-Yates: fills only the first `n` slots, so this is O(n)
// rather than O(items.length). Returns a fresh array of size min(n, items.length).
export function sampleWords<T>(
  items: T[],
  n: number,
  rng: () => number = Math.random,
): T[] {
  if (n <= 0 || items.length === 0) return [];
  if (items.length <= n) return items.slice();
  const arr = items.slice();
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(rng() * (arr.length - i));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, n);
}

// Full Fisher-Yates over a copy. The crossword layout generator is deterministic
// for a given input order, so shuffling the order is what makes a replay produce
// a different puzzle even when the word set can't change (lists of <= 10 words).
export function shuffle<T>(items: T[], rng: () => number = Math.random): T[] {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
