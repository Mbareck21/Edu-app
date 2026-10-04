// The brothers' tug of war. Each night the one with more XP that day wins
// the day. The winner gains a point, unless the other holds the points: then
// the other loses one. So there is only ever one holder, and the count is how
// many days ahead he is. A tie moves nothing.
//
// Pure: safe to import from client components.

import { addDays } from "@/lib/day";

/** The first daily race: the scoreboard went daily on this day. */
export const RIVALRY_START = "2026-09-25";

export type Rivalry = {
  /** The last day already counted, YYYY-MM-DD; the day before the start when none is. */
  through: string;
  /** Who holds the points; null when nobody is ahead. */
  holder: string | null;
  points: number;
};

export function freshRivalry(): Rivalry {
  return { through: addDays(RIVALRY_START, -1), holder: null, points: 0 };
}

/** Who won a day, given each child's XP that day: most, above 0, no tie. */
export function dayWinner(xp: Record<string, number>): string | null {
  const ranked = Object.entries(xp).sort((a, b) => b[1] - a[1]);
  const [first, second] = ranked;
  return first && (!second || first[1] > second[1]) && first[1] > 0 ? first[0] : null;
}

/** One finished day, given each child's XP that day. */
export function settleDay(r: Rivalry, day: string, xp: Record<string, number>): Rivalry {
  const winner = dayWinner(xp);
  if (!winner) return { ...r, through: day };
  if (r.points === 0 || r.holder === winner) {
    return { through: day, holder: winner, points: r.points + 1 };
  }
  const points = r.points - 1;
  return { through: day, holder: points === 0 ? null : r.holder, points };
}

/**
 * Every finished day after `r.through`, up to and including `yesterday`.
 * `xpOn(day)` gives each child's XP on that day.
 */
export function settleThrough(
  r: Rivalry,
  yesterday: string,
  xpOn: (day: string) => Record<string, number>
): Rivalry {
  let out = r;
  // addDays gives "" for a key that is not a date, and "" <= yesterday is
  // always true: without the check a bad stored day hangs every render.
  for (let day = addDays(r.through, 1); day && day <= yesterday; day = addDays(day, 1)) {
    out = settleDay(out, day, xpOn(day));
  }
  return out;
}

/** Days a finished day stays open for sessions sent late from an offline phone. */
export const SETTLE_GRACE_DAYS = 2;

/**
 * The rivalry to store, if anything moved, and the one to show. Every day
 * through yesterday is shown, but a day is only stored once SETTLE_GRACE_DAYS
 * have passed. Storing it the first time anyone looked after midnight fixed
 * it before an offline phone had sent that day's sessions, and they never
 * counted: the day went to the other boy.
 */
export function rivalryView(
  stored: Rivalry,
  today: string,
  xpOn: (day: string) => Record<string, number>
): { store: Rivalry | null; shown: Rivalry } {
  const yesterday = addDays(today, -1);
  const settleTo = addDays(yesterday, -SETTLE_GRACE_DAYS);
  const store = stored.through < settleTo ? settleThrough(stored, settleTo, xpOn) : null;
  return { store, shown: settleThrough(store ?? stored, yesterday, xpOn) };
}

/** Points shown for one child. */
export function pointsOf(r: Rivalry, learner: string): number {
  return r.holder === learner ? r.points : 0;
}

/**
 * Scoreboard order: most XP today on top; on a tie (a new day, both at 0)
 * the one holding the trophy points. Otherwise the usual order.
 */
export function rankRows<T extends { learner: string; xp: number }>(rows: readonly T[], r: Rivalry): T[] {
  return [...rows].sort((a, b) => b.xp - a.xp || pointsOf(r, b.learner) - pointsOf(r, a.learner));
}
