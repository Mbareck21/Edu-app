import assert from "node:assert/strict";
import test from "node:test";

import { DRILL_RANKS, drillRank, drillXpOf, isDrillRef, weekDrillXp, weekStart } from "@/lib/drill-rank";
import { toProfileState } from "@/lib/models/Profile";
import { applySession, emptyProfile } from "@/lib/rewards";

const TZ = "America/Chicago";

test("only drill refs count as drill points", () => {
  assert.ok(isDrillRef("drill:math:mixed:timed#12"));
  assert.ok(isDrillRef("drill:vocab:remember"));
  assert.ok(!isDrillRef("tables:voice"));
  assert.equal(drillXpOf([{ ref: "drill:vocab:mixed", xp: 100 }, { ref: "read:abc", xp: 500 }]), 100);
});

test("ranks climb at their marks and fill toward the next", () => {
  assert.equal(drillRank(0).rank.name, "Bronze");
  assert.equal(drillRank(499).rank.name, "Bronze");
  assert.equal(drillRank(500).rank.name, "Silver");
  assert.equal(drillRank(1000).progress, 0.5);
  assert.equal(drillRank(1000).toNext, 500);
  const top = drillRank(99_999);
  assert.equal(top.rank, DRILL_RANKS[DRILL_RANKS.length - 1]);
  assert.equal(top.next, null);
  assert.equal(top.progress, 1);
});

test("the duel counts drill points from Monday to Sunday in the kid's timezone", () => {
  const monday = weekStart("2026-09-25");
  assert.equal(monday, "2026-09-21");
  const activity = [
    { at: "2026-09-25T15:00:00.000Z", ref: "drill:vocab:mixed", xp: 120 }, // Friday
    { at: "2026-09-21T15:00:00.000Z", ref: "drill:math:mixed:timed#9", xp: 80 }, // Monday
    { at: "2026-09-21T00:30:00.000Z", ref: "drill:vocab:mixed", xp: 999 }, // Sunday night in Chicago
    { at: "2026-09-22T15:00:00.000Z", ref: "tables:voice", xp: 50 }, // not a drill
  ];
  assert.equal(weekDrillXp(activity, monday, TZ), 200);
  assert.equal(weekDrillXp(activity, "2026-09-14", TZ), 999);
});

test("a drill adds its XP to the all-time drill total; other sessions do not", () => {
  const now = { at: new Date("2026-09-25T15:00:00Z"), today: "2026-09-25" };
  const base = { answered: 10, correct: 10, fastCount: 0, ms: 60_000, perfect: false };
  const drilled = applySession(emptyProfile(), { ...base, kind: "vocab", ref: "drill:vocab:mixed" }, now);
  assert.equal(drilled.profile.stats.drillXp, drilled.gained.xp);
  const lesson = applySession(drilled.profile, { ...base, kind: "vocab", ref: "lesson:x" }, now);
  assert.equal(lesson.profile.stats.drillXp, drilled.gained.xp);
});

test("a profile saved before the total existed takes it from the log", () => {
  const doc = {
    stats: { lessons: 2 },
    activity: [
      { at: "2026-09-25T15:00:00Z", kind: "vocab", ref: "drill:vocab:mixed", pct: 100, xp: 120, ms: 1 },
      { at: "2026-09-24T15:00:00Z", kind: "reading", ref: "read:x", pct: 100, xp: 500, ms: 1 },
    ],
  };
  assert.equal(toProfileState(doc).stats.drillXp, 120);
  assert.equal(toProfileState({ ...doc, stats: { drillXp: 7 } }).stats.drillXp, 7);
});
