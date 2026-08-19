import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

// One document per math skill id (see lib/math/skills.ts, workstream C).
// `level` adapts: 3 recent sessions at >= 90% level up, a session under 60%
// levels down. `recentPcts` keeps the last 3 scores that drive that.

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
 */
export function nextLevel(level: number, recentPcts: number[]): number {
  const cur = Math.min(MAX_MATH_LEVEL, Math.max(1, level));
  const last = recentPcts[0] ?? 0;
  if (last < 60) return Math.max(1, cur - 1);
  const three = recentPcts.slice(0, RECENT_PCTS);
  if (three.length === RECENT_PCTS && three.every((p) => p >= 90)) {
    return Math.min(MAX_MATH_LEVEL, cur + 1);
  }
  return cur;
}
