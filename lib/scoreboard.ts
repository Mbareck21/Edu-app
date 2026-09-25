// The daily family scoreboard: each child's XP today, side by side, the total
// they made together, and a line that nudges each one to catch up or stay
// ahead. Days are counted in the kid's timezone and start fresh at midnight.
//
// Pure: safe to import from client components.

import { todayKey } from "@/lib/day";
import type { ActivityEntry } from "@/lib/types";

/** XP earned on `today`. */
export function dayXp(
  activity: readonly Pick<ActivityEntry, "at" | "xp">[],
  today: string,
  timeZone?: string
): number {
  let sum = 0;
  for (const a of activity) {
    if (todayKey(new Date(a.at), timeZone) === today) sum += Math.max(0, a.xp || 0);
  }
  return sum;
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
