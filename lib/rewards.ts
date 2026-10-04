// Rewards engine. Pure functions on plain objects — no Mongo, no React.
// Everything the app awards (XP, levels, streak, badges) lives here so it can
// be unit tested without a database.

import { previousDay, todayKey } from "@/lib/day";
import { isDrillRef } from "@/lib/drill-rank";
import { gradeOn, type Grade } from "@/lib/grade";
import { maxReadingLevel } from "@/lib/reading";
import { doneToday, PLAN_ORDER } from "@/lib/daily-plan";
import { activityKind } from "@/lib/scoreboard";
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
// Reading, words and word mastery are the hard, slow work, so they pay more
// than math, which the boys are quick at (the parent's call).
//
// First play today, every answer right (the day's first session adds 15):
//   Times tables, 10 facts, ~1 min ....... 10 x 3.5 + 20 + 30       =  85
//   Math lesson, 10 questions, ~2 min .... L1 120 · L3 155 · L5 190
//   Timed drill 60 s, 15 right, 8 fast ... L1: 15 x 3.5 + 25 + 20   =  98
//   Reading passage, 4 questions, ~8 min . 4 x 150 + 20 + 30        = 650
//     same list again today .............. 4 x 45 + 30              = 210
//   Text structure, 6 texts, ~5 min ...... 6 x 45 + 50              = 320
//     again today ........................ 6 x 15 + 30              = 120
//   Vocab lesson, 10 items, all fast ..... 10 x 15 + 25 + 50        = 225
//   A word reaching known +50, mastered +100, in the session that does it.
// Under 3 answers pays no lesson or perfect bonus; 0 answers changes nothing.
// Pay slides with the share right, in every section and drill. Under
// FULL_PAY_PCT each right answer pays less (accuracyFactor), and a finished
// session of BONUS_MIN_ANSWERED or more answers pays at least XP.finished:
//   Reading passage, first today ......... 4/4 650 · 3/4 470 · 2/4 213 · 1/4 50 · 0/4 5
//   Math lesson L1, 10 questions ......... 10/10 120 · 8/10 76 · 5/10 37 · 2/10 5 · 0/10 5
export const XP = {
  /** Per right word answer (vocab: lessons, review, word drills). */
  correct: 15,
  /** Per right math answer at level 1; see rightXp. */
  mathCorrect: 7,
  /** Per answer given in under 3 seconds, for at most FAST_PAID of them. */
  fast: 5,
  lessonDone: 20,
  perfect: 30,
  /** First session of a new day. */
  streakDay: 15,
  /** Per right answer in a reading: short texts, or a passage read again today. */
  readingCorrect: 45,
  /** Per right answer on a whole passage (about 8 minutes for 4 questions), first today. */
  passageCorrect: 150,
  /** A word that reaches known in this session, and one that reaches mastered. */
  wordKnown: 50,
  wordMastered: 100,
  /**
   * The least a finished session pays, every answer wrong included: he did
   * it, and that is all it pays (the parent's call, 2026-10-04). Only from
   * BONUS_MIN_ANSWERED answers, so one-answer runs cannot farm it.
   */
  finished: 5,
} as const;

/** Most fast answers paid in one session: speed cannot stack past this. */
export const FAST_PAID = 5;
/** Most right answers paid per minute of a timed run. */
export const TIMED_PAID = 20;

/**
 * Most right answers paid in this timed run: TIMED_PAID a minute. The drill's
 * ref names its length (drill:math:<skill>:t120#n); the client picks it, so it
 * is only trusted between one and two minutes.
 */
export function timedPaid(ref: string): number {
  const m = /:t(\d+)(?:#|$)/.exec(ref);
  const seconds = Math.min(120, Math.max(60, m ? Number(m[1]) : 60));
  return Math.round((TIMED_PAID * seconds) / 60);
}
/** Fewest answers for the lesson and perfect bonuses. */
export const BONUS_MIN_ANSWERED = 3;

// ── Fair play ─────────────────────────────────────────────────────────────
// Four rules so that XP follows learning, not a pattern that farms it
// (2026-09-27: nine memorised Text structure rounds in eight minutes paid
// 2,430). Each has its own tests in lib/__tests__/fair-play.test.ts.
//
// 1. Variety. The same kind of thing again today (see activityKind: a math
//    skill, a word-drill type, a beat…) pays less. A lesson or quest beat is
//    full once, then half, then a quarter; a drill is full twice, then half
//    twice, then a quarter. Mixing it up is how he learns different things,
//    and the day is only won with the whole quest done (lib/scoreboard.ts).
// 2. Correctness. Only right answers pay, and the lesson bonus needs at
//    least BONUS_MIN_PCT right: tapping through earns nothing on top.
// 3. Pace. The work in a session can earn at most PACE_CAP XP per minute
//    he actually spent on it, with room above honest work: that peaked
//    near 300 a minute (ten listening items in 42 s); memorised taps ran
//    at 600.
// 4. Accuracy. Below FULL_PAY_PCT right, each right answer pays less, in
//    step with the share right. Paid only per right answer, guessing still
//    earned: tapping at random through a four-choice reading paid a quarter
//    of a careful one, and a timed drill sprayed with guesses paid its full
//    twenty right a minute. Now a quarter right pays a twelfth.
//
// Word-known and word-mastered bonuses and the day's streak are never cut:
// they are the learning itself.

/** The lesson bonus is for a real attempt: at least this share right. */
export const BONUS_MIN_PCT = 50;

/**
 * At least this share right and each right answer pays in full: 3 of 4, the
 * mark of a good reading (READING_UP_PCT), so a steady reader loses nothing.
 */
export const FULL_PAY_PCT = 75;

/** What each right answer is worth, 0..1, at this share right. */
export function accuracyFactor(pct: number): number {
  return Math.min(1, Math.max(0, Number(pct) || 0) / FULL_PAY_PCT);
}

/** Write what you remember: every word he writes is one he recalled, so there is no guess to cut. */
const FREE_RECALL_REF = "drill:vocab:remember";

/**
 * The accuracy factor for a session: right out of the answers he gave. Not
 * out of a timed run's floor (sessionPct): 3 of 3 in a minute is every one
 * right, and was paid at 80% with the 3-of-4 tip. Free recall counts the whole
 * list as answered, so it pays per word remembered, uncut.
 */
export function sessionAccuracy(result: Pick<SessionResult, "ref">, answered: number, correct: number): number {
  if (result.ref === FREE_RECALL_REF || answered <= 0) return 1;
  return accuracyFactor((Math.min(correct, answered) / answered) * 100);
}

/**
 * Faster than this, in words a minute, and the passage was not read. Adults
 * read silently at about 240 (Brysbaert, 2019); a Grade 4 reader going past
 * 300 tapped through to the questions.
 */
export const MAX_READ_WPM = 300;

/**
 * A passage finished faster than it can be read: the whole session, questions
 * included, took less time than the passage alone takes at MAX_READ_WPM. A
 * floor, so it only catches tapping straight through. It does not move his
 * reading level: two rushed ones used to step him down to easier passages,
 * which pay the same, and lucky guesses could step him up. No time (0) is
 * not too fast.
 */
export function readTooFast(result: Pick<SessionResult, "ms" | "reading">): boolean {
  if (!result.reading) return false;
  const ms = Math.max(0, Math.floor(result.ms) || 0);
  const words = Math.max(0, Math.floor(result.reading.wordsCount) || 0);
  return ms > 0 && ms < (words / MAX_READ_WPM) * 60_000;
}

/** Most work XP one active minute can earn, by kind of session. */
export const PACE_CAP = { vocab: 360, math: 240, reading: 200 } as const;

/** Work XP cut to the pace cap. No cap when the time is unknown (0). */
export function paced(work: number, result: Pick<SessionResult, "kind" | "ms">): number {
  const ms = Math.max(0, Math.floor(result.ms) || 0);
  if (ms === 0) return work;
  return Math.min(work, Math.round((ms / 60_000) * PACE_CAP[result.kind]));
}

/** Sessions of one kind a day that pay in full: drills and practice rounds. */
export const FULL_PER_KIND = 2;

/**
 * Sessions of this kind a day that pay in full. A lesson — a quest beat, a
 * reading, a math lesson — is full once: after the day's quest,
 * doing it again brings new material but not the same weight. Drills, tables
 * and stuck-word writing are practice, and the drill driver already turns
 * through them, so they get two; so do the steps of a unit path.
 */
export function fullPerKind(kind: string): number {
  const practice = ["math drill:", "word drill:", "drill:", "tables", "stuck words", "step:"];
  return practice.some((p) => kind.startsWith(p)) ? FULL_PER_KIND : 1;
}

/** What the next session of a kind pays, given how many were played today. */
export function varietyFactor(playedToday: number, full = FULL_PER_KIND): number {
  if (playedToday < full) return 1;
  if (playedToday < full * 2) return 0.5;
  return 0.25;
}

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
    if (result.reading) return firstToday ? XP.passageCorrect : XP.readingCorrect;
    // Text structure: 40 short texts now, but with 15 he knew the answers by
    // the third round in a row, and six taps in thirty seconds paid 300 at the
    // reading rate (2,430 XP in eight minutes on 2026-09-27). Again today, it
    // pays what a word drill's quick choices pay.
    return firstToday ? XP.readingCorrect : XP.correct;
  }
  if (result.kind !== "math") return XP.correct;
  const level = Math.min(5, Math.max(1, Math.floor(Number(result.mathLevel)) || 1));
  const rate = XP.mathCorrect * (1 + 0.25 * (level - 1));
  return result.timed || result.ref.startsWith("tables:") ? rate / 2 : rate;
}

/**
 * What a session is worth before the server has seen it: offline, the runners
 * show this instead of "+0". No lesson bonus, no first-read passage rate, no
 * new streak day, no perfect bonus: it used to add them, and a drill replayed
 * offline showed +77 and paid +57. The phone does not know what else he
 * played today, so a lesson repeated offline (variety) may still pay less.
 */
export function estimateXp(result: SessionResult): number {
  const answered = Math.max(0, Math.floor(result.answered) || 0);
  const correct = Math.min(answered, Math.max(0, Math.floor(result.correct) || 0));
  const fast = Math.min(correct, Math.max(0, Math.floor(result.fastCount) || 0));
  const paidRight = result.timed ? Math.min(correct, timedPaid(result.ref)) : correct;
  // Offline the phone does not know what else he played today, so this is
  // the pay of the first of its kind; a repeat pays less (variety).
  const work = Math.round(
    paced(Math.round(paidRight * rightXp(result, false)) + Math.min(fast, FAST_PAID) * XP.fast, result) *
      sessionAccuracy(result, answered, correct)
  );
  return answered >= BONUS_MIN_ANSWERED ? Math.max(XP.finished, work) : work;
}

/** How far apart a session and its resend may be logged and still be one session. */
export const REPLAY_MATCH_MS = 2 * 60_000;

/**
 * What the first send of a resent session paid, read off the log: the entry
 * with its ref nearest `at`, within REPLAY_MATCH_MS. 0 when there is none: the
 * first send failed after a progress write and before the profile, and its XP
 * was lost (see reserveSession in the sessions route). The phone used to show
 * an estimate either way, so a lost session still said +N.
 */
export function paidXp(activity: readonly Pick<ActivityEntry, "at" | "ref" | "xp">[], ref: string, at: Date): number {
  let best: number | null = null;
  let gap = Infinity;
  for (const a of activity) {
    if (a.ref !== ref) continue;
    const d = Math.abs(new Date(a.at).getTime() - at.getTime());
    if (d <= REPLAY_MATCH_MS && d < gap) {
      gap = d;
      best = a.xp;
    }
  }
  return Math.max(0, best ?? 0);
}

/**
 * The log is the only record behind the race, the rivalry, the drill duel and
 * last week's champion (13 days back). At 200, a 31-session day like
 * 2026-09-27 left barely a week, and the duel lost its early days.
 */
export const ACTIVITY_CAP = 600;

/**
 * Re-exported so the API and the runners keep importing it from one place. The
 * value lives in lib/types.ts next to the steps it applies to; each step now
 * carries its own `passPct`, and production steps sit at PRODUCE_PASS_PCT.
 */
export { STEP_PASS_PCT };

/** Four beats of Today's quest. The /me editor allows MIN..MAX. */
export const DEFAULT_DAILY_GOAL = 4;
export const MIN_DAILY_GOAL = 2;
export const MAX_DAILY_GOAL = PLAN_ORDER.length;

/**
 * Different quest beats done on `day`: what the daily goal counts. It used to
 * count sessions, so four runs of one drill met a goal meant to be four
 * beats of the quest. One kind of thing, however often, is one.
 */
export function beatsDone(activity: readonly Pick<ActivityEntry, "at" | "kind" | "ref">[], day: string): number {
  return Object.values(doneToday(activity, day)).filter(Boolean).length;
}

/** The goal as beats: never more than the quest has. */
export function goalBeats(dailyGoal: number): number {
  return Math.min(Math.max(1, dailyGoal), PLAN_ORDER.length);
}

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
 * ahead. Only the level is read.
 */
function readingLevelAfter(p: ProfileState, r: SessionResult): number {
  if (!r.reading || readTooFast(r)) return p.reading.level;
  // At the time the API stores it (applySession sets playedAt): logged as now,
  // a reading sent late counted here though the stored one did not, and a
  // badge could land for a level he never reached.
  const at = r.playedAt !== undefined ? new Date(r.playedAt) : new Date();
  return applyReading(p, r.reading, { at, today: "" }).reading.level;
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
  /** Why it paid less, in his words: the fair-play rule it met (fairPlayTip). */
  tip?: string;
};

/** 1st, 2nd, 3rd, 4th … 11th, 12th, 13th … 21st, 22nd: a long day of drills reaches the twenties. */
function ordinal(n: number): string {
  const teen = n % 100 >= 11 && n % 100 <= 13;
  return `${n}${(!teen && ["th", "st", "nd", "rd"][n % 10]) || "th"}`;
}

/**
 * One line for the finish screen when a fair-play rule cut the XP, so he
 * learns the rules by playing: mix it up, take your time, get them right.
 */
export function fairPlayTip(s: {
  factor: number;
  nth: number;
  rushed: boolean;
  tried: boolean;
  /** FULL_PAY_PCT or better: every right answer paid in full. Default true. */
  accurate?: boolean;
  /** A passage finished faster than it can be read (readTooFast). */
  skimmed?: boolean;
}): string | undefined {
  if (s.skimmed) return "Read the whole story first: a reading that fast does not count.";
  if (s.factor < 1) {
    const nth = ordinal(s.nth);
    return `${nth} time today: ${s.factor === 0.5 ? "half" : "a quarter of the"} XP. Switch to something new for full XP!`;
  }
  if (s.rushed) return "Take your time: rushing earns less XP.";
  if (!s.tried) return "Get at least half right to earn the finish bonus.";
  if (s.accurate === false) return "Get 3 out of 4 right for full XP on every answer.";
  return undefined;
}

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
  // In the order they were read, not sent: one sent late from the phone's
  // queue went on top, and readingsAtLevel, which stops at the first reading
  // from before the last level change, then saw none at his new level.
  const recent = [entry, ...profile.reading.recent]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, READING_CAP);
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

  // A session with no answers at all is not work: a timed drill left to run
  // out, an empty list. It changes nothing. Logged, fifty idle 60 s drills
  // earned Math Star and Math Wizard at 0 XP, two used up a drill's full-pay
  // slots for the day, and one marked the day played.
  if (answered === 0) {
    return {
      profile,
      gained: {
        xp: 0,
        newBadges: [],
        streakExtended: false,
        leveledUp: false,
        level: levelFor(profile.xp).level,
        goalMet: false,
      },
    };
  }

  // Streak: a new day extends it, a gap resets it to 1. A session played on
  // an earlier day than the last one (sent late from the phone's queue) leaves
  // the streak and today's count alone: they have already moved past it.
  // One or two answers still count for the day.
  const last = profile.streak.lastActiveDay;
  const late = Boolean(last) && now.today < last;
  const sameDay = last === now.today || late;
  const streakExtended = !sameDay;
  // Sent late, it may still be the only session of its day: that pays the
  // day's bonus it would have paid in order (Tuesday offline, Wednesday sent
  // first). The streak flame stays today's.
  const lateNewDay = late && !profile.activity.some((a) => todayKey(new Date(a.at)) === now.today);
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
  const streak = late
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
  const paidRight = result.timed ? Math.min(correct, timedPaid(result.ref)) : correct;
  // Fair play (see the rules above BONUS_MIN_PCT): correctness gates the
  // lesson bonus, accuracy sets what each right answer is worth, the pace cap
  // limits the work to the time it took, and the variety factor cuts a third
  // session of the same kind today.
  const pct = sessionPct({ answered, correct, timed: result.timed });
  const tried = pct >= BONUS_MIN_PCT;
  const kind = activityKind(result.ref);
  const sameKindToday = profile.activity.filter(
    (a) => todayKey(new Date(a.at)) === now.today && activityKind(a.ref) === kind
  ).length;
  const earned =
    Math.round(paidRight * rightXp(result, firstToday)) +
    Math.min(fast, FAST_PAID) * XP.fast +
    (bonuses && firstToday && tried ? XP.lessonDone : 0) +
    (bonuses && perfect ? XP.perfect : 0);
  const capped = paced(earned, result);
  // Accuracy after the pace cap, not before: on a quick run the cap was the
  // limit, and a lucky 2 of 4 in a minute paid what 4 of 4 did.
  const accuracy = sessionAccuracy(result, answered, correct);
  const work = Math.round(capped * accuracy);
  const factor = varietyFactor(sameKindToday, fullPerKind(kind));
  const tip = fairPlayTip({
    factor,
    nth: sameKindToday + 1,
    rushed: capped < earned,
    tried: tried || !bonuses,
    accurate: accuracy >= 1,
    skimmed: readTooFast(result),
  });
  // A finished session pays at least XP.finished, however it went.
  const paid = Math.round(work * factor);
  const xpGained =
    (bonuses ? Math.max(XP.finished, paid) : paid) +
    (streakExtended || lateNewDay ? XP.streakDay : 0) +
    Math.max(0, Math.floor(result.wordsKnownUp ?? 0)) * XP.wordKnown +
    Math.max(0, Math.floor(result.wordsMasteredUp ?? 0)) * XP.wordMastered;

  const lessonsBefore = profile.today.day === now.today ? profile.today.lessons : 0;
  const lessonsToday = lessonsBefore + 1;
  const today = late && profile.today.day !== now.today ? profile.today : { day: now.today, lessons: lessonsToday };

  const entry: ActivityEntry = {
    at: now.at.toISOString(),
    kind: result.kind,
    ref: result.ref,
    pct,
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
      // Counted on the same terms as the bonuses: fifty one-answer rescues
      // in twelve minutes were Perfect 50, and a two-answer drill a math game.
      mathSessions: profile.stats.mathSessions + (result.kind === "math" && bonuses ? 1 : 0),
      perfectSessions: profile.stats.perfectSessions + (bonuses && perfect ? 1 : 0),
      drillXp: profile.stats.drillXp + (isDrillRef(result.ref) ? xpGained : 0),
    },
    activity: [entry, ...profile.activity].slice(0, ACTIVITY_CAP),
  };

  const owned = new Set(next.badges.map((b) => b.id));
  const newBadges: GainedBadge[] = [];
  const checked: SessionResult = { ...result, answered, correct, perfect, playedAt: now.at.getTime() };
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
      ...(tip ? { tip } : {}),
      newBadges,
      streakExtended,
      leveledUp: after.level > before.level,
      level: after.level,
      goalMet:
        !late &&
        beatsDone(next.activity, now.today) >= goalBeats(next.dailyGoal) &&
        beatsDone(profile.activity, now.today) < goalBeats(next.dailyGoal),
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
