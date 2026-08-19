import type { Level, MathQuestion, MathSkill, MathSkillId, Rng } from "./types";
import { mulberry32, shuffle } from "./rng";
import { MATH_SKILLS, getSkill } from "./skills";

export const MAX_SESSION_COUNT = 40;
export const DEFAULT_SESSION_COUNT = 10;

export type SessionOptions = {
  skillId: MathSkillId;
  level: Level;
  seed: number;
  /** 1..40. Defaults to 10. */
  count?: number;
};

export type MixedSessionOptions = {
  level: Level;
  seed: number;
  /** 1..40. Defaults to 10. */
  count?: number;
};

function clampCount(count: number): number {
  if (!Number.isFinite(count)) return DEFAULT_SESSION_COUNT;
  return Math.min(MAX_SESSION_COUNT, Math.max(1, Math.floor(count)));
}

/**
 * Draws `count` questions. Retries a draw that repeats a prompt already used in
 * this session, and never puts the same prompt twice in a row.
 */
function draw(count: number, level: Level, rng: Rng, skillAt: (index: number) => MathSkill): MathQuestion[] {
  const out: MathQuestion[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < count; i++) {
    const skill = skillAt(i);
    let fresh: MathQuestion | null = null;
    let spare: MathQuestion | null = null;
    for (let tries = 0; tries < 100; tries++) {
      const q = skill.generate(level, rng);
      if (out.length > 0 && out[out.length - 1].prompt === q.prompt) continue;
      if (!spare) spare = q;
      if (!seen.has(q.prompt)) {
        fresh = q;
        break;
      }
    }
    const chosen = fresh ?? spare ?? skill.generate(level, rng);
    seen.add(chosen.prompt);
    out.push(chosen);
  }
  return out;
}

/** One skill, one level. Same seed always gives the same questions. */
export function buildSession({ skillId, level, seed, count = DEFAULT_SESSION_COUNT }: SessionOptions): MathQuestion[] {
  const skill = getSkill(skillId);
  const rng = mulberry32(seed);
  return draw(clampCount(count), level, rng, () => skill);
}

/** Drill mode: spreads the questions evenly over every skill. */
export function mixedSession({ level, seed, count = DEFAULT_SESSION_COUNT }: MixedSessionOptions): MathQuestion[] {
  const rng = mulberry32(seed);
  const order = shuffle(rng, MATH_SKILLS);
  return draw(clampCount(count), level, rng, (i) => order[i % order.length]);
}

/** Only whole numbers count. Spaces, commas and a leading $ are ignored. */
export function gradeAnswer(q: MathQuestion, input: string): { correct: boolean; answer: number } {
  const clean = input.trim().replace(/[\s,$]/g, "");
  const correct = /^\d+$/.test(clean) && Number(clean) === q.answer;
  return { correct, answer: q.answer };
}

/**
 * Level after a session. `recentPcts` is oldest first, newest last (0..100).
 * Last 3 sessions all 90+ -> up (max 3). Last session under 60 -> down (min 1).
 */
export function nextLevel(current: Level, recentPcts: readonly number[]): Level {
  const last3 = recentPcts.slice(-3);
  if (last3.length === 3 && last3.every((p) => p >= 90)) {
    return current === 1 ? 2 : 3;
  }
  const last = recentPcts[recentPcts.length - 1];
  if (recentPcts.length > 0 && last < 60) {
    return current === 3 ? 2 : 1;
  }
  return current;
}
