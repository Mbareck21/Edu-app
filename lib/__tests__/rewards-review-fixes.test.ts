// Fixes from the 2026-09-28 review of rewards and progress: idle sessions,
// tiny sessions farming badges, late readings and late days, the closed race,
// the weak-spelling suggestion and the ordinals in the fair-play tip.

import assert from "node:assert/strict";
import test from "node:test";

import { modesFor } from "@/components/drill/picks";
import { todayKey } from "@/lib/day";
import {
  XP,
  applyReading,
  applySession,
  emptyProfile,
  fairPlayTip,
  readingProgress,
} from "@/lib/rewards";
import { nudge } from "@/lib/scoreboard";
import type { ProfileState, SessionResult } from "@/lib/types";

const when = (iso: string) => {
  const at = new Date(iso);
  return { at, today: todayKey(at) };
};

/** A 60 s timed drill he walked away from: the clock ran out, nothing answered. */
const idleDrill: SessionResult = {
  kind: "math",
  ref: "drill:math:fractions:t60#0",
  answered: 0,
  correct: 0,
  fastCount: 0,
  ms: 60_000,
  perfect: false,
  timed: true,
  mathLevel: 1,
};

// ── P1: a session with no answers changes nothing ─────────────────────────

test("a session with no answers leaves the profile exactly as it was", () => {
  const start = applySession(emptyProfile(), { ...idleDrill, ref: "quest:review", kind: "vocab", answered: 10, correct: 9, timed: false }, when("2026-09-28T15:00:00Z")).profile;
  const { profile, gained } = applySession(start, idleDrill, when("2026-09-28T16:00:00Z"));
  assert.deepEqual(profile, start);
  assert.equal(gained.xp, 0);
  assert.deepEqual(gained.newBadges, []);
  assert.equal(gained.streakExtended, false);
  assert.equal(gained.leveledUp, false);
  assert.equal(gained.goalMet, false);
});

test("fifty idle timed drills earn no Math Star, no Math Wizard and no First Win", () => {
  let p: ProfileState = emptyProfile();
  let t = new Date("2026-09-28T15:00:00Z").getTime();
  const earned: string[] = [];
  for (let i = 0; i < 50; i++) {
    const r = applySession(p, idleDrill, when(new Date(t).toISOString()));
    p = r.profile;
    earned.push(...r.gained.newBadges.map((b) => b.id));
    t += 61_000;
  }
  assert.deepEqual(earned, []);
  assert.equal(p.stats.mathSessions, 0);
  assert.equal(p.stats.lessons, 0);
  assert.deepEqual(p.activity, []);
  assert.deepEqual(p.today, emptyProfile().today, "an idle session does not mark the day played");
});

test("idle drills do not use up the drill's two full-pay slots", () => {
  const real: SessionResult = { ...idleDrill, ref: "drill:math:fractions:t60#15", answered: 16, correct: 15, fastCount: 8 };
  let p: ProfileState = emptyProfile();
  p = applySession(p, idleDrill, when("2026-09-28T15:00:00Z")).profile;
  p = applySession(p, idleDrill, when("2026-09-28T15:01:01Z")).profile;
  const afterIdle = applySession(p, real, when("2026-09-28T15:02:02Z")).gained;
  const fresh = applySession(emptyProfile(), real, when("2026-09-28T15:02:02Z")).gained;
  assert.equal(afterIdle.xp, fresh.xp);
  assert.equal(afterIdle.tip, undefined);
});

// ── P2: tiny sessions do not farm the session badges ──────────────────────

test("fifty one-answer perfect sessions earn no Perfect badge", () => {
  const one: SessionResult = { kind: "vocab", ref: "drill:vocab:rescue", answered: 1, correct: 1, fastCount: 0, ms: 6000, perfect: true };
  let p: ProfileState = emptyProfile();
  let t = new Date("2026-09-28T15:00:00Z").getTime();
  const earned: string[] = [];
  for (let i = 0; i < 50; i++) {
    const r = applySession(p, one, when(new Date(t).toISOString()));
    p = r.profile;
    earned.push(...r.gained.newBadges.map((b) => b.id));
    t += 15_000;
  }
  assert.equal(p.stats.perfectSessions, 0);
  assert.deepEqual(earned.filter((id) => id.startsWith("perfect-")), []);
});

test("a perfect session counts toward the Perfect badges only when it pays the perfect bonus", () => {
  const r = (answered: number): SessionResult => ({ kind: "vocab", ref: "list1:match", answered, correct: answered, fastCount: 0, ms: 60_000, perfect: true });
  const two = applySession(emptyProfile(), r(2), when("2026-09-28T15:00:00Z")).profile;
  assert.equal(two.stats.perfectSessions, 0);
  const three = applySession(emptyProfile(), r(3), when("2026-09-28T15:00:00Z")).profile;
  assert.equal(three.stats.perfectSessions, 1);
});

test("a math session of one or two answers is not a math game for Math Star", () => {
  const m = (answered: number): SessionResult => ({ kind: "math", ref: "drill:math:fractions:relaxed", answered, correct: answered, fastCount: 0, ms: 60_000, perfect: false, mathLevel: 1 });
  assert.equal(applySession(emptyProfile(), m(2), when("2026-09-28T15:00:00Z")).profile.stats.mathSessions, 0);
  assert.equal(applySession(emptyProfile(), m(3), when("2026-09-28T15:00:00Z")).profile.stats.mathSessions, 1);
});

// ── P7: a reading sent late keeps its place in time ───────────────────────

test("a reading sent late does not wipe the good readings at his new level", () => {
  let p: ProfileState = { ...emptyProfile(), reading: { level: 3, recent: [], since: "2026-10-01T15:00:00.000Z" } };
  for (const d of ["2026-10-07T22:00:00Z", "2026-10-08T22:00:00Z", "2026-10-09T22:00:00Z"]) {
    p = applyReading(p, { level: 3, pct: 100, wordsCount: 300 }, when(d));
  }
  assert.equal(p.reading.level, 4);
  for (const d of ["2026-10-10T22:00:00Z", "2026-10-11T22:00:00Z"]) {
    p = applyReading(p, { level: 4, pct: 100, wordsCount: 300 }, when(d));
  }
  assert.equal(readingProgress(p.reading, new Date("2026-10-11T23:00:00Z")).goodInARow, 2);
  // Played on Oct 6 at level 3, queued on the phone, sent on Oct 12.
  p = applyReading(p, { level: 3, pct: 100, wordsCount: 300 }, when("2026-10-06T22:00:00Z"));
  assert.equal(readingProgress(p.reading, new Date("2026-10-12T23:00:00Z")).goodInARow, 2);
  assert.deepEqual(
    p.reading.recent.map((r) => r.at),
    [...p.reading.recent.map((r) => r.at)].sort().reverse(),
    "newest first, by when it was read"
  );
  p = applyReading(p, { level: 4, pct: 100, wordsCount: 300 }, when("2026-10-12T22:30:00Z"));
  assert.equal(p.reading.level, 5);
});

test("the reading badge checks a late reading at the time it was read, as it is stored", () => {
  const good = (at: string) => ({ at, level: 4, pct: 100, wordsCount: 300 });
  const p: ProfileState = {
    ...emptyProfile(),
    reading: {
      level: 4,
      recent: [good("2026-08-19T14:00:00.000Z"), good("2026-08-19T13:00:00.000Z")],
      since: "2026-08-19T12:00:00.000Z",
    },
  };
  const reading = { level: 4, pct: 100, wordsCount: 300 };
  // Read at 10:00, before he reached level 4 at noon, and sent later.
  const late = when("2026-08-19T10:00:00Z");
  const r: SessionResult = { kind: "reading", ref: "read:l1@a", answered: 4, correct: 4, fastCount: 0, ms: 480_000, perfect: true, reading };
  const { profile, gained } = applySession(p, r, late);
  const stored = applyReading(profile, reading, late);
  assert.equal(stored.reading.level, 4);
  assert.equal(gained.newBadges.some((b) => b.id === "reading-5"), false);
});

// ── P11: a day sent late still pays its day bonus ─────────────────────────

test("a day played offline and sent after the next day pays the day's bonus, like in order", () => {
  const s: SessionResult = { kind: "vocab", ref: "quest:review", answered: 10, correct: 10, fastCount: 0, ms: 120_000, perfect: true };
  let p = applySession(emptyProfile(), s, when("2026-10-05T15:00:00Z")).profile; // Mon
  p = applySession(p, s, when("2026-10-07T15:00:00Z")).profile; // Wed, sent first
  const tue = applySession(p, s, when("2026-10-06T15:00:00Z")); // Tue, late

  let q = applySession(emptyProfile(), s, when("2026-10-05T15:00:00Z")).profile;
  const inOrder = applySession(q, s, when("2026-10-06T15:00:00Z"));
  q = inOrder.profile;

  assert.equal(tue.gained.xp, inOrder.gained.xp);
  assert.equal(tue.profile.streak.current, 3);
  // A later day is already on the record: the flame is not today's.
  assert.equal(tue.gained.streakExtended, false);
});

test("a late session on a day already played pays no second day bonus", () => {
  const s: SessionResult = { kind: "vocab", ref: "quest:review", answered: 10, correct: 10, fastCount: 0, ms: 120_000, perfect: true };
  let p = applySession(emptyProfile(), s, when("2026-10-06T15:00:00Z")).profile; // Tue
  p = applySession(p, s, when("2026-10-07T15:00:00Z")).profile; // Wed
  const other = { ...s, ref: "quest:new" };
  const lateTue = applySession(p, other, when("2026-10-06T18:00:00Z"));
  const sameDay = applySession(applySession(emptyProfile(), s, when("2026-10-06T15:00:00Z")).profile, other, when("2026-10-06T18:00:00Z"));
  assert.equal(lateTue.gained.xp, sameDay.gained.xp);
  assert.equal(lateTue.gained.xp, 10 * XP.correct + XP.lessonDone + XP.perfect, "no day bonus");
});

// ── P13: ordinals in the fair-play tip ────────────────────────────────────

test("the fair-play tip counts 1st, 2nd, 3rd … 11th, 12th, 13th … 21st, 101st, 111th", () => {
  const cases: [number, string][] = [
    [1, "1st"], [2, "2nd"], [3, "3rd"], [4, "4th"],
    [11, "11th"], [12, "12th"], [13, "13th"],
    [21, "21st"], [22, "22nd"], [23, "23rd"],
    [101, "101st"], [111, "111th"],
  ];
  for (const [n, want] of cases) {
    const tip = fairPlayTip({ factor: 0.25, nth: n, rushed: false, tried: true }) ?? "";
    assert.ok(tip.startsWith(`${want} time today`), `${n}: ${tip}`);
  }
});

// ── P8: after 9:30 pm the nudge says the race is closed ───────────────────

test("once the race has closed, the nudge stops sending him to finish the quest", () => {
  const nour = { name: "Nour", xp: 900, questLeft: 2 };
  const wissam = { name: "Wissam", xp: 2600, questLeft: 0 };
  const rows = [nour, wissam];
  assert.equal(nudge(nour, rows, true), "Tonight's race is closed. A new one starts at midnight.");
  assert.equal(nudge(wissam, rows, true), "You were in tonight's race! A new one starts at midnight.");
  // Open, it is the same nudge as before.
  assert.equal(nudge(nour, rows, false), "Finish today's quest to be in the race: 2 to go!");
});

// ── P12: a word weak on spelling gets a drill that grades spelling ────────

test("a word weak on spelling is not sent to Write it, which grades no skill", () => {
  const modes = modesFor(["spell"]);
  assert.equal(modes.includes("flashcards"), false);
  assert.ok(modes.includes("spell") && modes.includes("write"));
});
