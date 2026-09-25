import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

import { todayKey } from "@/lib/day";
import { gradeOn, type Grade } from "@/lib/grade";
import { MAX_LEVEL, levelForGrade } from "@/lib/math/session";
import type { Level } from "@/lib/math/types";
import { movesLevel, sessionPct, type Scorable } from "@/lib/session-score";

// One document per math skill id (see lib/math/skills.ts, workstream C).
// `level` adapts: 3 recent sessions at >= 90% level up, two in a row under 60%
// level down. `recentPcts` keeps the last 3 scores that drive that.

export const MathProgressSchema = new Schema(
  {
    skill: { type: String, required: true, unique: true, trim: true },
    level: { type: Number, default: 1, min: 1, max: MAX_LEVEL },
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

export const MAX_MATH_LEVEL = MAX_LEVEL;
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

/** Grade the child was in on the day of `at`; null when never played. */
export function gradeAt(at: Date | string | null | undefined): Grade | null {
  return at ? gradeOn(todayKey(new Date(at))) : null;
}

/** The level a skill is played at on `today`, with the Grade 5 floor; see levelForGrade. */
export function servedLevel(p: Pick<ClientMathProgress, "level" | "lastAt"> | null, today: string): Level {
  return levelForGrade(p?.level ?? 1, gradeOn(today), gradeAt(p?.lastAt));
}

/**
 * Pure level rule, shared by the API and any UI preview.
 * Up when the last 3 sessions are all >= 90%. Down when the last 2 are both < 60%.
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
 * Fold one round's score into the level window.
 *
 * `playedLevel` is the level the round was actually played at. A round from
 * another level leaves the window alone: "Play again" after a promotion still
 * runs the old level, and a Math Drill can be played at any level he picks,
 * so easy level-1 rounds were promoting a level-2 skill to 3 and a hard
 * level-3 drill could drop it. Undefined means an older queued session that
 * never said, and counts as the stored level, as it always did.
 */
export function scoreRound(
  level: number,
  recentPcts: readonly number[],
  pct: number,
  playedLevel?: number
): { level: number; recentPcts: number[] } {
  if (playedLevel !== undefined && playedLevel !== level) {
    return { level, recentPcts: [...recentPcts] };
  }
  const recent = [pct, ...recentPcts].slice(0, RECENT_PCTS);
  const next = nextLevel(level, recent);
  // Scores earned at the old level must not also justify the next promotion.
  // Without this, three good level-1 sessions promoted to 2, and then the very
  // next good session saw the same window again and jumped him straight to 3.
  return { level: next, recentPcts: next !== level ? [] : recent };
}

/**
 * One finished round applied to a skill's stored progress on `today`.
 *
 * A level below the Grade 5 floor is lifted first, and the window from the old
 * level is dropped with it. Then the round is scored — unless it is a timed run
 * too short to judge (see movesLevel) — and a Grade 5 result never goes below 3.
 */
export function applyRound(
  stored: { level: number; recentPcts: readonly number[]; lastAt: Date | string | null | undefined },
  run: Scorable & { playedLevel?: number },
  today: string
): { level: number; recentPcts: number[] } {
  const grade = gradeOn(today);
  const level = levelForGrade(stored.level, grade, gradeAt(stored.lastAt));
  const recentPcts = level === stored.level ? [...stored.recentPcts] : [];
  if (!movesLevel(run)) return { level, recentPcts };
  const scored = scoreRound(level, recentPcts, sessionPct(run), run.playedLevel);
  return { level: levelForGrade(scored.level, grade, grade), recentPcts: scored.recentPcts };
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
