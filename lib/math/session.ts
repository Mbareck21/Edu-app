import type { Grade } from "@/lib/grade";
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

/** Top math level: 1-3 are Grade 4, 4-5 are Grade 5. */
export const MAX_LEVEL = 5;

/**
 * The level a skill is played at. Grade 4 plays the stored level. In Grade 5 a
 * level last saved in Grade 4 (or never saved, `savedIn` null) starts at 4 at
 * least. Once saved in Grade 5 it may sit at 3 for support, never lower —
 * without `savedIn` that support drop would be lifted straight back to 4.
 */
export function levelForGrade(stored: number, grade: Grade, savedIn: Grade | null): Level {
  const level = Math.min(MAX_LEVEL, Math.max(1, Math.floor(stored) || 1));
  if (grade === 4) return level as Level;
  return Math.max(level, savedIn === 5 ? 3 : 4) as Level;
}

/** The activity ref of a math lesson: ten questions on one skill. */
export function mathLessonRef(skillId: string): string {
  return `math:${skillId}`;
}

/** A finished math lesson, as opposed to a drill ("drill:math:…") or a tables round ("tables:…"). */
export function isMathLesson(ref: string): boolean {
  return ref.startsWith("math:");
}
