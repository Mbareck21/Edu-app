// Server side of lib/daily-plan.ts: the day's beats for the signed-in child.
// loadDay() is the only place the beats are built (a test holds it to that):
// Home, the finish screens and the kid-lock gate all read it, so they cannot
// disagree about where a beat leads, report card or not.

import { todayKey } from "@/lib/day";
import { db } from "@/lib/db";
import { planProgress, type BeatId, type PlanBeat, type PlanProgress } from "@/lib/daily-plan";
import { planBeats } from "@/lib/daily-plan-beats";
import { getListSummaries, type ListSummary } from "@/lib/lists";
import { getProfile } from "@/lib/profile";
import type { SchoolFocus } from "@/lib/school-report";
import { loadFocus } from "@/lib/school-report-store";
import type { ProfileState } from "@/lib/types";

/** Levels by skill id, for the math beat after the school year. */
export function levelsOf(rows: readonly { skill?: unknown; level?: unknown }[]): Record<string, number> {
  return Object.fromEntries(rows.map((r) => [String(r.skill ?? ""), Number(r.level) || 1]));
}

export type Day = {
  today: string;
  profile: ProfileState;
  lists: ListSummary[];
  mathRows: { skill?: unknown; level?: unknown }[];
  /** The report card's focus for today (lib/school-report.ts). NO_FOCUS without one. */
  focus: SchoolFocus;
  beats: PlanBeat[];
};

/** The signed-in child's day: what they have done, their lists, and the beats. */
export async function loadDay(): Promise<Day> {
  const { MathProgress } = await db();
  const today = todayKey(new Date());
  const [profile, lists, mathRows, focus] = await Promise.all([
    getProfile(),
    getListSummaries(),
    MathProgress.find().select("skill level").lean(),
    loadFocus(today),
  ]);
  const beats = planBeats({
    activity: profile.activity,
    lists,
    mathLevels: levelsOf(mathRows),
    today,
    mathCatchUp: focus.mathCatchUp,
  });
  return { today, profile, lists, mathRows, focus, beats };
}

/** The plan as `current`'s finish screen will show it. */
export async function loadPlanProgress(current: BeatId): Promise<PlanProgress> {
  const day = await loadDay();
  return planProgress(day.beats, current, day.today);
}
