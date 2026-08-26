import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

// One document per math skill id (see lib/math/skills.ts, workstream C).
// `level` adapts: 3 recent sessions at >= 90% level up, two in a row under 60%
// level down. `recentPcts` keeps the last 3 scores that drive that.

const MathProgressSchema = new Schema(
  {
    skill: { type: String, required: true, unique: true, trim: true },
    level: { type: Number, default: 1, min: 1, max: 3 },
    attempts: { type: Number, default: 0 },
    correct: { type: Number, default: 0 },
    bestMs: { type: Number, default: 0 }, // 0 = no timed run yet
    recentPcts: { type: [Number], default: [] }, // newest first, max 3
    lastAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export type MathProgressDoc = InferSchemaType<typeof MathProgressSchema> & {
  _id: unknown;
};

export const MathProgress: Model<MathProgressDoc> =
  (models.MathProgress as Model<MathProgressDoc>) ||
  model<MathProgressDoc>("MathProgress", MathProgressSchema);

export const MAX_MATH_LEVEL = 3;
export const RECENT_PCTS = 3;
/** Sessions in a row at this mark or better to move up. */
export const LEVEL_UP_PCT = 90;
export const LEVEL_UP_RUN = 3;
/** Sessions in a row below this to move down. */
export const LEVEL_DOWN_PCT = 60;
export const LEVEL_DOWN_RUN = 2;

export type ClientMathProgress = {
  skill: string;
  level: number;
  attempts: number;
  correct: number;
  bestMs: number;
  recentPcts: number[];
  lastAt: string | null;
};

function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function toClientMathProgress(doc: unknown): ClientMathProgress {
  const d = (doc && typeof doc === "object" ? doc : {}) as Record<string, unknown>;
  return {
    skill: String(d.skill ?? ""),
    level: Math.min(MAX_MATH_LEVEL, Math.max(1, num(d.level, 1) || 1)),
    attempts: num(d.attempts),
    correct: num(d.correct),
    bestMs: num(d.bestMs),
    recentPcts: Array.isArray(d.recentPcts) ? d.recentPcts.map((p) => num(p)) : [],
    lastAt: d.lastAt ? new Date(d.lastAt as string).toISOString() : null,
  };
}

/**
 * Pure level rule, shared by the API and any UI preview.
 * Up when the last 3 sessions are all >= 90%. Down when this one is < 60%.
 *
 * The caller clears `recentPcts` on every level change, so this window only
 * ever holds scores earned at the current level. An empty window means the
 * level has just moved and nothing has been scored on it yet — that is not a
 * reason to move again in either direction.
 */
export function nextLevel(level: number, recentPcts: number[]): number {
  const cur = Math.min(MAX_MATH_LEVEL, Math.max(1, level));
  if (recentPcts.length === 0) return cur;

  const up = recentPcts.slice(0, LEVEL_UP_RUN);
  if (up.length === LEVEL_UP_RUN && up.every((p) => p >= LEVEL_UP_PCT)) {
    return Math.min(MAX_MATH_LEVEL, cur + 1);
  }
  // Two in a row, not one. He learns by repetition and grinds a skill for days;
  // one bad round used to drop him a level AND clear the window, so an off
  // afternoon erased a week of clean rounds.
  const down = recentPcts.slice(0, LEVEL_DOWN_RUN);
  if (down.length === LEVEL_DOWN_RUN && down.every((p) => p < LEVEL_DOWN_PCT)) {
    return Math.max(1, cur - 1);
  }
  return cur;
}

/**
 * Clean rounds banked toward the next level, out of LEVEL_UP_RUN.
 *
 * The math page shows this so a long grind on one skill has a visible target:
 * he can see that two good rounds are in the bank and one more moves him up.
 */
export function cleanRounds(recentPcts: readonly number[]): number {
  let n = 0;
  for (const pct of recentPcts.slice(0, LEVEL_UP_RUN)) {
    if (pct < LEVEL_UP_PCT) break;
    n++;
  }
  return n;
}
