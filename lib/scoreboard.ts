// The daily family scoreboard: each child's XP today, side by side, the total
// they made together, and a line that nudges each one to catch up or stay
// ahead. Days are counted in the kid's timezone and start fresh at midnight.
//
// Pure: safe to import from client components.

import { doneToday, PLAN_ORDER } from "@/lib/daily-plan";
import { clockKey, todayKey } from "@/lib/day";
import type { ActivityEntry } from "@/lib/types";

/** The race closes at bedtime: later play still earns XP, just not the day's win. */
export const RACE_CLOSES = "21:30";
/** The most XP that counts in one day's race, so it is not won by playing longest. */
export const RACE_CAP = 10000;

/** Sessions of one kind a day that count in full; the ones after count half. */
export const RACE_FULL_PER_KIND = 2;

/**
 * From this day the XP of each session already carries the variety rule
 * (lib/rewards.ts varietyFactor), so the race adds it up as it is: halving
 * it again here would count a third session at a quarter. Days before keep
 * the race's own rule, so settled days do not move.
 */
export const XP_VARIETY_FROM = "2026-09-28";

/**
 * The kind of thing a session was, from its activity ref, for the race's
 * variety rule. Grouped by what he is learning, not by the exact ref: a math
 * skill is its own thing, and so is each type of word drill — Spell practises
 * something Match does not. They used to be one "math drill" and one "word
 * drill", so a long run through the Drill tab's suggestions, which turn
 * through exactly these, counted half from the fifth drill on.
 */
export function activityKind(ref: string): string {
  if (ref.startsWith("quest:")) return ref; // each beat its own kind
  if (ref === "read:structure") return "structure";
  if (ref.startsWith("read:")) return "reading";
  if (ref.startsWith("math:")) return `math lesson:${ref.split(":")[1]}`;
  if (ref.startsWith("drill:math:")) return `math drill:${ref.split(":")[2]}`;
  if (ref.startsWith("drill:vocab:")) return `word drill:${ref.split(":")[2]}`;
  if (ref.startsWith("drill:")) return `drill:${ref.split(":")[1]}`;
  if (ref.startsWith("tables:")) return "tables";
  if (ref.startsWith("stuck:")) return "stuck words";
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
 * push a bigger one into third place and take points off the board. From
 * XP_VARIETY_FROM each session's XP already carries the rule, and the race
 * adds it up as it is.
 */
export function raceXp(
  activity: readonly Pick<ActivityEntry, "at" | "xp" | "ref">[],
  day: string,
  timeZone?: string
): number {
  const byKind = new Map<string, number[]>();
  let plain = 0;
  for (const a of activity) {
    const at = new Date(a.at);
    if (todayKey(at, timeZone) !== day || clockKey(at, timeZone) >= RACE_CLOSES) continue;
    plain += Math.max(0, a.xp || 0);
    const kind = activityKind(a.ref);
    byKind.set(kind, [...(byKind.get(kind) ?? []), Math.max(0, a.xp || 0)]);
  }
  if (day >= XP_VARIETY_FROM) return Math.min(RACE_CAP, plain);
  let sum = 0;
  for (const xps of byKind.values()) {
    xps.sort((x, y) => y - x);
    xps.forEach((xp, i) => {
      sum += i < RACE_FULL_PER_KIND ? xp : Math.floor(xp / 2);
    });
  }
  return Math.min(RACE_CAP, sum);
}

/**
 * From this day a child can only win the day once he has finished the whole
 * quest before the race closes: a taste of every subject first, then the
 * points. Days before are settled on points alone, so they do not move.
 */
export const QUEST_RULE_FROM = "2026-09-28";

/** Beats of the day's quest still to do, counting what he played before RACE_CLOSES. */
export function questLeft(
  activity: readonly Pick<ActivityEntry, "at" | "kind" | "ref">[],
  day: string,
  timeZone?: string
): number {
  const inTime = activity.filter((a) => {
    const at = new Date(a.at);
    return todayKey(at, timeZone) === day && clockKey(at, timeZone) < RACE_CLOSES;
  });
  const done = doneToday(inTime, day);
  return PLAN_ORDER.filter((id) => !done[id]).length;
}

/**
 * Race points a child needs, as well as the whole quest, to be in the day's
 * race (from QUEST_RULE_FROM). The quest alone pays about 1,000 to 1,500, so
 * the rest comes from drills: a real day's practice, not six quick beats.
 */
export const MIN_WIN_PTS = 2500;

/**
 * The points that can win `day`: the race points, or 0 while he is not in
 * the race — quest unfinished or under MIN_WIN_PTS (from QUEST_RULE_FROM).
 * Nobody in it: nobody wins.
 */
export function winXp(
  activity: readonly Pick<ActivityEntry, "at" | "kind" | "ref" | "xp">[],
  day: string,
  timeZone?: string
): number {
  const pts = raceXp(activity, day, timeZone);
  if (day < QUEST_RULE_FROM) return pts;
  if (questLeft(activity, day, timeZone) > 0 || pts < MIN_WIN_PTS) return 0;
  return pts;
}

/** True once today's race has closed. */
export function raceClosed(now: Date = new Date(), timeZone?: string): boolean {
  return clockKey(now, timeZone) >= RACE_CLOSES;
}

/** In the day's race: the whole quest, and MIN_WIN_PTS (rows without a quest count are in). */
function inRace(r: { xp: number; questLeft?: number }): boolean {
  return (r.questLeft ?? 0) === 0 && (r.questLeft === undefined || r.xp >= MIN_WIN_PTS);
}

/**
 * A short cheer for one child, given everyone's race points today and how
 * much of the quest each has left: until his quest is done and he has
 * MIN_WIN_PTS he is not in the race, and only rivals who are in it count.
 * After RACE_CLOSES (`closed`) nothing he plays moves tonight's race, so it
 * no longer sends him to finish the quest or catch up.
 */
export function nudge(
  me: { xp: number; questLeft?: number },
  rows: readonly { name: string; xp: number; questLeft?: number }[],
  closed = false
): string {
  if (closed) {
    return inRace(me)
      ? "You were in tonight's race! A new one starts at midnight."
      : "Tonight's race is closed. A new one starts at midnight.";
  }
  const left = me.questLeft ?? 0;
  if (left > 0) return `Finish today's quest to be in the race: ${left} to go!`;
  if (!inRace(me)) return `Quest done! ${(MIN_WIN_PTS - me.xp).toLocaleString("en-US")} more pts to be in the race: try a drill!`;
  const others = rows.filter((r) => r !== me && inRace(r));
  if (others.length === 0 && rows.length > 1) return "You're in the race! Keep it up.";
  const best = others.reduce((a, b) => (b.xp > a.xp ? b : a), others[0]);
  if (!best) return "";
  if (me.xp === 0 && best.xp === 0) return "New day! First to play takes the lead.";
  if (me.xp === 0) return `Play a round to catch ${best.name}!`;
  if (me.xp === best.xp) return "Tied! One more round breaks it.";
  if (me.xp > best.xp) return `Ahead by ${me.xp - best.xp} pts. Keep it up!`;
  return `${best.xp - me.xp} pts to catch ${best.name}!`;
}
