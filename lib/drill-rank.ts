// Drill points: the XP a child earns in drills, adding up to a rank of his
// own and to a weekly duel between the brothers. Weeks start on Monday, in
// the kid's timezone.
//
// Pure: safe to import from client components.

import { addDays, todayKey } from "@/lib/day";
import type { ActivityEntry } from "@/lib/types";

/** Every drill's session ref starts with this (see components/drill/options.ts). */
export function isDrillRef(ref: string): boolean {
  return ref.startsWith("drill:");
}

/** XP from drills in these log entries. */
export function drillXpOf(activity: readonly Pick<ActivityEntry, "ref" | "xp">[]): number {
  return activity.reduce((sum, a) => sum + (isDrillRef(a.ref) ? Math.max(0, a.xp || 0) : 0), 0);
}

export type DrillRank = { name: string; at: number; color: "gold" | "blue" | "purple" | "green" | "coral" };

/** A drill pays about 100-250 XP: Silver is a few drills, Legend a few months. */
export const DRILL_RANKS: readonly DrillRank[] = [
  { name: "Bronze", at: 0, color: "coral" },
  { name: "Silver", at: 500, color: "blue" },
  { name: "Gold", at: 1500, color: "gold" },
  { name: "Platinum", at: 3500, color: "green" },
  { name: "Diamond", at: 7000, color: "blue" },
  { name: "Legend", at: 12000, color: "purple" },
];

export type RankProgress = {
  rank: DrillRank;
  next: DrillRank | null;
  /** 0..1 of the way from this rank to the next; 1 at the top. */
  progress: number;
  toNext: number;
};

export function drillRank(points: number): RankProgress {
  const p = Math.max(0, Math.floor(points) || 0);
  let i = 0;
  while (i + 1 < DRILL_RANKS.length && p >= DRILL_RANKS[i + 1].at) i++;
  const rank = DRILL_RANKS[i];
  const next = DRILL_RANKS[i + 1] ?? null;
  if (!next) return { rank, next, progress: 1, toNext: 0 };
  return { rank, next, progress: (p - rank.at) / (next.at - rank.at), toNext: next.at - p };
}

/** The Monday on or before a YYYY-MM-DD key. */
export function weekStart(key: string): string {
  const day = new Date(`${key}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(key, -((day + 6) % 7));
}

/** Drill XP from Monday `from` through Sunday. */
export function weekDrillXp(
  activity: readonly Pick<ActivityEntry, "at" | "ref" | "xp">[],
  from: string,
  timeZone?: string
): number {
  const to = addDays(from, 6);
  return drillXpOf(
    activity.filter((a) => {
      const day = todayKey(new Date(a.at), timeZone);
      return day >= from && day <= to;
    })
  );
}
