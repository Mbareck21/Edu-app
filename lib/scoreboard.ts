// The weekly family scoreboard: each child's XP this week, side by side, and
// the total they made together. Weeks start on Monday, in the kid's timezone.
//
// Pure: safe to import from client components.

import { addDays, todayKey } from "@/lib/day";
import type { ActivityEntry } from "@/lib/types";

/** The Monday on or before a YYYY-MM-DD key. */
export function weekStart(key: string): string {
  const day = new Date(`${key}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(key, -((day + 6) % 7));
}

/** XP earned from Monday up to and including `today`. */
export function weekXp(
  activity: readonly Pick<ActivityEntry, "at" | "xp">[],
  today: string,
  timeZone?: string
): number {
  const from = weekStart(today);
  let sum = 0;
  for (const a of activity) {
    const day = todayKey(new Date(a.at), timeZone);
    if (day >= from && day <= today) sum += Math.max(0, a.xp || 0);
  }
  return sum;
}

/** Days played this week, Monday up to today. */
export function weekDaysPlayed(
  activity: readonly Pick<ActivityEntry, "at">[],
  today: string,
  timeZone?: string
): number {
  const from = weekStart(today);
  const days = new Set<string>();
  for (const a of activity) {
    const day = todayKey(new Date(a.at), timeZone);
    if (day >= from && day <= today) days.add(day);
  }
  return days.size;
}
