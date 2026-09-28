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
export const RACE_CAP = 10000;

/** Sessions of one kind a day that count in full; the ones after count half. */
export const RACE_FULL_PER_KIND = 2;

/**
 * The kind of thing a session was, from its activity ref, for the race's
 * variety rule. Grouped by what he is learning, not by the exact ref: a math
 * drill on another skill is still a math drill.
 */
export function activityKind(ref: string): string {
  if (ref.startsWith("quest:")) return ref; // each beat its own kind
  if (ref === "read:structure") return "structure";
  if (ref.startsWith("read:")) return "reading";
  if (ref.startsWith("math:")) return "math lesson";
  if (ref.startsWith("drill:math:")) return "math drill";
  if (ref.startsWith("drill:vocab:")) return "word drill";
  if (ref.startsWith("drill:")) return `drill:${ref.split(":")[1]}`;
  if (ref.startsWith("tables:")) return "tables";
  // A unit step, "<listId>:<step>": kind by step. Its reading is reading.
  const step = ref.split(":")[1];
  if (step === "read") return "reading";
  return step ? `step:${step}` : ref;
}

/**
 * XP that counts in the race on `day`: played before RACE_CLOSES, up to
 * RACE_CAP. Of each kind, the RACE_FULL_PER_KIND biggest sessions count in
 * full and the rest half, so the race is won by mixing it up. Biggest, not
 * first: by order played, a session sent late from an offline phone could
 * push a bigger one into third place and take points off the board. Levels
 * and the profile still get every point; this is only the race.
 */
export function raceXp(
  activity: readonly Pick<ActivityEntry, "at" | "xp" | "ref">[],
  day: string,
  timeZone?: string
): number {
  const byKind = new Map<string, number[]>();
  for (const a of activity) {
    const at = new Date(a.at);
    if (todayKey(at, timeZone) !== day || clockKey(at, timeZone) >= RACE_CLOSES) continue;
    const kind = activityKind(a.ref);
    byKind.set(kind, [...(byKind.get(kind) ?? []), Math.max(0, a.xp || 0)]);
  }
  let sum = 0;
  for (const xps of byKind.values()) {
    xps.sort((x, y) => y - x);
    xps.forEach((xp, i) => {
      sum += i < RACE_FULL_PER_KIND ? xp : Math.floor(xp / 2);
    });
  }
  return Math.min(RACE_CAP, sum);
}

/** True once today's race has closed. */
export function raceClosed(now: Date = new Date(), timeZone?: string): boolean {
  return clockKey(now, timeZone) >= RACE_CLOSES;
}

/** A short cheer for one child, given everyone's race points today. */
export function nudge(me: { xp: number }, rows: readonly { name: string; xp: number }[]): string {
  const others = rows.filter((r) => r !== me);
  const best = others.reduce((a, b) => (b.xp > a.xp ? b : a), others[0]);
  if (!best) return "";
  if (me.xp === 0 && best.xp === 0) return "New day! First to play takes the lead.";
  if (me.xp === 0) return `Play a round to catch ${best.name}!`;
  if (me.xp === best.xp) return "Tied! One more round breaks it.";
  if (me.xp > best.xp) return `Ahead by ${me.xp - best.xp} pts. Keep it up!`;
  return `${best.xp - me.xp} pts to catch ${best.name}!`;
}
