// The daily family scoreboard: each child's XP today, side by side, the total
// they made together, and a line that nudges each one to catch up or stay
// ahead. Days are counted in the kid's timezone and start fresh at midnight.
//
// Pure: safe to import from client components.

import { clockKey, todayKey } from "@/lib/day";
import type { ActivityEntry } from "@/lib/types";

/** The race closes at bedtime: later play still earns XP, just not the day's win. */
export const RACE_CLOSES = "21:30";
/** The most XP that counts in one day's race, so it is not won by playing longest. */
export const RACE_CAP = 5000;

/** XP that counts in the race on `day`: played before RACE_CLOSES, up to RACE_CAP. */
export function raceXp(
  activity: readonly Pick<ActivityEntry, "at" | "xp">[],
  day: string,
  timeZone?: string
): number {
  let sum = 0;
  for (const a of activity) {
    const at = new Date(a.at);
    if (todayKey(at, timeZone) === day && clockKey(at, timeZone) < RACE_CLOSES) {
      sum += Math.max(0, a.xp || 0);
    }
  }
  return Math.min(RACE_CAP, sum);
}

/** True once today's race has closed. */
export function raceClosed(now: Date = new Date(), timeZone?: string): boolean {
  return clockKey(now, timeZone) >= RACE_CLOSES;
}

/** A short cheer for one child, given everyone's XP today. */
export function nudge(me: { xp: number }, rows: readonly { name: string; xp: number }[]): string {
  const others = rows.filter((r) => r !== me);
  const best = others.reduce((a, b) => (b.xp > a.xp ? b : a), others[0]);
  if (!best) return "";
  if (me.xp === 0 && best.xp === 0) return "New day! First to play takes the lead.";
  if (me.xp === 0) return `Play a round to catch ${best.name}!`;
  if (me.xp === best.xp) return "Tied! One more round breaks it.";
  if (me.xp > best.xp) return `Ahead by ${me.xp - best.xp} XP. Keep it up!`;
  return `${best.xp - me.xp} XP to catch ${best.name}!`;
}
