// Rewards engine. Pure functions on plain objects — no Mongo, no React.
// Everything the app awards (XP, levels, streak, badges) lives here so it can
// be unit tested without a database.

import { previousDay, todayKey } from "@/lib/day";
import { isDrillRef } from "@/lib/drill-rank";
import { gradeOn, type Grade } from "@/lib/grade";
import { maxReadingLevel } from "@/lib/reading";
import type {
  ActivityEntry,
  EarnedBadge,
  ProfileState,
  ReadingLog,
  ReadingResult,
  SessionResult,
  Streak,
} from "@/lib/types";
import { STEP_PASS_PCT, stepById } from "@/lib/types";
import type { IconName } from "@/components/ui/Icon";
import { sessionPct, sessionPerfect } from "@/lib/session-score";
import { allFactKeys } from "@/lib/tables";

// XP pays for difficulty, so the family scoreboard stays fair between the
// brothers whatever each one plays. A right answer is worth roughly what it
// costs in time and effort; see rightXp().
//
// First play today, every answer right (the day's first session adds 15):
//   Times tables, 10 facts, ~1 min ....... 10 x 5 + 20 + 30         = 100 (was 150)
//     same table again today ............. 10 x 5 + 30              =  80 (was 150)
//   Math lesson, 10 questions, ~2 min .... L1 150 · L2 175 · L3 200 · L4 225 · L5 250
//                                          (was 150 at every level)
//   Timed drill 60 s, 15 right, 8 fast ... L1: 15 x 5 + 25 + 50     = 150 (was 240)
//                                          L5: 15 x 10 + 25 + 50    = 225
//   Reading passage, 4 questions, ~8 min . 4 x 125 + 20 + 30        = 550 (was 90)
//     same list again today .............. 4 x 30 + 30              = 150
//   Text structure, 6 texts, ~5 min ...... 6 x 30 + 50              = 230 (was 110)
//   Vocab lesson, 10 items, all fast ..... 10 x 10 + 25 + 50        = 175 (was 200)
// Under 3 answers pays no lesson or perfect bonus; 0 answers not the day either.
export const XP = {
  correct: 10,
  /** Per answer given in under 3 seconds, for at most FAST_PAID of them. */
  fast: 5,
  lessonDone: 20,
  perfect: 30,
  /** First session of a new day. */
  streakDay: 15,
  /** Per right answer in a reading: short texts, or a passage read again today. */
  readingCorrect: 30,
  /** Per right answer on a whole passage (about 8 minutes for 4 questions), first today. */
  passageCorrect: 125,
} as const;

/** Most fast answers paid in one session: speed cannot stack past this. */
export const FAST_PAID = 5;
/** Most right answers paid in one timed run. */
export const TIMED_PAID = 20;
/** Fewest answers for the lesson and perfect bonuses. */
export const BONUS_MIN_ANSWERED = 3;

/** A timed drill's ref carries its score after `#`; the run itself is the part before. */
function sameRef(a: string, b: string): boolean {
  return a.split("#")[0] === b.split("#")[0];
}

/**
 * XP for one right answer. Math scales with the level played, which the
 * client reports: it is only trusted as far as clamping it to 1..5, and a
 * missing level pays as 1. Tables and timed drills are quick recall and pay
 * half. A passage
 * pays its big rate once per list per day, so reading it again is no farm.
 */
export function rightXp(
  result: Pick<SessionResult, "kind" | "ref" | "timed" | "mathLevel" | "reading">,
  firstToday: boolean
): number {
  if (result.kind === "reading") {
    return result.reading && firstToday ? XP.passageCorrect : XP.readingCorrect;
  }
  if (result.kind !== "math") return XP.correct;
  const level = Math.min(5, Math.max(1, Math.floor(Number(result.mathLevel)) || 1));
  const rate = XP.correct * (1 + 0.25 * (level - 1));
  return result.timed || result.ref.startsWith("tables:") ? rate / 2 : rate;
}

export const ACTIVITY_CAP = 200;

/**
 * Re-exported so the API and the runners keep importing it from one place. The
 * value lives in lib/types.ts next to the steps it applies to; each step now
 * carries its own `passPct`, and production steps sit at PRODUCE_PASS_PCT.
 */
export { STEP_PASS_PCT };

/** Four beats of Today's quest. The /me editor allows MIN..MAX. */
export const DEFAULT_DAILY_GOAL = 4;
export const MIN_DAILY_GOAL = 2;
export const MAX_DAILY_GOAL = 8;

// ── Levels ────────────────────────────────────────────────────────────────
// Level 1 starts at 0 XP. Going from level n to n+1 costs 100 * n XP.
// Cumulative floor of level L is 100 * (L-1) * L / 2: 0, 100, 300, 600, 1000…

export function levelFloor(level: number): number {
  const n = Math.max(1, Math.floor(level)) - 1;
  return (100 * n * (n + 1)) / 2;
}

export function levelFor(xp: number): { level: number; into: number; needed: number } {
  const safe = Math.max(0, Math.floor(xp) || 0);
  let level = 1;
  while (levelFloor(level + 1) <= safe) level++;
  return {
    level,
    into: safe - levelFloor(level),
    needed: levelFloor(level + 1) - levelFloor(level),
  };
}

// ── Badges ────────────────────────────────────────────────────────────────

export type Badge = {
  id: string;
  name: string;
  /** Grade-3 words. Short sentence. */
  blurb: string;
  icon: IconName;
  /** Runs against the profile *after* the session was applied. */
  check(profile: ProfileState, result: SessionResult): boolean;
};

export const BADGES: readonly Badge[] = [
  {
    id: "first-win",
    name: "First Win",
    blurb: "You finished your first lesson.",
    icon: "star",
    check: (p) => p.stats.lessons >= 1,
  },
  {
    id: "streak-3",
    name: "Three in a Row",
    blurb: "You played 3 days in a row.",
    icon: "flame",
    check: (p) => p.streak.current >= 3,
  },
  {
    id: "streak-7",
    name: "Week Star",
    blurb: "You played 7 days in a row.",
    icon: "flame",
    check: (p) => p.streak.current >= 7,
  },
  {
    id: "streak-30",
    name: "Month Star",
    blurb: "You played 30 days in a row.",
    icon: "flame",
    check: (p) => p.streak.current >= 30,
  },
  {
    id: "speed-10",
    name: "Quick Brain",
    blurb: "You gave 10 fast answers.",
    icon: "bolt",
    check: (p) => p.stats.fastAnswers >= 10,
  },
  {
    id: "speed-100",
    name: "Lightning",
    blurb: "You gave 100 fast answers.",
    icon: "bolt",
    check: (p) => p.stats.fastAnswers >= 100,
  },
  {
    id: "perfect-1",
    name: "All Right",
    blurb: "You got a whole lesson right.",
    icon: "check",
    check: (p) => p.stats.perfectSessions >= 1,
  },
  {
    id: "perfect-10",
    name: "Perfect Ten",
    blurb: "You got 10 lessons all right.",
    icon: "trophy",
    check: (p) => p.stats.perfectSessions >= 10,
  },
  {
    id: "right-100",
    name: "Word Hunter",
    blurb: "You got 100 right answers.",
    icon: "book",
    check: (p) => p.stats.correct >= 100,
  },
  {
    id: "right-500",
    name: "Word Master",
    blurb: "You got 500 right answers.",
    icon: "words",
    check: (p) => p.stats.correct >= 500,
  },
  {
    id: "math-star",
    name: "Math Star",
    blurb: "You finished 10 math games.",
    icon: "math",
    check: (p) => p.stats.mathSessions >= 10,
  },
  {
    id: "unit-done",
    name: "Unit Done",
    blurb: "You beat a whole unit.",
    icon: "chest",
    // "Beat", not "played": scoring 0 on the challenge used to earn it.
    check: (_p, r) =>
      r.kind === "vocab" &&
      r.step === "challenge" &&
      r.answered > 0 &&
      Math.round((r.correct / r.answered) * 100) >= stepById("challenge").passPct,
  },
  // Set 2: bigger goals.
  {
    id: "streak-60",
    name: "Two Months",
    blurb: "You played 60 days in a row.",
    icon: "flame",
    check: (p) => p.streak.current >= 60,
  },
  {
    id: "streak-100",
    name: "100 Days",
    blurb: "You played 100 days in a row.",
    icon: "flame",
    check: (p) => p.streak.current >= 100,
  },
  {
    id: "speed-500",
    name: "Super Speed",
    blurb: "You gave 500 fast answers.",
    icon: "bolt",
    check: (p) => p.stats.fastAnswers >= 500,
  },
  {
    id: "perfect-25",
    name: "Perfect 25",
    blurb: "You got 25 lessons all right.",
    icon: "trophy",
    check: (p) => p.stats.perfectSessions >= 25,
  },
  {
    id: "perfect-50",
    name: "Perfect 50",
    blurb: "You got 50 lessons all right.",
    icon: "trophy",
    check: (p) => p.stats.perfectSessions >= 50,
  },
  {
    id: "right-1000",
    name: "Answer Ace",
    blurb: "You got 1,000 right answers.",
    icon: "words",
    check: (p) => p.stats.correct >= 1000,
  },
  {
    id: "right-2500",
    name: "Answer Hero",
    blurb: "You got 2,500 right answers.",
    icon: "sparkles",
    check: (p) => p.stats.correct >= 2500,
  },
  {
    id: "math-50",
    name: "Math Wizard",
    blurb: "You finished 50 math games.",
    icon: "math",
    check: (p) => p.stats.mathSessions >= 50,
  },
  {
    id: "reading-5",
    name: "Book Buddy",
    blurb: "You got to reading level 5.",
    icon: "book",
    check: (p, r) => readingLevelAfter(p, r) >= 5,
  },
  {
    id: "reading-10",
    name: "Top Reader",
    blurb: "You got to reading level 10.",
    icon: "book",
    check: (p, r) => readingLevelAfter(p, r) >= MAX_READING_LEVEL,
  },
  {
    id: "level-10",
    name: "Level 10",
    blurb: "You got to level 10.",
    icon: "star",
    check: (p) => levelFor(p.xp).level >= 10,
  },
  {
    id: "level-20",
    name: "Level 20",
    blurb: "You got to level 20.",
    icon: "star",
    check: (p) => levelFor(p.xp).level >= 20,
  },
  // Set 3: mastery. These read the snapshot the API adds (result.mastery).
  {
    id: "words-25",
    name: "Word Keeper",
    blurb: "You know 25 words.",
    icon: "words",
    check: (_p, r) => (r.mastery?.wordsKnown ?? 0) >= 25,
  },
  {
    id: "words-50",
    name: "Word Collector",
    blurb: "You know 50 words.",
    icon: "words",
    check: (_p, r) => (r.mastery?.wordsKnown ?? 0) >= 50,
  },
  {
    id: "words-100",
    name: "Hundred Words",
    blurb: "You know 100 words.",
    icon: "words",
    check: (_p, r) => (r.mastery?.wordsKnown ?? 0) >= 100,
  },
  {
    id: "table-one",
    name: "Table Tamer",
    blurb: "You know a whole times table.",
    icon: "math",
    check: (_p, r) => (r.mastery?.tablesKnown ?? 0) >= 1,
  },
  {
    id: "grid-lit",
    name: "Grid Glow",
    blurb: "You lit up the whole times-table grid.",
    icon: "sparkles",
    check: (_p, r) => wholeGrid(r, "factsLit"),
  },
  {
    id: "grid-known",
    name: "Table Master",
    blurb: "You know every times-table fact.",
    icon: "trophy",
    check: (_p, r) => wholeGrid(r, "factsKnown"),
  },
  {
    id: "grid-gold",
    name: "Golden Grid",
    blurb: "Every times-table fact is gold.",
    icon: "star",
    check: (_p, r) => wholeGrid(r, "factsGold"),
  },
  {
    id: "math-level-5",
    name: "Top Skill",
    blurb: "You got a math skill to level 5.",
    icon: "math",
    check: (_p, r) => (r.mastery?.mathLevels ?? []).some((l) => l >= 5),
  },
  {
    id: "math-all-3",
    name: "All-Rounder",
    blurb: "You got every math skill to level 3.",
    icon: "math",
    check: (_p, r) => {
      const levels = r.mastery?.mathLevels ?? [];
      return levels.length > 0 && levels.every((l) => l >= 3);
    },
  },
  {
    id: "reading-8",
    name: "Story Explorer",
    blurb: "You got to reading level 8.",
    icon: "book",
    check: (p, r) => readingLevelAfter(p, r) >= 8,
  },
];

/** Every fact on the times-table grid has reached `count`'s mark. */
function wholeGrid(r: SessionResult, count: "factsLit" | "factsKnown" | "factsGold"): boolean {
  return (r.mastery?.[count] ?? 0) >= allFactKeys().length;
}

/**
 * Badges are checked before the API folds this session's reading in (see
 * app/api/sessions/complete/route.ts), so a reading badge looks one reading
 * ahead. Only the level is read; the timestamp is a throwaway.
 */
function readingLevelAfter(p: ProfileState, r: SessionResult): number {
  if (!r.reading) return p.reading.level;
  // Logged as now: a time before the level last changed would not count.
  return applyReading(p, r.reading, { at: new Date(), today: "" }).reading.level;
}

// ── Applying a session ────────────────────────────────────────────────────

export type GainedBadge = { id: string; name: string; blurb: string; icon: IconName };

export type Gained = {
  xp: number;
  newBadges: GainedBadge[];
  streakExtended: boolean;
  leveledUp: boolean;
  level: number;
  /** This session is the one that hit today's goal. */
  goalMet: boolean;
};

export type Now = {
  /** Wall clock, used for timestamps. */
  at: Date;
  /** YYYY-MM-DD in the kid's timezone — see lib/day.ts todayKey(). */
  today: string;
};

export function emptyProfile(name = "Nour"): ProfileState {
  return {
    name,
    xp: 0,
    streak: { current: 0, best: 0, lastActiveDay: "" },
    dailyGoal: DEFAULT_DAILY_GOAL,
    today: { day: "", lessons: 0 },
    badges: [],
    stats: {
      lessons: 0,
      correct: 0,
      answered: 0,
      fastAnswers: 0,
      mathSessions: 0,
      perfectSessions: 0,
      drillXp: 0,
    },
    activity: [],
    reading: { level: 1, recent: [] },
  };
}

export const READING_CAP = 20;
/** Top of the Grade 4 ladder, and the reading-10 badge. See maxReadingLevel. */
export const MAX_READING_LEVEL = 10;

/**
 * Scores that can occur: a reading is 3 to 5 questions, so 0/33/67/100,
 * 0/25/.../100 or 0/20/.../100. An 85 mark meant "perfect three times
 * running". Since readings became four school-style questions (2026-09-23),
 * 80 did the same: 3 of 4 is 75, so only a perfect reading counted and a
 * steady reader never moved. 75 counts 3 of 4 and 4 of 5, still not 2 of 3.
 */
export const READING_UP_PCT = 75;
export const READING_UP_RUN = 3;
export const READING_DOWN_PCT = 50;
export const READING_DOWN_RUN = 2;

/**
 * Move the reading ladder. READING_UP_RUN readings in a row at READING_UP_PCT
 * step up; READING_DOWN_RUN in a row under READING_DOWN_PCT step down, and only
 * readings taken at the current level count. Pure — `recent` is newest first.
 */
export function nextReadingLevel(
  level: number,
  recent: ReadingLog[],
  since?: string,
  grade: Grade = gradeOn(todayKey())
): number {
  const top = maxReadingLevel(grade);
  const cur = Math.min(top, Math.max(1, Math.floor(level) || 1));
  // Only readings taken AT this level can justify leaving it. Reading the whole
  // log meant one promotion cascaded into the next on the very next reading:
  // three good ones at L1 would have walked him L1 -> L4 in five sessions.
  const atLevel = readingsAtLevel(cur, recent, since);
  const runUp = atLevel.slice(0, READING_UP_RUN);
  if (runUp.length === READING_UP_RUN && runUp.every((r) => r.pct >= READING_UP_PCT)) {
    return Math.min(top, cur + 1);
  }
  const runDown = atLevel.slice(0, READING_DOWN_RUN);
  if (
    runDown.length === READING_DOWN_RUN &&
    runDown.every((r) => r.pct < READING_DOWN_PCT)
  ) {
    return Math.max(1, cur - 1);
  }
  return cur;
}

/**
 * The readings that count at `level`, newest first: the ones taken at it since
 * he reached it (`since`). An easier passage left over from before a promotion
 * is practice: it neither counts nor breaks the run. A log with no `since`,
 * written before it existed, stops at the first reading off this level.
 */
function readingsAtLevel(level: number, recent: readonly ReadingLog[], since?: string): ReadingLog[] {
  const from = since ? new Date(since).getTime() : null;
  const out: ReadingLog[] = [];
  for (const r of recent) {
    if (from !== null && new Date(r.at).getTime() < from) break;
    if (from !== null && r.level < level) continue;
    if (r.level !== level) break;
    out.push(r);
  }
  return out;
}

/** Log one finished reading and re-aim the ladder. Never mutates the input. */
export function applyReading(
  profile: ProfileState,
  reading: ReadingResult,
  now: Now
): ProfileState {
  const entry: ReadingLog = {
    at: now.at.toISOString(),
    level: Math.max(1, Math.floor(reading.level) || 1),
    pct: Math.max(0, Math.min(100, Math.round(reading.pct) || 0)),
    wordsCount: Math.max(0, Math.floor(reading.wordsCount) || 0),
    ...(reading.wpm !== undefined
      ? { wpm: Math.max(0, Math.round(reading.wpm) || 0) }
      : {}),
  };
  const recent = [entry, ...profile.reading.recent].slice(0, READING_CAP);
  const { level, since } = profile.reading;
  const next = nextReadingLevel(level, recent, since, gradeOn(todayKey(now.at)));
  return {
    ...profile,
    reading: {
      level: next,
      recent,
      ...(next !== level ? { since: entry.at } : since ? { since } : {}),
    },
  };
}

/**
 * The streak to show on `today`. Only applySession() moves the stored streak,
 * so after skipped days the profile still holds the old number until he plays
 * again, and Home and Me went on showing a streak that was already broken. It
 * is alive while he last played today or yesterday — the same rule applySession
 * uses to extend it.
 */
export function shownStreak(streak: Streak, today: string): number {
  const last = streak.lastActiveDay;
  return last && (last === today || last === previousDay(today)) ? streak.current : 0;
}

/** Days in a row, ending on `last`, with a session in the log. */
function runEndingOn(last: string, activity: readonly Pick<ActivityEntry, "at">[]): number {
  const days = new Set(activity.map((a) => todayKey(new Date(a.at))));
  let run = 0;
  for (let day = last; days.has(day); day = previousDay(day)) run++;
  return run;
}

/**
 * Fold one finished session into the profile. Returns a brand new profile
 * object (the input is never mutated) plus what the kid just gained.
 */
export function applySession(
  profile: ProfileState,
  result: SessionResult,
  now: Now
): { profile: ProfileState; gained: Gained } {
  const answered = Math.max(0, Math.floor(result.answered) || 0);
  const correct = Math.min(answered, Math.max(0, Math.floor(result.correct) || 0));
  const fast = Math.min(correct, Math.max(0, Math.floor(result.fastCount) || 0));
  const ms = Math.max(0, Math.floor(result.ms) || 0);
  // The client's flag is a claim; the rule decides. A timed run has to clear
  // the floor before it is perfect — see lib/session-score.ts.
  const perfect = result.perfect && sessionPerfect({ answered, correct, timed: result.timed });

  // Streak: a new day extends it, a gap resets it to 1. A session played on
  // an earlier day than the last one (sent late from the phone's queue) leaves
  // the streak and today's count alone: they have already moved past it.
  // A session with no answers at all is not a day played: it leaves the streak
  // alone. One or two answers still count for the day.
  const idle = answered === 0;
  const last = profile.streak.lastActiveDay;
  const late = Boolean(last) && now.today < last;
  const sameDay = last === now.today || late;
  const streakExtended = !sameDay && !idle;
  const current = sameDay
    ? profile.streak.current
    : last && previousDay(now.today) === last
      ? profile.streak.current + 1
      : 1;
  // A late session may fill a gap that broke the streak (Tuesday offline,
  // Wednesday sent first), so it counts the run again from the activity log.
  const mended = late
    ? Math.max(profile.streak.current, runEndingOn(last, [{ at: now.at.toISOString() }, ...profile.activity]))
    : current;
  const streak = idle
    ? profile.streak
    : late
      ? { ...profile.streak, current: mended, best: Math.max(profile.streak.best, mended) }
      : {
          current,
          best: Math.max(profile.streak.best, current),
          lastActiveDay: now.today,
        };

  // The same run again today earns its answers, not the lesson bonus again.
  const firstToday = !profile.activity.some(
    (a) => sameRef(a.ref, result.ref) && todayKey(new Date(a.at)) === now.today
  );
  const bonuses = answered >= BONUS_MIN_ANSWERED;
  const paidRight = result.timed ? Math.min(correct, TIMED_PAID) : correct;
  const xpGained =
    Math.round(paidRight * rightXp(result, firstToday)) +
    Math.min(fast, FAST_PAID) * XP.fast +
    (bonuses && firstToday ? XP.lessonDone : 0) +
    (bonuses && perfect ? XP.perfect : 0) +
    (streakExtended ? XP.streakDay : 0);

  const lessonsBefore = profile.today.day === now.today ? profile.today.lessons : 0;
  const lessonsToday = lessonsBefore + 1;
  const today = late && profile.today.day !== now.today ? profile.today : { day: now.today, lessons: lessonsToday };

  const entry: ActivityEntry = {
    at: now.at.toISOString(),
    kind: result.kind,
    ref: result.ref,
    pct: sessionPct({ answered, correct, timed: result.timed }),
    xp: xpGained,
    ms,
  };

  const next: ProfileState = {
    ...profile,
    xp: profile.xp + xpGained,
    streak,
    today,
    badges: [...profile.badges],
    stats: {
      lessons: profile.stats.lessons + 1,
      correct: profile.stats.correct + correct,
      answered: profile.stats.answered + answered,
      fastAnswers: profile.stats.fastAnswers + fast,
      mathSessions: profile.stats.mathSessions + (result.kind === "math" ? 1 : 0),
      perfectSessions: profile.stats.perfectSessions + (perfect ? 1 : 0),
      drillXp: profile.stats.drillXp + (isDrillRef(result.ref) ? xpGained : 0),
    },
    activity: [entry, ...profile.activity].slice(0, ACTIVITY_CAP),
  };

  const owned = new Set(next.badges.map((b) => b.id));
  const newBadges: GainedBadge[] = [];
  const checked: SessionResult = { ...result, answered, correct, perfect };
  for (const badge of BADGES) {
    if (owned.has(badge.id)) continue;
    if (!badge.check(next, checked)) continue;
    const earned: EarnedBadge = { id: badge.id, earnedAt: now.at.toISOString() };
    next.badges.push(earned);
    owned.add(badge.id);
    newBadges.push({
      id: badge.id,
      name: badge.name,
      blurb: badge.blurb,
      icon: badge.icon,
    });
  }

  const before = levelFor(profile.xp);
  const after = levelFor(next.xp);

  return {
    profile: next,
    gained: {
      xp: xpGained,
      newBadges,
      streakExtended,
      leveledUp: after.level > before.level,
      level: after.level,
      goalMet: !late && lessonsToday >= next.dailyGoal && lessonsBefore < next.dailyGoal,
    },
  };
}

/** What the Me page and the finish screen show about his reading. */
export type ReadingProgress = {
  level: number;
  /** Good readings (READING_UP_PCT or better) in a row at this level. */
  goodInARow: number;
  /** Good readings still needed to move up; 0 at the top level. */
  toNext: number;
  /** The last readings' scores, oldest first, for a small chart. */
  scores: number[];
  /** Words a minute from timed reads, oldest first. */
  wpms: number[];
  thisWeek: number;
};

export function readingProgress(
  reading: { level: number; recent: readonly ReadingLog[]; since?: string },
  now: Date = new Date(),
  shown = 10
): ReadingProgress {
  const top = maxReadingLevel(gradeOn(todayKey(now)));
  const level = Math.min(top, Math.max(1, Math.floor(reading.level) || 1));
  let goodInARow = 0;
  for (const r of readingsAtLevel(level, reading.recent, reading.since)) {
    if (r.pct < READING_UP_PCT) break;
    goodInARow++;
  }
  goodInARow = Math.min(goodInARow, READING_UP_RUN);
  const weekAgo = now.getTime() - 7 * 86_400_000;
  return {
    level,
    goodInARow,
    toNext: level >= top ? 0 : READING_UP_RUN - goodInARow,
    scores: reading.recent.slice(0, shown).map((r) => r.pct).reverse(),
    wpms: reading.recent
      .filter((r) => typeof r.wpm === "number" && r.wpm > 0)
      .slice(0, shown)
      .map((r) => r.wpm as number)
      .reverse(),
    thisWeek: reading.recent.filter((r) => new Date(r.at).getTime() >= weekAgo).length,
  };
}
