import assert from "node:assert/strict";
import test from "node:test";

import { previousDay, lastSevenDays, todayKey } from "@/lib/day";
import {
  BADGES,
  XP,
  applySession,
  emptyProfile,
  levelFloor,
  levelFor,
} from "@/lib/rewards";
import type { ProfileState, SessionResult } from "@/lib/types";

const AT = new Date("2026-08-19T10:00:00.000Z");

function result(over: Partial<SessionResult> = {}): SessionResult {
  return {
    kind: "vocab",
    ref: "list1:match",
    answered: 10,
    correct: 8,
    fastCount: 3,
    ms: 60_000,
    perfect: false,
    ...over,
  };
}

function now(today = "2026-08-19") {
  return { at: AT, today };
}

// ── day helpers ───────────────────────────────────────────────────────────

test("previousDay steps back over month and year borders", () => {
  assert.equal(previousDay("2026-08-19"), "2026-08-18");
  assert.equal(previousDay("2026-03-01"), "2026-02-28");
  assert.equal(previousDay("2026-01-01"), "2025-12-31");
});

test("lastSevenDays returns 7 keys, oldest first", () => {
  const days = lastSevenDays("2026-08-19");
  assert.equal(days.length, 7);
  assert.equal(days[0], "2026-08-13");
  assert.equal(days[6], "2026-08-19");
});

test("todayKey formats YYYY-MM-DD in the given timezone", () => {
  // 22:00 UTC is already the next day in Riyadh (UTC+3).
  const at = new Date("2026-08-19T22:00:00.000Z");
  assert.equal(todayKey(at, "Asia/Riyadh"), "2026-08-20");
  assert.equal(todayKey(at, "UTC"), "2026-08-19");
});

// ── levels ────────────────────────────────────────────────────────────────

test("levelFloor follows the 100 * n triangular table", () => {
  assert.equal(levelFloor(1), 0);
  assert.equal(levelFloor(2), 100);
  assert.equal(levelFloor(3), 300);
  assert.equal(levelFloor(4), 600);
  assert.equal(levelFloor(5), 1000);
});

test("levelFor reports level, progress into it and what it needs", () => {
  assert.deepEqual(levelFor(0), { level: 1, into: 0, needed: 100 });
  assert.deepEqual(levelFor(99), { level: 1, into: 99, needed: 100 });
  assert.deepEqual(levelFor(100), { level: 2, into: 0, needed: 200 });
  assert.deepEqual(levelFor(450), { level: 3, into: 150, needed: 300 });
  assert.equal(levelFor(-5).level, 1);
});

// ── xp ────────────────────────────────────────────────────────────────────

test("xp adds correct, fast, lesson, perfect and the day bonus", () => {
  const { gained } = applySession(emptyProfile(), result(), now());
  // 8 correct + 3 fast + lesson + first day of the streak.
  assert.equal(
    gained.xp,
    8 * XP.correct + 3 * XP.fast + XP.lessonDone + XP.streakDay
  );
});

test("a perfect session adds the perfect bonus", () => {
  const { gained } = applySession(
    emptyProfile(),
    result({ correct: 10, perfect: true }),
    now()
  );
  assert.equal(
    gained.xp,
    10 * XP.correct + 3 * XP.fast + XP.lessonDone + XP.perfect + XP.streakDay
  );
});

test("perfect is ignored when the counts disagree", () => {
  const { profile } = applySession(emptyProfile(), result({ perfect: true }), now());
  assert.equal(profile.stats.perfectSessions, 0);
});

test("the day bonus is paid once per day", () => {
  const first = applySession(emptyProfile(), result(), now()).profile;
  const second = applySession(first, result(), now());
  assert.equal(second.gained.streakExtended, false);
  assert.equal(second.gained.xp, 8 * XP.correct + 3 * XP.fast + XP.lessonDone);
});

// ── streak ────────────────────────────────────────────────────────────────

test("a session on the next day extends the streak", () => {
  const day1 = applySession(emptyProfile(), result(), now("2026-08-19")).profile;
  const day2 = applySession(day1, result(), now("2026-08-20"));
  assert.equal(day2.profile.streak.current, 2);
  assert.equal(day2.profile.streak.best, 2);
  assert.equal(day2.gained.streakExtended, true);
});

test("a missed day resets the streak but keeps the best", () => {
  let p: ProfileState = emptyProfile();
  for (const day of ["2026-08-17", "2026-08-18", "2026-08-19"]) {
    p = applySession(p, result(), now(day)).profile;
  }
  assert.equal(p.streak.current, 3);
  const after = applySession(p, result(), now("2026-08-25")).profile;
  assert.equal(after.streak.current, 1);
  assert.equal(after.streak.best, 3);
});

// ── today / goal ──────────────────────────────────────────────────────────

test("today's lesson count resets on a new day", () => {
  let p = applySession(emptyProfile(), result(), now("2026-08-19")).profile;
  p = applySession(p, result(), now("2026-08-19")).profile;
  assert.deepEqual(p.today, { day: "2026-08-19", lessons: 2 });
  p = applySession(p, result(), now("2026-08-20")).profile;
  assert.deepEqual(p.today, { day: "2026-08-20", lessons: 1 });
});

test("goalMet fires once, on the session that reaches the goal", () => {
  let p: ProfileState = { ...emptyProfile(), dailyGoal: 2 };
  const a = applySession(p, result(), now());
  assert.equal(a.gained.goalMet, false);
  p = a.profile;
  const b = applySession(p, result(), now());
  assert.equal(b.gained.goalMet, true);
  const c = applySession(b.profile, result(), now());
  assert.equal(c.gained.goalMet, false);
});

// ── badges ────────────────────────────────────────────────────────────────

test("BADGES has 12 entries with unique ids", () => {
  assert.equal(BADGES.length, 12);
  assert.equal(new Set(BADGES.map((b) => b.id)).size, 12);
});

test("the first lesson earns first-win, and only once", () => {
  const first = applySession(emptyProfile(), result(), now());
  assert.ok(first.gained.newBadges.some((b) => b.id === "first-win"));
  const second = applySession(first.profile, result(), now());
  assert.equal(second.gained.newBadges.some((b) => b.id === "first-win"), false);
  assert.equal(first.profile.badges.filter((b) => b.id === "first-win").length, 1);
});

test("finishing the challenge step earns unit-done", () => {
  const { gained } = applySession(
    emptyProfile(),
    result({ step: "challenge", listId: "list1", ref: "list1:challenge" }),
    now()
  );
  assert.ok(gained.newBadges.some((b) => b.id === "unit-done"));
});

test("three streak days earn the 3-day badge", () => {
  let p: ProfileState = emptyProfile();
  let earned = false;
  for (const day of ["2026-08-17", "2026-08-18", "2026-08-19"]) {
    const r = applySession(p, result(), now(day));
    p = r.profile;
    earned = earned || r.gained.newBadges.some((b) => b.id === "streak-3");
  }
  assert.ok(earned);
});

test("ten math sessions earn math-star", () => {
  let p: ProfileState = emptyProfile();
  let earned = false;
  for (let i = 0; i < 10; i++) {
    const r = applySession(
      p,
      result({ kind: "math", mathSkill: "add-20", ref: "add-20" }),
      now()
    );
    p = r.profile;
    earned = earned || r.gained.newBadges.some((b) => b.id === "math-star");
  }
  assert.equal(p.stats.mathSessions, 10);
  assert.ok(earned);
});

// ── activity + immutability ───────────────────────────────────────────────

test("activity gets the newest entry first and is capped at 200", () => {
  let p: ProfileState = emptyProfile();
  for (let i = 0; i < 205; i++) {
    p = applySession(p, result({ ref: `run-${i}` }), now()).profile;
  }
  assert.equal(p.activity.length, 200);
  assert.equal(p.activity[0].ref, "run-204");
  assert.equal(p.activity[0].pct, 80);
});

test("applySession does not mutate the profile it was given", () => {
  const before = emptyProfile();
  const snapshot = JSON.stringify(before);
  applySession(before, result(), now());
  assert.equal(JSON.stringify(before), snapshot);
});

test("leveledUp is reported when the level changes", () => {
  const p: ProfileState = { ...emptyProfile(), xp: 95 };
  const { gained } = applySession(p, result(), now());
  assert.equal(gained.leveledUp, true);
  assert.ok(gained.level >= 2);
});
