// Rewards engine. Pure functions on plain objects — no Mongo, no React.
// Everything the app awards (XP, levels, streak, badges) lives here so it can
// be unit tested without a database.

import { previousDay } from "@/lib/day";
import type {
  ActivityEntry,
  EarnedBadge,
  ProfileState,
  ReadingLog,
  ReadingResult,
  SessionResult,
} from "@/lib/types";
import type { IconName } from "@/components/ui/Icon";

export const XP = {
  correct: 10,
  /** Per answer given in under 3 seconds. */
  fast: 5,
  lessonDone: 20,
  perfect: 30,
  /** First session of a new day. */
  streakDay: 15,
} as const;

export const ACTIVITY_CAP = 200;

/** Score that marks a unit-path step done. Shared by the API and the runners. */
export const STEP_PASS_PCT = 70;

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
    check: (_p, r) => r.kind === "vocab" && r.step === "challenge",
  },
];

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
    },
    activity: [],
    reading: { level: 1, recent: [] },
  };
}

export const READING_CAP = 20;
export const MAX_READING_LEVEL = 10;

export const READING_UP_PCT = 85;
export const READING_UP_RUN = 3;
export const READING_DOWN_PCT = 70;
export const READING_DOWN_RUN = 2;

/**
 * Move the reading ladder. Three readings in a row at 85%+ step up; two in a
 * row under 70% step down. Pure — `recent` is newest first.
 */
export function nextReadingLevel(level: number, recent: ReadingLog[]): number {
  const cur = Math.min(MAX_READING_LEVEL, Math.max(1, Math.floor(level) || 1));
  const runUp = recent.slice(0, READING_UP_RUN);
  if (runUp.length === READING_UP_RUN && runUp.every((r) => r.pct >= READING_UP_PCT)) {
    return Math.min(MAX_READING_LEVEL, cur + 1);
  }
  const runDown = recent.slice(0, READING_DOWN_RUN);
  if (
    runDown.length === READING_DOWN_RUN &&
    runDown.every((r) => r.pct < READING_DOWN_PCT)
  ) {
    return Math.max(1, cur - 1);
  }
  return cur;
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
  return {
    ...profile,
    reading: { level: nextReadingLevel(profile.reading.level, recent), recent },
  };
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
  const perfect = result.perfect && answered > 0 && correct === answered;

  // Streak: a new day extends it, a gap resets it to 1.
  const last = profile.streak.lastActiveDay;
  const sameDay = last === now.today;
  const streakExtended = !sameDay;
  const current = sameDay
    ? profile.streak.current
    : last && previousDay(now.today) === last
      ? profile.streak.current + 1
      : 1;
  const streak = {
    current,
    best: Math.max(profile.streak.best, current),
    lastActiveDay: now.today,
  };

  const xpGained =
    correct * XP.correct +
    fast * XP.fast +
    XP.lessonDone +
    (perfect ? XP.perfect : 0) +
    (streakExtended ? XP.streakDay : 0);

  const lessonsBefore = profile.today.day === now.today ? profile.today.lessons : 0;
  const lessonsToday = lessonsBefore + 1;

  const entry: ActivityEntry = {
    at: now.at.toISOString(),
    kind: result.kind,
    ref: result.ref,
    pct: answered > 0 ? Math.round((correct / answered) * 100) : 0,
    xp: xpGained,
    ms,
  };

  const next: ProfileState = {
    ...profile,
    xp: profile.xp + xpGained,
    streak,
    today: { day: now.today, lessons: lessonsToday },
    badges: [...profile.badges],
    stats: {
      lessons: profile.stats.lessons + 1,
      correct: profile.stats.correct + correct,
      answered: profile.stats.answered + answered,
      fastAnswers: profile.stats.fastAnswers + fast,
      mathSessions: profile.stats.mathSessions + (result.kind === "math" ? 1 : 0),
      perfectSessions: profile.stats.perfectSessions + (perfect ? 1 : 0),
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
      goalMet: lessonsToday >= next.dailyGoal && lessonsBefore < next.dailyGoal,
    },
  };
}
