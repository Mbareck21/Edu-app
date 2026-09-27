import assert from "node:assert/strict";
import test from "node:test";

import { newWordsList, productionList } from "@/app/learn/today/new-words-list";
import type { ClientWord } from "@/lib/models/WordList";

const blank = { correct: 0, wrong: 0, streak: 0, lastAt: null, dueAt: "" };

/** Just what isNewWord reads: reviews and the four skills' answers. */
function word(met: boolean): ClientWord {
  const s = met ? { ...blank, correct: 1, streak: 1 } : blank;
  return {
    srs: { reviewCount: met ? 1 : 0 },
    skills: { recognize: s, listen: s, spell: s, use: s },
  } as unknown as ClientWord;
}

test("three new words come from the first list that still has a new word", () => {
  const done = { name: "unit 1", words: [word(true), word(true)] };
  const next = { name: "unit 2", words: [word(true), word(false)] };
  assert.equal(newWordsList([done, next])?.name, "unit 2");
  assert.equal(newWordsList([next, done])?.name, "unit 2");
});

test("with no new word anywhere it falls back to the first list", () => {
  const a = { name: "a", words: [word(true)] };
  const b = { name: "b", words: [word(true)] };
  assert.equal(newWordsList([a, b])?.name, "a");
  assert.equal(newWordsList([]), undefined);
});

test("Write and use works on the unit, never the Stuck-words pool that leads the practice lists", () => {
  // getPractice() puts the pool first. Production took the head of that, so
  // from the first stuck word on it only ever practised the pool's copies.
  const pool = { name: "Stuck words", kind: "pool", words: [word(true), word(false)] };
  const done = { name: "unit 1", kind: "unit", words: [word(true)] };
  const next = { name: "unit 2", kind: "unit", words: [word(true), word(false)] };
  assert.equal(productionList([pool, done, next])?.name, "unit 2");
  assert.equal(productionList([pool, done])?.name, "unit 1");
  assert.equal(productionList([pool]), undefined);
});
