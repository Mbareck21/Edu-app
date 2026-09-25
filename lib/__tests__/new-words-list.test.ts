import assert from "node:assert/strict";
import test from "node:test";

import { newWordsList } from "@/app/learn/today/new-words-list";
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
