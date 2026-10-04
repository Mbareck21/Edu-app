// The parent's competition report (lib/tracker.ts): every session since the
// race began, counted the same way for both children.

import assert from "node:assert/strict";
import test from "node:test";

import { COMPETITION_START, buildReport, sectionOf, toTrack, trackedId, type Tracked } from "@/lib/tracker";
import type { SessionKind } from "@/lib/types";

const QUEST = ["quest:review", "read:abc@2026-09-28T10:00:00.000Z", "math:fractions", "quest:new", "read:structure", "quest:production"];
const kindOf = (ref: string): SessionKind =>
  ref.startsWith("read:") ? "reading" : ref.startsWith("math:") || ref.startsWith("drill:math") ? "math" : "vocab";

/** Sessions on `day` (UTC), one a minute from `hour`. */
function day(d: string, refs: string[], xp: number, pct = 80, hour = 15): Tracked[] {
  return refs.map((ref, i) => ({
    at: `${d}T${String(hour).padStart(2, "0")}:${String(i).padStart(2, "0")}:00.000Z`,
    kind: kindOf(ref),
    ref,
    pct,
    xp,
    ms: 5 * 60_000,
  }));
}

test("tracker: keeps every session from the first race on, each under one id", () => {
  const before = { at: "2026-09-24T15:00:00.000Z", ref: "quest:review" };
  const after = { at: "2026-09-25T15:00:00.000Z", ref: "quest:review" };
  assert.equal(COMPETITION_START, "2026-09-25");
  assert.deepEqual(toTrack([before, after]), [after]);
  assert.equal(trackedId(after), trackedId({ ...after }));
  assert.notEqual(trackedId(after), trackedId(before));
});

test("tracker: sections split text structure from the passages", () => {
  assert.equal(sectionOf({ kind: "reading", ref: "read:structure" }), "Text structure");
  assert.equal(sectionOf({ kind: "reading", ref: "read:abc@x" }), "Reading");
  assert.equal(sectionOf({ kind: "math", ref: "tables:voice" }), "Times tables");
  assert.equal(sectionOf({ kind: "vocab", ref: "drill:vocab:spell" }), "Word drills");
});

test("report: days won follow the race, by the same rules for both", () => {
  // Sep 28: both finish the quest; Nour has more points. Sep 29: Wissam has
  // more points but skipped a beat, so Nour, in the race alone, wins.
  const nour = [...day("2026-09-28", QUEST, 400), ...day("2026-09-29", QUEST, 300)];
  const wissam = [...day("2026-09-28", QUEST, 300, 95), ...day("2026-09-29", QUEST.slice(0, 5), 900, 95)];
  const now = new Date("2026-09-30T15:00:00.000Z");
  const r = buildReport(
    [
      { learner: "nour", name: "Nour", sessions: nour },
      { learner: "wissam", name: "Wissam", sessions: wissam },
    ],
    now,
    "UTC"
  );
  const [n, w] = r.kids;
  assert.equal(r.from, "2026-09-25");
  assert.equal(r.to, "2026-09-30");
  assert.equal(r.dayOf, 6);
  assert.equal(n.daysWon, 2);
  assert.equal(w.daysWon, 0);
  assert.equal(n.questDays, 2);
  assert.equal(w.questDays, 1);
  // Today's race is still open: counted from yesterday back.
  assert.equal(r.days[0].day, "2026-09-29");
  assert.equal(r.days[0].winner, "nour");
  // The scores are his own, whoever won.
  assert.equal(w.overall.avgPct, 95);
  assert.equal(n.overall.avgPct, 80);
  assert.equal(n.bySection["Text structure"].sessions, 2);
  assert.equal(n.overall.minutes, 12 * 5);
});

test("report: worth a look — guessed scores, late play, the longest day", () => {
  const sessions = [
    ...day("2026-09-26", ["drill:vocab:match", "drill:vocab:spell"], 5, 10),
    ...day("2026-09-26", ["drill:math:fractions:relaxed"], 50, 90, 22),
  ];
  const r = buildReport([{ learner: "nour", name: "Nour", sessions }], new Date("2026-09-27T12:00:00.000Z"), "UTC");
  assert.equal(r.kids[0].flags.guessed, 2);
  assert.equal(r.kids[0].flags.late, 1);
  assert.deepEqual(r.kids[0].flags.longestDay, { day: "2026-09-26", minutes: 15 });
});

test("report: the period stops at day 30, and later play is left out", () => {
  const sessions = [...day("2026-10-24", ["quest:review"], 100), ...day("2026-10-25", ["quest:review"], 100)];
  const r = buildReport([{ learner: "nour", name: "Nour", sessions }], new Date("2026-11-02T12:00:00.000Z"), "UTC");
  assert.equal(r.to, "2026-10-24");
  assert.equal(r.dayOf, 30);
  assert.equal(r.kids[0].overall.sessions, 1);
  assert.equal(r.days.length, 30);
  assert.equal(r.kids[0].weeks.length, 5);
});
