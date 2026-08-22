import assert from "node:assert/strict";
import { test } from "node:test";

import {
  CLASS_TEXT_LEXILE,
  GRADE4_LEXILE,
  LEXILE_LADDER,
  MAX_WPM,
  SCAFFOLD_FULL_SESSIONS,
  SCAFFOLD_LIGHT_SESSIONS,
  SCAFFOLD_STEADY_PCT,
  atGradeLevel,
  clampLevel,
  countWords,
  levelAtGrade,
  lexileForLevel,
  longestSentenceWords,
  questionPlan,
  readingParams,
  scaffoldFor,
  splitParagraphs,
  wordsPerMinute,
} from "@/lib/reading";

test("level params follow the plan's formulas", () => {
  assert.equal(readingParams(1).targetWords, 110);
  assert.equal(readingParams(10).targetWords, 380);
  assert.equal(readingParams(1).maxSentenceWords, 9);
  assert.equal(readingParams(10).maxSentenceWords, 18);
  assert.equal(readingParams(0).level, 1);
  assert.equal(readingParams(99).level, 10);
  assert.equal(clampLevel(Number.NaN), 1);
});

test("question plan grows with the level and matches the passage kind", () => {
  const l1 = questionPlan(1, "story", false);
  assert.deepEqual(
    l1.map((q) => q.type),
    ["author", "author", "detail"]
  );

  const l3 = questionPlan(3, "story", false);
  assert.ok(l3.some((q) => q.type === "inference"));
  assert.ok(!l3.some((q) => q.type === "retell"));

  const l4story = questionPlan(4, "story", false);
  assert.ok(l4story.some((q) => q.type === "retell"));
  assert.ok(l4story.some((q) => q.type === "theme"));
  assert.ok(!l4story.some((q) => q.type === "evidence"));

  const l5info = questionPlan(5, "info", false);
  assert.ok(l5info.some((q) => q.type === "evidence"));
  assert.ok(!l5info.some((q) => q.type === "theme"));

  // Sequence replaces the plain detail question from level 5 up.
  assert.ok(l5info.some((q) => q.type === "sequence"));
});

test("science passages add exactly two fact checks", () => {
  const plain = questionPlan(6, "info", false);
  const science = questionPlan(6, "info", true);
  assert.equal(science.length - plain.length, 2);
  assert.equal(science.filter((q) => q.type === "science_fact").length, 2);
});

test("every mcq slot names its option count", () => {
  for (const spec of questionPlan(10, "info", true)) {
    if (spec.format === "mcq") assert.ok((spec.options ?? 0) >= 3);
    else assert.equal(spec.options, undefined);
  }
});

test("text helpers count what the level checks care about", () => {
  const passage = "Sam ran fast. He found a small red kite behind the old shed.";
  assert.equal(countWords(passage), 13);
  assert.equal(longestSentenceWords(passage), 10);
  assert.deepEqual(splitParagraphs("one\n\ntwo"), ["one", "two"]);
  assert.deepEqual(splitParagraphs("  "), [""]);
});

test("wpm needs a usable timing", () => {
  assert.equal(wordsPerMinute(120, 60_000), 120);
  assert.equal(wordsPerMinute(120, 500), 0);
  assert.equal(wordsPerMinute(0, 60_000), 0);
});

test("wpm is clamped to what the server accepts", () => {
  // 110 words skimmed in 3s is 2200 raw — the route's zod max is 1000.
  assert.equal(wordsPerMinute(110, 3000), MAX_WPM);
  assert.equal(wordsPerMinute(500, 2000), MAX_WPM);
});

test("the lexile ladder is anchored to the Grade 4 band", () => {
  assert.equal(lexileForLevel(1), LEXILE_LADDER.start);
  assert.equal(lexileForLevel(10), LEXILE_LADDER.end);
  assert.equal(lexileForLevel(0), LEXILE_LADDER.start);
  assert.equal(lexileForLevel(99), LEXILE_LADDER.end);
  // Climbs, never dips.
  for (let l = 2; l <= 10; l++) {
    assert.ok(lexileForLevel(l) > lexileForLevel(l - 1), `level ${l} climbs`);
  }
  // The top of the ladder sits inside the range his class actually reads.
  assert.ok(LEXILE_LADDER.end >= GRADE4_LEXILE.min);
  assert.ok(LEXILE_LADDER.end >= CLASS_TEXT_LEXILE.min);
  assert.ok(LEXILE_LADDER.end <= CLASS_TEXT_LEXILE.max);
  // readingParams carries the same number.
  assert.equal(readingParams(6).lexile, lexileForLevel(6));
});

test("grade-level check and the rung it starts at agree", () => {
  const rung = levelAtGrade();
  assert.ok(!atGradeLevel(rung - 1), "the rung below is not yet grade level");
  assert.ok(atGradeLevel(rung), "the rung is grade level");
  assert.ok(lexileForLevel(rung) >= GRADE4_LEXILE.min);
});

test("the school quarter opens standards the reading level has not reached", () => {
  // Level 1 in Q1: only the three questions that run all year.
  const q1 = questionPlan(1, "story", false, "Q1");
  assert.deepEqual(
    q1.map((q) => q.type),
    ["author", "author", "detail"]
  );

  // Same level in Q2: theme is assessed at school now (4.RC.9.RL), so it appears.
  const q2 = questionPlan(1, "story", false, "Q2");
  assert.ok(q2.some((q) => q.type === "theme"));
  assert.ok(!q2.some((q) => q.type === "retell"), "retell waits for Q3");

  // Q3 opens summarise (4.RC.3.RF) and, on non-fiction, author's evidence.
  const q3 = questionPlan(1, "story", false, "Q3");
  assert.ok(q3.some((q) => q.type === "retell"));
  const info = questionPlan(1, "info", false, "Q3");
  assert.ok(info.some((q) => q.type === "evidence"));

  // Summer gates nothing open on its own; the level still decides.
  const summer = questionPlan(1, "story", false, "summer");
  assert.ok(!summer.some((q) => q.type === "theme"));
  assert.ok(questionPlan(9, "story", false, "summer").some((q) => q.type === "theme"));

  // Omitting the quarter keeps the old level-only behaviour.
  assert.deepEqual(questionPlan(1, "story", false), q1);
});

test("the answer scaffold fades with his record, not the calendar", () => {
  const runs = (n: number, pct: number) => Array.from({ length: n }, () => ({ pct }));

  // A beginner gets the sentence marked before he answers.
  assert.equal(scaffoldFor([]), "full");
  assert.equal(scaffoldFor(runs(5, 100)), "full");

  // Past the first few readings, holding accuracy earns a step down.
  assert.equal(scaffoldFor(runs(SCAFFOLD_FULL_SESSIONS, 90)), "light");
  assert.equal(scaffoldFor(runs(SCAFFOLD_LIGHT_SESSIONS, 90)), "none");

  // Struggling keeps the help however many readings he has done.
  assert.equal(scaffoldFor(runs(SCAFFOLD_FULL_SESSIONS, 40)), "full");
  assert.equal(scaffoldFor(runs(SCAFFOLD_LIGHT_SESSIONS, 40)), "light");
  assert.equal(scaffoldFor(runs(40, 40)), "light");

  // Only the recent window counts: an old bad patch does not hold him back.
  const recovered = [...runs(5, 95), ...runs(20, 20)];
  assert.equal(scaffoldFor(recovered), "none");

  // Right on the threshold counts as steady.
  assert.equal(scaffoldFor(runs(SCAFFOLD_LIGHT_SESSIONS, SCAFFOLD_STEADY_PCT)), "none");
});
