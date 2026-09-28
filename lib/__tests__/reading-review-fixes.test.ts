import assert from "node:assert/strict";
import { test } from "node:test";

import { compareEcho } from "@/lib/echo";
import { READING_QUESTION_TYPES } from "@/lib/models/WordList";
import {
  MAX_GLOSSARY_ENTRIES,
  checkMcq,
  longestSentenceWords,
  partPlan,
  splitParts,
  splitSentences,
  tidyReading,
} from "@/lib/reading";

test("a sentence that ends inside a closing quote still ends", () => {
  // Merged, these read as one 15-word sentence: it tripped the level's
  // sentence-length check and joined two echo lines into one.
  const straight = '"The plant is too dry." Rosa filled the can with cold water from the tap.';
  assert.deepEqual(splitSentences(straight), [
    '"The plant is too dry."',
    "Rosa filled the can with cold water from the tap.",
  ]);
  const curly = "“Where is my red pencil?” Omar looked under the desk.";
  assert.deepEqual(splitSentences(curly), ["“Where is my red pencil?”", "Omar looked under the desk."]);
  assert.equal(longestSentenceWords(straight), 10);
  // A said-tag in lower case carries on the same sentence.
  assert.deepEqual(splitSentences('"Stop!" she said. Leo stopped.'), ['"Stop!" she said.', "Leo stopped."]);
  // A comma inside the quote was never a sentence end.
  assert.deepEqual(splitSentences('"Look at the sky," Ella said.'), ['"Look at the sky," Ella said.']);
});

test("multiple choice options differing only in punctuation are one option", () => {
  const dup = checkMcq(["angry", "patient", "Patient.", "bored"], 1, ["patient"]);
  assert.deepEqual(dup.options, ["angry", "patient", "bored"]);
  assert.equal(dup.answerIndex, 1);
});

test("an answer key that points away from the model's own answer is not trusted", () => {
  const opts = ["angry", "patient", "worried", "bored"];
  // answerIndex says "worried"; acceptable says "patient" with a full stop.
  assert.equal(checkMcq(opts, 2, ["patient."]).answerIndex, -1);
  assert.equal(checkMcq(opts, 2, ["Patient!"]).answerIndex, -1);
  // Evidence sentences: acceptable is option 0 without its full stop.
  const sentences = [
    "Layla waited by the ladder and tried again.",
    "The goat ate the leaves on the roof.",
    "Mr. Diaz brought a rope.",
  ];
  assert.equal(checkMcq(sentences, 1, ["Layla waited by the ladder and tried again"]).answerIndex, -1);
  // The same key with the punctuation matching is kept.
  assert.equal(checkMcq(sentences, 0, ["Layla waited by the ladder and tried again"]).answerIndex, 0);
});

test("partPlan finds the exact source sentence before a prefix match", () => {
  const passage =
    "Leo looked at the garden and saw one red tomato. He smiled.\n\n" +
    "Later, Leo looked at the garden and saw one red tomato was gone. He was sad.";
  const parts = splitParts(passage);
  const plan = partPlan(parts, [
    { source: "Leo looked at the garden and saw one red tomato was gone." },
    { source: "" },
  ]);
  assert.equal(plan.partOf[0], 1);
  // A source with no exact home still falls back to its first 40 characters.
  const loose = partPlan(parts, [
    { source: "Leo looked at the garden and saw one red tomato, and he smiled." },
    { source: "" },
  ]);
  assert.equal(loose.partOf[0], 0);
});

test("a title read aloud as a word matches its abbreviation", () => {
  assert.ok(compareEcho("Ms. Okafor smiled.", "Miss Okafor smiled.").great);
  assert.ok(compareEcho("Mr. Diaz waved.", "Mister Diaz waved.").great);
  assert.ok(compareEcho("Mrs. Lee sat down.", "Missus Lee sat down.").great);
  assert.ok(compareEcho("Ms Okafor smiled.", "Ms. Okafor smiled.").great);
});

// ── Lenient reading JSON ──────────────────────────────────────────────────

const plan = [{ type: "inference" }, { type: "vocab" }, { type: "detail" }, { type: "cause_effect" }];
const q = (over: Record<string, unknown> = {}) => ({
  q: "How does Layla feel when the goat will not come down?",
  type: "inference",
  format: "mcq",
  acceptable: ["patient"],
  options: ["angry", "patient", "worried", "bored"],
  answerIndex: 1,
  hints: ["She waits", "Waiting calmly means patient"],
  source: "Layla waited by the ladder and tried again.",
  ...over,
});
const reading = (over: Record<string, unknown> = {}, q3: Record<string, unknown> = {}, q0: Record<string, unknown> = {}) => ({
  title: "The Goat On The Roof",
  kind: "story",
  paragraphs: ["Layla waited by the ladder and tried again.", "At last the goat came down."],
  usedWords: ["fence"],
  glossary: [{ word: "stubborn", meaning: "not willing to move", arabic: "عنيد" }],
  questions: [
    q(q0),
    q({ type: "vocab" }),
    q({ type: "detail" }),
    q({ type: "cause_effect", format: "text", options: [], answerIndex: -1, acceptable: ["to reach the sun"], ...q3 }),
  ],
  ...over,
});
type Tidy = {
  title: string;
  glossary: { meaning: string }[];
  questions: { type: string; answerIndex: unknown; options: unknown; source: unknown; hints: string[]; acceptable: unknown }[];
};
const tidy = (raw: unknown) => tidyReading(raw, plan, READING_QUESTION_TYPES) as Tidy;

test("a slightly-off question type is fixed, not the whole passage thrown away", () => {
  assert.equal(tidy(reading({}, { type: "cause-effect" })).questions[3].type, "cause_effect");
  assert.equal(tidy(reading({}, { type: "Main Idea" })).questions[3].type, "main_idea");
  // Nothing recognisable: the plan's own type for that slot.
  assert.equal(tidy(reading({}, { type: "reasoning" })).questions[3].type, "cause_effect");
});

test("null and numeric-string fields take their defaults", () => {
  assert.equal(tidy(reading({}, {}, { answerIndex: "1" })).questions[0].answerIndex, 1);
  const t = tidy(reading({}, { answerIndex: null, options: null, source: null }));
  assert.equal(t.questions[3].answerIndex, -1);
  assert.deepEqual(t.questions[3].options, []);
  assert.equal(t.questions[3].source, "");
});

test("an over-long glossary or title is trimmed, and empty hints are dropped", () => {
  const many = Array.from({ length: 9 }, (_, i) => ({ word: `w${i}`, meaning: "m", arabic: "ع" }));
  assert.equal(tidy(reading({ glossary: many })).glossary.length, MAX_GLOSSARY_ENTRIES);
  const long = tidy(reading({ glossary: [{ word: "stubborn", meaning: "word ".repeat(40), arabic: "ع" }] }));
  assert.ok(long.glossary[0].meaning.length <= 160);
  assert.ok(!long.glossary[0].meaning.endsWith(" "));
  assert.ok(tidy(reading({ title: "T".repeat(72) })).title.length <= 70);
  assert.deepEqual(tidy(reading({}, {}, { hints: ["", "x"] })).questions[0].hints, ["x"]);
});

test("what would make a broken question is left for the check to reject", () => {
  // No answers at all cannot be guessed at.
  assert.deepEqual(tidy(reading({}, {}, { acceptable: [] })).questions[0].acceptable, []);
  assert.equal(tidyReading("not json", plan, READING_QUESTION_TYPES), "not json");
});
