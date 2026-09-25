// Word rescue: a word floats down with a letter or two missing, and he taps
// the missing letters before it lands in the water. Filling a gap from
// memory, with the meaning on screen and the word to hear, is spelling
// practice by doing, and the fall makes it a game.
//
// Kept gentle on purpose (reading is already hard work for him): one or two
// gaps, a slow fall that speeds up only while he is winning and slows down
// after a splash, a wrong tap that costs nothing, and no game over.
//
// Pure: safe to import from client components.

import { pick, shuffle } from "@/lib/math/rng";
import type { Rng } from "@/lib/math/types";

export const RESCUE_ROUND = 10;

/** How long a word takes to fall, ms. Slow to start; never frantic. */
export const FALL_START_MS = 16_000;
const FALL_FASTEST_MS = 9_000;
const FALL_SLOWEST_MS = 20_000;
const FALL_STEP_MS = 1_000;
const FALL_SPLASH_BONUS_MS = 2_500;

/** Next fall time: a little quicker after a rescue, kinder after a splash. */
export function nextFallMs(current: number, rescued: boolean): number {
  const next = rescued ? current - FALL_STEP_MS : current + FALL_SPLASH_BONUS_MS;
  return Math.max(FALL_FASTEST_MS, Math.min(FALL_SLOWEST_MS, next));
}

const isLetter = (ch: string) => /^[a-z]$/i.test(ch);

/**
 * Which letters to hide, left to right. One gap for a short word, two for a
 * longer one. Never the first letter (the sound he starts from), and never
 * two gaps side by side.
 */
export function blanksFor(word: string, rng: Rng): number[] {
  const letters = [...word].map((ch, i) => (isLetter(ch) ? i : -1)).filter((i) => i > 0);
  const letterCount = [...word].filter(isLetter).length;
  const want = letterCount >= 6 ? 2 : 1;
  const out: number[] = [];
  for (const i of shuffle(rng, letters)) {
    if (out.length === want) break;
    if (out.some((j) => Math.abs(j - i) < 2)) continue;
    out.push(i);
  }
  return out.sort((a, b) => a - b);
}

/**
 * Letters an English learner mixes up. A wrong choice drawn from these makes
 * him think about the sound, where a random "z" would give the answer away.
 */
const LOOK_ALIKES: Record<string, string> = {
  a: "eiou", e: "aiu", i: "eay", o: "au", u: "oai", y: "ie",
  b: "dpv", d: "btp", p: "bqd", q: "pg", v: "fbw", f: "vph", w: "vu",
  m: "nw", n: "mh", c: "ksz", k: "cg", s: "czx", z: "sx", g: "jkq", j: "gy",
  t: "dl", l: "ti", r: "lw", h: "nk", x: "sk",
};

/** The right letter and three wrong ones, shuffled; lower case. */
export function letterChoices(answer: string, rng: Rng): string[] {
  const right = answer.toLowerCase();
  const pool = [...new Set([...(LOOK_ALIKES[right] ?? ""), ..."aeioustrnl"])].filter((c) => c !== right);
  const wrong: string[] = [];
  for (const c of shuffle(rng, [...(LOOK_ALIKES[right] ?? "")])) {
    if (wrong.length < 2 && c !== right && !wrong.includes(c)) wrong.push(c);
  }
  while (wrong.length < 3) {
    const c = pick(rng, pool);
    if (!wrong.includes(c)) wrong.push(c);
  }
  return shuffle(rng, [right, ...wrong]);
}

/** Words that make a fair puzzle: at least three letters. */
export function rescuable(word: string): boolean {
  return [...word].filter(isLetter).length >= 3;
}
