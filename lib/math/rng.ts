import type { Rng } from "./types";

/** Small, fast, seeded PRNG. Same seed => same question list. */
export function mulberry32(seed: number): Rng {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/** Whole number in [lo, hi], both ends included. */
export function randInt(rng: Rng, lo: number, hi: number): number {
  if (hi < lo) return lo;
  return lo + Math.floor(rng() * (hi - lo + 1));
}

/** One item from a non-empty list. */
export function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[randInt(rng, 0, items.length - 1)];
}

/** Copy of the list in a new order (Fisher-Yates). Input is not changed. */
export function shuffle<T>(rng: Rng, items: readonly T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = randInt(rng, 0, i);
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}
