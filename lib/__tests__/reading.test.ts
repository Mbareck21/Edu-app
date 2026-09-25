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
import { pickArchived, readingWordsToAdd, REUSE_AFTER_MS, withNames } from "@/lib/reading";
import { planQuarter, wpmNormForDate, WPM_NORMS_GRADE4, WPM_NORMS_GRADE5 } from "@/lib/reading";
import { maxReadingLevel } from "@/lib/reading";
import { readingSystemPrompt } from "@/lib/groq";

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
  assert.equal(readingParams(99).level, 12);
  assert.equal(clampLevel(Number.NaN), 1);
});

test("question plan grows with the level and matches the passage kind", () => {
  // School-test style: fact, word meaning, character, one short written answer.
  const l1 = questionPlan(1, "story", false);
  assert.deepEqual(
    l1.map((q) => q.type),
    ["detail", "vocab", "inference", "cause_effect"]
  );
  assert.deepEqual(
    l1.map((q) => q.format),
    ["mcq", "mcq", "mcq", "text"]
  );
  assert.deepEqual(
    questionPlan(1, "info", false).map((q) => q.type),
    ["detail", "vocab", "main_idea", "cause_effect"]
  );

  const l3 = questionPlan(3, "story", false);
  assert.ok(!l3.some((q) => q.type === "retell"));

  const l4story = questionPlan(4, "story", false);
  assert.ok(l4story.some((q) => q.type === "retell"));
  assert.ok(l4story.some((q) => q.type === "theme"));
  assert.ok(!l4story.some((q) => q.type === "evidence"));

  const l5info = questionPlan(5, "info", false);
  assert.ok(l5info.some((q) => q.type === "evidence"));
  assert.ok(questionPlan(5, "story", false).some((q) => q.type === "evidence"));
  assert.ok(!l5info.some((q) => q.type === "theme"));

  // Sequence replaces the plain detail question from level 5 up.
  assert.ok(l5info.some((q) => q.type === "sequence"));
});

test("science passages add exactly one fact check", () => {
  const plain = questionPlan(6, "info", false);
  const science = questionPlan(6, "info", true);
  assert.equal(science.length - plain.length, 1);
  assert.equal(science.filter((q) => q.type === "science_fact").length, 1);
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
  assert.equal(lexileForLevel(99), lexileForLevel(12));
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
    ["detail", "vocab", "inference", "cause_effect"]
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

test("pickArchived serves the oldest passage not seen for a week, or nothing", () => {
  const now = Date.parse("2026-09-06T18:00:00Z");
  const day = 24 * 60 * 60 * 1000;
  const at = (daysAgo: number) => new Date(now - daysAgo * day).toISOString();
  const archive = [
    { title: "yesterday", generatedAt: at(1) },
    { title: "ten days", generatedAt: at(10) },
    { title: "thirty days", generatedAt: at(30) },
  ];
  assert.equal(pickArchived(archive, now)?.title, "thirty days");
  assert.equal(pickArchived([archive[0]], now), null);
  assert.equal(pickArchived([], now), null);
  assert.equal(REUSE_AFTER_MS, 7 * day);
});

test("readingWordsToAdd keeps new glossed words once, with the word blanked from its clue", () => {
  const out = readingWordsToAdd(
    [
      { word: "Variable", meaning: "A variable is the one thing you change.", arabic: "متغير" },
      { word: "variable", meaning: "again", arabic: "" },
      { word: "data", meaning: "Facts you collect.", arabic: "بيانات" },
      { word: "fair test", meaning: "A test where only one thing changes.", arabic: "اختبار عادل" },
      { word: "o'clock", meaning: "bad shape", arabic: "" },
    ],
    new Set(["data"])
  );
  assert.deepEqual(out, [
    { word: "variable", clue: "A ___ is the one thing you change.", arabic: "متغير" },
    { word: "fair test", clue: "A test where only one thing changes.", arabic: "اختبار عادل" },
  ]);
});

test("readingWordsToAdd prefers the meaning and Arabic already on his lists", () => {
  const out = readingWordsToAdd(
    [{ word: "conclusion", meaning: "final idea", arabic: "استنتاج" }],
    new Set(),
    new Map([["conclusion", { clue: "What you decide the data shows.", arabic: "خلاصة" }]])
  );
  assert.deepEqual(out, [{ word: "conclusion", clue: "What you decide the data shows.", arabic: "خلاصة" }]);
});

test("answers shown to him keep the passage's names capitalised", () => {
  const passage =
    '"Look at the sunrise," Amina said. Coach Reed entered, humming. Coach Reed suggested they regroup. She picked a rose for Rose.';
  assert.equal(withNames("coach reed", passage), "Coach Reed");
  assert.equal(withNames("amina notices the light", passage), "Amina notices the light");
  assert.equal(withNames("look at it", passage), "look at it", "a sentence opener is not a name");
  assert.equal(withNames("a rose", passage), "a rose", "a word also used in lower case stays as typed");
});

test("standards opened in Grade 4 stay open after the school year ends", () => {
  const types = (day: string, kind: "story" | "info") =>
    questionPlan(3, kind, false, planQuarter(day)).map((q) => q.type);
  for (const kind of ["story", "info"] as const) {
    assert.deepEqual(types("2027-06-15", kind), types("2027-05-19", kind));
  }
  assert.ok(types("2027-06-15", "story").includes("theme"));
  assert.ok(types("2027-06-15", "info").includes("evidence"));
  // Before and during the year it is still the calendar quarter.
  assert.equal(planQuarter("2026-07-01"), "summer");
  assert.equal(planQuarter("2026-09-01"), "Q1");
});

test("winter break keeps the last quarter reached", () => {
  assert.equal(planQuarter("2026-12-25"), "Q2");
  assert.equal(planQuarter("2026-10-10"), "Q1");
  const types = (day: string) => questionPlan(1, "story", false, planQuarter(day)).map((q) => q.type);
  assert.ok(types("2026-12-25").includes("theme"));
  assert.deepEqual(types("2026-12-25"), types("2026-12-18"));
});

test("the words-a-minute goal follows the grade", () => {
  assert.equal(wpmNormForDate(new Date("2026-09-15T12:00:00Z")), WPM_NORMS_GRADE4.fall);
  assert.equal(wpmNormForDate(new Date("2027-04-15T12:00:00Z")), WPM_NORMS_GRADE4.spring);
  assert.equal(wpmNormForDate(new Date("2027-05-19T17:00:00Z")), WPM_NORMS_GRADE4.spring);
  // The summer he moves up aims at Grade 5 fall, not Grade 5 spring.
  assert.equal(wpmNormForDate(new Date("2027-05-25T17:00:00Z")), WPM_NORMS_GRADE5.fall);
  assert.equal(wpmNormForDate(new Date("2027-07-15T17:00:00Z")), WPM_NORMS_GRADE5.fall);
  assert.equal(wpmNormForDate(new Date("2027-09-15T12:00:00Z")), WPM_NORMS_GRADE5.fall);
  assert.equal(wpmNormForDate(new Date("2027-12-15T17:00:00Z")), WPM_NORMS_GRADE5.winter);
  assert.equal(wpmNormForDate(new Date("2028-04-15T17:00:00Z")), WPM_NORMS_GRADE5.spring);
  assert.equal(wpmNormForDate(new Date("2028-01-15T12:00:00Z")), WPM_NORMS_GRADE5.winter);
  assert.deepEqual(WPM_NORMS_GRADE5, { fall: 110, winter: 127, spring: 139 });
});

test("the reading prompt names the child's grade", () => {
  assert.match(readingSystemPrompt(4), /in Grade 4,/);
  assert.match(readingSystemPrompt(5), /in Grade 5,/);
  assert.doesNotMatch(readingSystemPrompt(5), /Grade 4/);
});

test("levels 11 and 12 continue the Lexile step and open only in Grade 5", () => {
  assert.equal(lexileForLevel(1), 450);
  assert.equal(lexileForLevel(10), 940);
  assert.equal(lexileForLevel(11), 990);
  assert.equal(lexileForLevel(12), 1050);
  assert.equal(maxReadingLevel(4), 10);
  assert.equal(maxReadingLevel(5), 12);
});
