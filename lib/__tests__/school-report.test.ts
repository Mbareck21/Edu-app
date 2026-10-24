// The report card's rules. Every card here is made up: the repo is public, and
// no real child's scores belong in it.

import assert from "node:assert/strict";
import test from "node:test";

import { mathSkillFor, planBeats } from "@/lib/daily-plan-beats";
import { buildLesson, buildProductionSession } from "@/lib/lesson-builder";
import type { LessonItem } from "@/lib/items";
import type { ListSummary } from "@/lib/lists";
import { currentLesson } from "@/lib/math/iready";
import { mulberry32 } from "@/lib/math/rng";
import type { ClientWord, SkillState } from "@/lib/models/WordList";
import { questionPlan } from "@/lib/reading";
import {
  MAX_CATCH_UP,
  NO_FOCUS,
  REPORT_ROWS,
  SCHOOL_YEAR_ID,
  TEACHER_TOPICS,
  emptyReport,
  fluencyGoalFor,
  focusFor,
  latestScores,
  parseReport,
  type SchoolReport,
} from "@/lib/school-report";

type Cell = 1 | 2 | 3 | null;
function card(scores: Record<string, [Cell, Cell, Cell, Cell]>, extra: Partial<SchoolReport> = {}): SchoolReport {
  return {
    ...emptyReport(),
    standards: Object.entries(scores).map(([code, s]) => ({ code, scores: s })),
    ...extra,
  };
}
const DAY = "2026-10-24";

test("the card's rows come from the curriculum the app already files", () => {
  const codes = REPORT_ROWS.map((r) => r.code);
  assert.equal(new Set(codes).size, codes.length, "a row is listed twice");
  for (const code of ["4.FR.1.PD", "4.FR.4.PE", "4.FR.6.F", "4.RC.2.RF", "4.L.14.S", "4.W.4.P", "4.V.2"]) {
    assert.ok(codes.includes(code), `missing ${code}`);
  }
  for (const code of ["4.NPV.1", "4.NPV.2", "4.NPV.7", "4.CAR.2", "4.CAR.3", "4.CAR.4", "4.CAR.8", "4.GM.3", "4.GM.5", "4.DA.1"]) {
    assert.ok(codes.includes(code), `missing ${code}`);
  }
  assert.ok(codes.includes("4-LS1-1") && codes.includes("4-LS1-2"));
  for (const row of REPORT_ROWS) assert.ok(row.label.length > 0 && row.label.length <= 90, `${row.code}: label "${row.label}"`);
});

test("a save is checked at the door", () => {
  assert.equal(parseReport(emptyReport()).ok, true);
  assert.equal(parseReport({ ...emptyReport(), year: "2025-26" }).ok, false, "another year");
  assert.equal(parseReport(card({ "4.XX.9": [2, null, null, null] })).ok, false, "unknown code");
  assert.equal(parseReport({ ...emptyReport(), standards: [{ code: "4.NPV.1", scores: [4, null, null, null] }] }).ok, false);
  assert.equal(parseReport({ ...emptyReport(), standards: [{ code: "4.NPV.1", scores: [2, null] }] }).ok, false);
  assert.equal(
    parseReport(card({ "4.NPV.1": [2, null, null, null] }, { standards: [
      { code: "4.NPV.1", scores: [2, null, null, null] },
      { code: "4.NPV.1", scores: [3, null, null, null] },
    ] })).ok,
    false,
    "listed twice"
  );
  assert.equal(parseReport({ ...emptyReport(), grows: ["rounding"], glows: ["rounding"] }).ok, false, "both");
  assert.equal(parseReport({ ...emptyReport(), reading: [{ on: "Oct 1", wpm: 50 }] }).ok, false, "bad date");
  assert.equal(parseReport({ ...emptyReport(), reading: [{ on: "2026-10-01", wpm: 0 }] }).ok, false, "wpm 0");
  assert.equal(parseReport({ ...emptyReport(), grows: ["juggling"] }).ok, false, "unknown topic");
});

test("a stored card is tidied the same way every time", () => {
  const raw = {
    ...card({ "4.NPV.1": [2, null, null, null], "4.NPV.2": [null, null, null, null] }),
    reading: [
      { on: "2026-12-10", wpm: 60 },
      { on: "2026-10-01", wpm: 50 },
    ],
    note: "  hi  ",
  };
  const first = parseReport(raw);
  assert.ok(first.ok);
  if (!first.ok) return;
  assert.deepEqual(first.report.standards.map((s) => s.code), ["4.NPV.1"], "a blank row is dropped");
  assert.deepEqual(first.report.reading.map((r) => r.on), ["2026-10-01", "2026-12-10"]);
  assert.equal(first.report.note, "hi");
  const again = parseReport(JSON.parse(JSON.stringify(first.report)));
  assert.deepEqual(again, first);
});

test("the latest graded quarter wins", () => {
  const latest = latestScores(card({ "4.NPV.1": [2, 3, null, null], "4.CAR.2": [3, null, 2, null], "4.GM.3": [null, null, null, 1] }));
  assert.deepEqual(latest.get("4.NPV.1"), { score: 3, quarter: "Q2" });
  assert.deepEqual(latest.get("4.CAR.2"), { score: 2, quarter: "Q3" });
  assert.deepEqual(latest.get("4.GM.3"), { score: 1, quarter: "Q4" });
  assert.equal(focusFor(card({ "4.NPV.1": [2, 3, null, null] }), DAY), NO_FOCUS, "met in Q2: nothing to catch up");
});

test("no card, another year, or after the school year: no focus", () => {
  const low = card({ "4.FR.1.PD": [2, null, null, null] });
  assert.equal(focusFor(null, DAY), NO_FOCUS);
  assert.equal(focusFor({ ...low, year: "2025-26" } as unknown as SchoolReport, DAY), NO_FOCUS);
  assert.equal(focusFor(low, "2027-06-01"), NO_FOCUS);
  assert.notEqual(focusFor(low, DAY), NO_FOCUS);
  assert.equal(SCHOOL_YEAR_ID, "2026-27");
});

test("each reading and writing standard under 3 asks for its own practice", () => {
  const decode = focusFor(card({ "4.FR.1.PD": [2, null, null, null] }), DAY);
  assert.deepEqual(decode.newWordsExtras, ["word-part-meaning", "word-part-meaning"]);
  assert.deepEqual(decode.productionExtras, []);
  assert.deepEqual(decode.readingOpens, []);

  const encode = focusFor(card({ "4.FR.4.PE": [1, null, null, null] }), DAY);
  assert.deepEqual(encode.productionExtras, ["word-part-build"]);
  assert.deepEqual(encode.newWordsExtras, []);

  const sentences = focusFor(card({ "4.L.14.S": [2, null, null, null] }), DAY);
  assert.deepEqual(sentences.productionExtras, ["sentence-combine"]);

  const details = focusFor(card({ "4.RC.2.RF": [2, null, null, null] }), DAY);
  assert.deepEqual(details.readingOpens, ["evidence"]);
  assert.deepEqual(details.mathCatchUp, []);

  // A standard that only shows on the card (fluency, writing) changes no practice.
  const display = focusFor(card({ "4.FR.6.F": [2, null, null, null], "4.W.4.P": [2, null, null, null] }), DAY);
  assert.equal(display, NO_FOCUS);
});

test("prefixes as a strength point word-part questions at roots and suffixes", () => {
  const f = focusFor(card({ "4.FR.1.PD": [2, null, null, null] }, { glows: ["prefixes"] }), DAY);
  assert.deepEqual([...f.partKinds].sort(), ["base", "suffix"]);
  assert.deepEqual(focusFor(card({ "4.FR.1.PD": [2, null, null, null] }), DAY).partKinds, []);
});

test("math: the teacher's words first, a strength cancels a score, three at most", () => {
  const scored = focusFor(card({ "4.NPV.1": [2, null, null, null], "4.CAR.2": [2, null, null, null] }), DAY);
  assert.deepEqual(scored.mathCatchUp, ["place-value", "number-forms", "add-sub-big"], "school order");

  const words = focusFor(
    card({ "4.NPV.1": [2, null, null, null], "4.CAR.2": [2, null, null, null] }, {
      grows: ["rounding", "number-forms"],
      glows: ["add-sub"],
    }),
    DAY
  );
  assert.deepEqual(words.mathCatchUp, ["rounding", "number-forms", "place-value"]);

  const many = focusFor(card({}, { grows: ["rounding", "division", "fractions", "angles"] }), DAY);
  assert.equal(many.mathCatchUp.length, MAX_CATCH_UP);
  assert.deepEqual(many.mathCatchUp, ["rounding", "division", "fractions"]);
  // Every math topic points at a real skill.
  for (const t of TEACHER_TOPICS) if ("skill" in t) assert.ok(t.skill.length > 0);
});

test("reading speed: the next school goal above the last check", () => {
  assert.equal(fluencyGoalFor([]), null);
  assert.equal(fluencyGoalFor([{ on: "2026-10-01", wpm: 50 }])?.goal, 87);
  assert.equal(fluencyGoalFor([{ on: "2026-10-01", wpm: 90 }])?.goal, 121);
  assert.equal(fluencyGoalFor([{ on: "2026-10-01", wpm: 130 }])?.goal, 121);
  const f = focusFor({ ...emptyReport(), reading: [{ on: "2026-10-01", wpm: 50 }] }, DAY);
  assert.equal(f.fluencyGoal?.last?.wpm, 50);
  assert.deepEqual(f.mathCatchUp, []);
  assert.equal(f.reasons.length, 1);
});

test("catch-up math: every other whole day, and no lesson skill is starved", () => {
  const catchUp = ["rounding", "number-forms"] as const;
  let prev: boolean | null = null;
  const lessonSeen = new Map<string, Set<string>>();
  for (let t = Date.parse("2026-08-12T12:00:00Z"); t <= Date.parse("2027-05-20T12:00:00Z"); t += 86_400_000) {
    const d = new Date(t).toISOString().slice(0, 10);
    const skill = mathSkillFor(d, {}, catchUp);
    const lesson = currentLesson(d);
    const isCatchUp = (catchUp as readonly string[]).includes(skill) && !lesson.skills.includes(skill);
    if (prev !== null && isCatchUp) assert.notEqual(prev, true, `two catch-up days in a row at ${d}`);
    prev = isCatchUp;
    if (!isCatchUp) {
      const key = `${lesson.lesson}`;
      lessonSeen.set(key, (lessonSeen.get(key) ?? new Set()).add(skill));
    }
  }
  // Lessons long enough to show every skill do show every skill.
  const lesson1 = currentLesson("2026-08-20");
  assert.ok(lesson1.skills.every((s) => lessonSeen.get(`${lesson1.lesson}`)?.has(s)), "a lesson skill never came up");
  // Empty catch-up is the old rotation; after the school year catch-up stops.
  assert.equal(mathSkillFor("2026-10-24", {}, []), mathSkillFor("2026-10-24", {}));
  assert.equal(mathSkillFor("2027-06-02", {}, catchUp), mathSkillFor("2027-06-02", {}));
});

test("the quest's Math beat and every caller see the same catch-up", () => {
  const unit = {
    _id: "u1",
    name: "Unit 1",
    updatedAt: "2026-10-24T17:00:00.000Z",
    wordCount: 1,
    pathProgress: {},
    words: [{ word: "brave", skills: { recognize: skill(0), listen: skill(0), spell: skill(0), use: skill(0) } }],
  } as unknown as ListSummary;
  const beats = planBeats({ activity: [], lists: [unit], mathLevels: {}, today: "2026-10-24", mathCatchUp: ["rounding"] });
  const math = beats.find((b) => b.id === "math");
  assert.equal(math?.href, `/math/${mathSkillFor("2026-10-24", {}, ["rounding"])}`);
});

// ── Extras land on top of the lesson, and only the extras are new ──────────

const NOW = new Date("2026-10-24T17:00:00.000Z");
function skill(streak: number): SkillState {
  return { correct: streak, wrong: 0, streak, lastAt: streak ? NOW.toISOString() : null, dueAt: NOW.toISOString() };
}
const WORDS: ClientWord[] = ["brave", "calm", "habitat", "predator", "survive", "shelter"].map((w, i) => ({
  word: w,
  clue: `${w} clue`,
  arabic: "كلمة",
  explanation: `to ${w}`,
  examples: [`He likes to ${w} at school.`, `We ${w} every day.`, `Can you ${w} with me?`],
  family: [`${w}s`],
  srs: { interval: 0, dueAt: NOW.toISOString(), lastReviewed: null, reviewCount: i % 3, easyCount: 0, hardCount: 0 },
  skills: { recognize: skill(i % 3), listen: skill(i % 3), spell: skill(i % 3), use: skill(i % 3) },
}));
const key = (i: LessonItem) => `${i.kind}|${i.word ?? ""}|${"answer" in i ? String(i.answer) : ""}`;
const sorted = (items: LessonItem[]) => items.map(key).sort();

test("report-card extras are added to the lesson; the lesson itself is unchanged", () => {
  for (const seed of [1, 2, 3, 7, 11]) {
    const base = buildLesson({ words: WORDS, step: "match", now: NOW, rng: mulberry32(seed), maxNew: 3, listId: "u1" });
    const more = buildLesson({
      words: WORDS,
      step: "match",
      now: NOW,
      rng: mulberry32(seed),
      maxNew: 3,
      listId: "u1",
      extras: ["word-part-meaning", "word-part-meaning"],
      partKinds: ["base", "suffix"],
    });
    assert.equal(more.length, base.length + 2);
    const added = more.filter((i) => i.kind === "word-part-meaning");
    assert.equal(added.length, 2);
    assert.notEqual(key(added[0]) + ("part" in added[0] ? added[0].part : ""), key(added[1]) + ("part" in added[1] ? added[1].part : ""), "two different word parts");
    for (const item of added) {
      assert.ok("partKind" in item && (item.partKind === "base" || item.partKind === "suffix"), "no prefixes");
    }
    assert.deepEqual(sorted(more.filter((i) => i.kind !== "word-part-meaning")), sorted(base));

    const pBase = buildProductionSession({ words: WORDS, now: NOW, rng: mulberry32(seed), listId: "u1" });
    const pMore = buildProductionSession({
      words: WORDS,
      now: NOW,
      rng: mulberry32(seed),
      listId: "u1",
      extras: ["word-part-build", "sentence-combine"],
    });
    assert.equal(pMore.length, pBase.length + 2);
    assert.equal(pMore.filter((i) => i.kind === "sentence-combine").length, 2);
    assert.equal(pMore.filter((i) => i.kind === "word-part-build").length, 1);
  }
});

test("4.RC.2.RF under 3 adds the evidence question to every plan that lacked it", () => {
  for (const level of [1, 3, 4]) {
    for (const kind of ["story", "info"] as const) {
      const base = questionPlan(level, kind, false, "Q2");
      const open = questionPlan(level, kind, false, "Q2", ["evidence"]);
      assert.deepEqual(open.slice(0, base.length), base);
      assert.deepEqual(open.slice(base.length).map((q) => q.type), ["evidence"]);
    }
  }
  const already = questionPlan(5, "info", false, "Q3");
  assert.deepEqual(questionPlan(5, "info", false, "Q3", ["evidence"]), already);
});
