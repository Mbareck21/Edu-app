import assert from "node:assert/strict";
import { test } from "node:test";

import { WORD_PACKS, packById } from "@/lib/word-packs";

// The same regex the app validates words against before seeding.
const VALID_WORD = /^[a-zA-Z][a-zA-Z\s-]*$/;

test("every word passes the app's validation regex", () => {
  for (const pack of WORD_PACKS) {
    for (const { word } of pack.words) {
      assert.match(word, VALID_WORD, `${pack.id}: "${word}"`);
    }
  }
});

test("no clue contains its own word", () => {
  // A clue that names its word hands him the answer in pick-the-meaning.
  for (const pack of WORD_PACKS) {
    for (const { word, clue } of pack.words) {
      assert.ok(
        !clue.toLowerCase().includes(word.toLowerCase()),
        `${pack.id}: clue for "${word}" gives it away`
      );
    }
  }
});

test("every word has a non-empty clue", () => {
  for (const pack of WORD_PACKS) {
    for (const { word, clue } of pack.words) {
      assert.ok(clue.trim().length > 0, `${pack.id}: "${word}" has no clue`);
    }
  }
});

test("pack ids are unique and packById finds each one", () => {
  const ids = WORD_PACKS.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const pack of WORD_PACKS) {
    assert.equal(packById(pack.id), pack);
  }
  assert.equal(packById("no-such-pack"), undefined);
});

test("no word repeats inside a pack", () => {
  for (const pack of WORD_PACKS) {
    const words = pack.words.map((w) => w.word.toLowerCase());
    assert.equal(new Set(words).size, words.length, pack.id);
  }
});

test("the lesson pack exists and has at least twenty words", () => {
  const pack = packById("math-lesson-words");
  assert.ok(pack, "math-lesson-words pack exists");
  assert.ok(pack.words.length >= 20, `only ${pack.words.length} words`);
});

test("the lesson pack does not repeat math-vocabulary words", () => {
  // Each term gets exactly one home, so a word seeded from one pack never
  // collides with the same word from the other.
  const mathPack = packById("math-vocabulary");
  assert.ok(mathPack, "math-vocabulary pack exists");
  const mathWords = new Set(mathPack.words.map((w) => w.word.toLowerCase()));
  const lessonPack = packById("math-lesson-words");
  assert.ok(lessonPack, "math-lesson-words pack exists");
  for (const { word } of lessonPack.words) {
    assert.ok(
      !mathWords.has(word.toLowerCase()),
      `"${word}" is already in math-vocabulary`
    );
  }
});

test("the math packs cover the terms behind his current skills", () => {
  // "place value" already lives in math-vocabulary, and the one-home rule
  // keeps it there — so check the two math packs together.
  const mathPack = packById("math-vocabulary");
  const lessonPack = packById("math-lesson-words");
  assert.ok(mathPack, "math-vocabulary pack exists");
  assert.ok(lessonPack, "math-lesson-words pack exists");
  const words = new Set(
    [...mathPack.words, ...lessonPack.words].map((w) => w.word.toLowerCase())
  );
  const mustHave = [
    "place value",
    "rounding",
    "factor",
    "multiple",
    "perimeter",
    "area",
  ];
  for (const word of mustHave) {
    assert.ok(words.has(word), `missing "${word}"`);
  }
});

test("the number pack covers the words from the graded worksheet", () => {
  const pack = packById("number-words");
  assert.ok(pack, "number-words pack exists");
  const words = new Set(pack.words.map((w) => w.word));
  // The exact misses: fefty, therte, sexte, ghate, ninel, twene, elleven,
  // ay tene — plus forty, the no-u trap.
  const mustHave = [
    "fifty",
    "thirty",
    "sixty",
    "eighty",
    "ninety",
    "twenty",
    "eleven",
    "eighteen",
    "forty",
  ];
  for (const word of mustHave) {
    assert.ok(words.has(word), `missing "${word}"`);
  }
});
