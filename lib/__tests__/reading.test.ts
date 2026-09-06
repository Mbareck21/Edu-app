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
  MAX_PASSAGE_PARAGRAPHS,
  foldParagraphs,
  levelAtGrade,
  lexileForLevel,
  longestSentenceWords,
  questionPlan,
  readingParams,
  scaffoldFor,
  splitParagraphs,
  wordsPerMinute,
  MAX_READ_MS,
  castFor,
  checkMcq,
  OPENING_MOVES,
  STORY_NAMES,
  STORY_SETTINGS,
} from "@/lib/reading";

/** Tiny deterministic rng so the cast tests are not flaky. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

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

// ── Story cast ────────────────────────────────────────────────────────────
//
// The bug: every list's first passage came back as the same "Sam walked to..."
// story, ten times out of ten on a cold probe. The cast is sampled in code now
// precisely so variety cannot depend on the model's mood.

test("a cast never casts the same child twice", () => {
  for (let seed = 1; seed <= 200; seed++) {
    const cast = castFor(seeded(seed));
    assert.notEqual(cast.child, cast.other);
  }
});

test("every cast field comes from its roster", () => {
  for (let seed = 1; seed <= 50; seed++) {
    const cast = castFor(seeded(seed));
    assert.ok(STORY_NAMES.includes(cast.child as (typeof STORY_NAMES)[number]));
    assert.ok(STORY_NAMES.includes(cast.other as (typeof STORY_NAMES)[number]));
    assert.ok(STORY_SETTINGS.includes(cast.setting as (typeof STORY_SETTINGS)[number]));
    assert.ok(OPENING_MOVES.includes(cast.opening as (typeof OPENING_MOVES)[number]));
  }
});

test("the roster is wide enough that repeats are rare", () => {
  // 8 passages is READING_SEEN_MAX. Over many runs of 8, the same child should
  // almost never fill the set — that is the whole point of the fix.
  const names = new Set<string>();
  for (let seed = 1; seed <= 100; seed++) names.add(castFor(seeded(seed)).child);
  assert.ok(names.size >= 12, `only ${names.size} distinct names in 100 draws`);
});

test("Sam is not in the roster", () => {
  // Not superstition: the old system prompt named Sam as an example and the
  // model used it in 10 of 10 cold generations.
  assert.ok(!STORY_NAMES.includes("Sam" as (typeof STORY_NAMES)[number]));
});

test("an abandoned timer scores nothing, but a slow read still counts", () => {
  // 110 words with the clock left running for 20 minutes is a tab left open,
  // not a reading, and it used to be saved as 6 wpm.
  assert.equal(wordsPerMinute(110, 20 * 60_000), 0);
  assert.equal(wordsPerMinute(110, MAX_READ_MS + 1), 0);

  // But a genuinely slow read-aloud is a real measurement and must survive.
  // He is an Arabic-L1 reader who sounds words out; a rate floor threw these
  // away and so could never show him improving from a low base.
  assert.equal(wordsPerMinute(110, 6 * 60_000), 18);
  assert.equal(wordsPerMinute(60, 10 * 60_000), 6);
  assert.equal(wordsPerMinute(45, 60_000), 45);
});

test("too many paragraphs are folded, not rejected", () => {
  // A real generation came back with more paragraphs than the schema allowed
  // and the whole passage was discarded. The words were fine; only the shape
  // was wrong (server log, 2026-08-31).
  const seven = ["a", "b", "c", "d", "e", "f", "g"];
  assert.deepEqual(foldParagraphs(seven, 3), ["a", "b", "c d e f g"]);
  // Under the cap nothing moves.
  assert.deepEqual(foldParagraphs(["a", "b"], 4), ["a", "b"]);
  // Blank paragraphs are dropped, and whitespace is trimmed.
  assert.deepEqual(foldParagraphs([" a ", "", "b"], 4), ["a", "b"]);
  // No paragraph is ever lost.
  const folded = foldParagraphs(seven, 2);
  assert.equal(folded.length, 2);
  for (const part of seven) assert.ok(folded.join(" ").includes(part));
});

test("a cast steps around the leads he has just read", () => {
  // The product loop: each passage's lead goes into the memory, and the next
  // cast is drawn from what is left. Eight is READING_SEEN_MAX.
  const seenLeads: string[] = [];
  for (let i = 0; i < 8; i++) {
    const cast = castFor(seeded(i + 1), seenLeads);
    assert.ok(!seenLeads.includes(cast.child), `${cast.child} repeated at ${i}`);
    seenLeads.push(cast.child);
  }
  assert.equal(new Set(seenLeads).size, 8);
});

test("an exhausted roster still returns a cast", () => {
  // Avoiding every name must not deadlock or return nothing.
  const cast = castFor(seeded(7), [...STORY_NAMES]);
  assert.ok(cast.child);
  assert.notEqual(cast.child, cast.other);
});

test("the fold ceiling leaves normal passages alone", () => {
  // The point is to rescue a runaway generation, not to reshape a passage the
  // writer split sensibly. More paragraph breaks help him read, not less.
  const six = ["a", "b", "c", "d", "e", "f"];
  assert.deepEqual(foldParagraphs(six, MAX_PASSAGE_PARAGRAPHS), six);
  assert.equal(foldParagraphs([...six, "g"], MAX_PASSAGE_PARAGRAPHS).length, 6);
});

test("a multiple choice with two right options falls back to open text", () => {
  // A distractor that is also in the acceptable list would mark a right pick
  // wrong. The question becomes open text, scored against the whole list.
  const two = checkMcq(["the roots", "the leaves", "roots", "the stem"], 0, ["the roots", "roots"]);
  assert.equal(two.answerIndex, -1);
  // The same option twice is one option; the answer index follows it.
  const dup = checkMcq(["Roots", "roots", "leaves", "stem"], 1, ["roots"]);
  assert.deepEqual(dup.options, ["Roots", "leaves", "stem"]);
  assert.equal(dup.answerIndex, 0);
  // A clean question passes through untouched.
  const clean = checkMcq(["roots", "leaves", "stem", "flower"], 2, ["stem"]);
  assert.equal(clean.answerIndex, 2);
  assert.equal(clean.options.length, 4);
  // Losing the answer to de-duplication, or ending with one option, is not an MCQ.
  assert.equal(checkMcq(["a", "a"], 1, ["a"]).answerIndex, -1);
});
