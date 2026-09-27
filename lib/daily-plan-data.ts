// Server side of lib/daily-plan.ts: the day's beats for the signed-in child,
// read the same way Home reads them, for a beat's finish screen.

import { todayKey } from "@/lib/day";
import { db } from "@/lib/db";
import { planProgress, type BeatId, type PlanProgress } from "@/lib/daily-plan";
import { planBeats } from "@/lib/daily-plan-beats";
import { getListSummaries } from "@/lib/lists";
import { getProfile } from "@/lib/profile";

/** Levels by skill id, for the math beat after the school year. */
export function levelsOf(rows: readonly { skill?: unknown; level?: unknown }[]): Record<string, number> {
  return Object.fromEntries(rows.map((r) => [String(r.skill ?? ""), Number(r.level) || 1]));
}

/** The plan as `current`'s finish screen will show it. */
export async function loadPlanProgress(current: BeatId): Promise<PlanProgress> {
  const { MathProgress } = await db();
  const [profile, lists, mathRows] = await Promise.all([
    getProfile(),
    getListSummaries(),
    MathProgress.find().select("skill level").lean(),
  ]);
  const today = todayKey(new Date());
  const beats = planBeats({ activity: profile.activity, lists, mathLevels: levelsOf(mathRows), today });
  return planProgress(beats, current, today);
}
