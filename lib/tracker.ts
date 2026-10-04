/**
 * The parent's record of the competition: how each child did in every
 * section since the daily race began, counted by the same rules for both,
 * for the reward at the end of the month. Grown-ups only (/me/report); the
 * children never see it.
 *
 * The activity log on each profile keeps only the last ACTIVITY_CAP sessions,
 * and a 31-session day ran through that in under three weeks. So every
 * session from the start is also kept, unchanged, in a "tracked" collection
 * on that child's database (lib/tracker-store.ts), and the report is built
 * from that copy.
 *
 * Pure: hand it the sessions, get the numbers.
 */

import { addDays, clockKey, todayKey } from "@/lib/day";
import { xpArea, type XpArea } from "@/lib/digest";
import { RIVALRY_START, dayWinner } from "@/lib/rivalry";
import { RACE_CLOSES, questLeft, raceClosed, winXp } from "@/lib/scoreboard";
import type { ActivityEntry } from "@/lib/types";

/** Day 1 of the competition: the first daily race. */
export const COMPETITION_START = RIVALRY_START;
/** The reward period. */
export const REPORT_DAYS = 30;
/** Under this share right, a session looks guessed rather than worked. */
export const GUESS_PCT = 25;

export type Tracked = Pick<ActivityEntry, "at" | "kind" | "ref" | "pct" | "xp" | "ms">;

/** One id per session, the same however often it is copied. */
export function trackedId(a: Pick<ActivityEntry, "at" | "ref">): string {
  return `${a.at}|${a.ref}`;
}

/** The sessions the tracker keeps: every one from the start of the competition. */
export function toTrack<T extends Pick<ActivityEntry, "at">>(activity: readonly T[], from = COMPETITION_START): T[] {
  return activity.filter((a) => todayKey(new Date(a.at)) >= from);
}

export type Section = XpArea | "Text structure";

/** Where a session belongs in the report. Text structure is not the passages. */
export function sectionOf(a: Pick<ActivityEntry, "kind" | "ref">): Section {
  return a.ref === "read:structure" ? "Text structure" : xpArea(a);
}

export const SECTIONS: readonly Section[] = [
  "Reading",
  "Text structure",
  "Words",
  "Word drills",
  "Math lessons",
  "Math drills",
  "Times tables",
  "Other",
];

export type Totals = {
  sessions: number;
  /** Average score of the sessions, 0-100; null with none. */
  avgPct: number | null;
  minutes: number;
  xp: number;
};

function totals(entries: readonly Tracked[]): Totals {
  const n = entries.length;
  return {
    sessions: n,
    avgPct: n === 0 ? null : Math.round(entries.reduce((s, a) => s + a.pct, 0) / n),
    minutes: Math.round(entries.reduce((s, a) => s + Math.max(0, a.ms || 0), 0) / 60_000),
    xp: entries.reduce((s, a) => s + Math.max(0, a.xp || 0), 0),
  };
}

export type KidReport = {
  learner: string;
  name: string;
  overall: Totals;
  bySection: Record<Section, Totals>;
  daysPlayed: number;
  /** Days won in the daily race. */
  daysWon: number;
  /** Days with the whole quest done before the race closed. */
  questDays: number;
  /** Days in the race: the whole quest and the points to be in it. */
  raceDays: number;
  /** Seven-day blocks from the start, oldest first. */
  weeks: { from: string; to: string; totals: Totals }[];
  /** Worth a look: scores that look guessed, play after the race closed, the longest day. */
  flags: { guessed: number; late: number; longestDay: { day: string; minutes: number } | null };
};

export type DayRow = { day: string; points: Record<string, number>; winner: string | null };

export type Report = {
  from: string;
  /** The last day counted: today, or the last day of the period if it is over. */
  to: string;
  /** Which day of REPORT_DAYS `to` is. */
  dayOf: number;
  kids: KidReport[];
  /** Every day whose race is over, newest first. */
  days: DayRow[];
};

/**
 * The report for `kids` from COMPETITION_START: today's race counts once it
 * has closed. Every number comes from the same rules for every child.
 */
export function buildReport(
  kids: readonly { learner: string; name: string; sessions: readonly Tracked[] }[],
  now: Date = new Date(),
  timeZone?: string
): Report {
  const from = COMPETITION_START;
  const last = addDays(from, REPORT_DAYS - 1);
  const today = todayKey(now, timeZone);
  const to = today < last ? today : last;
  // Days whose race is decided: through yesterday, and today once it closed.
  const decidedTo = to < today || raceClosed(now, timeZone) ? to : addDays(to, -1);

  const inPeriod = kids.map((k) => ({
    ...k,
    sessions: k.sessions.filter((a) => {
      const d = todayKey(new Date(a.at), timeZone);
      return d >= from && d <= to;
    }),
  }));

  const days: DayRow[] = [];
  for (let day = from; day && day <= decidedTo; day = addDays(day, 1)) {
    const points = Object.fromEntries(inPeriod.map((k) => [k.learner, winXp(k.sessions, day, timeZone)]));
    days.push({ day, points, winner: dayWinner(points) });
  }

  const reports = inPeriod.map((k): KidReport => {
    const dayOf = (a: Tracked) => todayKey(new Date(a.at), timeZone);
    const played = new Set(k.sessions.map(dayOf));
    const minutesByDay = new Map<string, number>();
    for (const a of k.sessions) {
      minutesByDay.set(dayOf(a), (minutesByDay.get(dayOf(a)) ?? 0) + Math.max(0, a.ms || 0) / 60_000);
    }
    const longest = [...minutesByDay].sort((x, y) => y[1] - x[1])[0];
    const weeks: KidReport["weeks"] = [];
    for (let start = from; start <= to; start = addDays(start, 7)) {
      const end = addDays(start, 6) < to ? addDays(start, 6) : to;
      weeks.push({ from: start, to: end, totals: totals(k.sessions.filter((a) => dayOf(a) >= start && dayOf(a) <= end)) });
    }
    return {
      learner: k.learner,
      name: k.name,
      overall: totals(k.sessions),
      bySection: Object.fromEntries(
        SECTIONS.map((s) => [s, totals(k.sessions.filter((a) => sectionOf(a) === s))])
      ) as Record<Section, Totals>,
      daysPlayed: played.size,
      daysWon: days.filter((d) => d.winner === k.learner).length,
      questDays: days.filter((d) => questLeft(k.sessions, d.day, timeZone) === 0).length,
      raceDays: days.filter((d) => d.points[k.learner] > 0).length,
      weeks,
      flags: {
        guessed: k.sessions.filter((a) => a.pct < GUESS_PCT).length,
        late: k.sessions.filter((a) => clockKey(new Date(a.at), timeZone) >= RACE_CLOSES).length,
        longestDay: longest ? { day: longest[0], minutes: Math.round(longest[1]) } : null,
      },
    };
  });

  return {
    from,
    to,
    dayOf: Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1,
    kids: reports,
    days: days.reverse(),
  };
}
