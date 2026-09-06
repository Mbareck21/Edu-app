import assert from "node:assert/strict";
import { test } from "node:test";

import { tooClose, wordDistractors } from "@/lib/items";
import { mulberry32 } from "@/lib/math/rng";
import { packById } from "@/lib/word-packs";
import type { ClientWord } from "@/lib/models/WordList";

/**
 * The bug: "Which word means this?" showed the clue for one word with a
 * second word that also fit among the options, and marked that pick wrong.
 * Distractors come from the same list, and lists are built from one topic,
 * so near-synonyms are the rule, not the exception.
 */

function packWords(id: string): ClientWord[] {
  const pack = packById(id);
  assert.ok(pack, `no pack ${id}`);
  return pack.words.map((w) => ({
    word: w.word,
    clue: w.clue,
    arabic: "",
    explanation: "",
    examples: [],
    family: [],
    srs: { interval: 0, dueAt: "", lastReviewed: null, reviewCount: 0, easyCount: 0, hardCount: 0 },
    skills: {
      recognize: { correct: 0, wrong: 0, streak: 0, lastAt: null, dueAt: "" },
      listen: { correct: 0, wrong: 0, streak: 0, lastAt: null, dueAt: "" },
      spell: { correct: 0, wrong: 0, streak: 0, lastAt: null, dueAt: "" },
      use: { correct: 0, wrong: 0, streak: 0, lastAt: null, dueAt: "" },
    },
  }));
}

const by = (words: ClientWord[], w: string) => {
  const found = words.find((x) => x.word === w);
  assert.ok(found, `missing ${w}`);
  return found;
};

test("value never offers place value as a wrong answer", () => {
  const words = packWords("math-vocabulary");
  assert.ok(tooClose(by(words, "value"), by(words, "place value")));
  for (let seed = 1; seed <= 40; seed++) {
    const wrong = wordDistractors("value", words, mulberry32(seed));
    assert.ok(!wrong.includes("place value"), `seed ${seed} offered place value`);
    assert.equal(wrong.length, 3, "and it still fills the card");
  }
});

test("compost and fertilizer are not each other's distractors", () => {
  const words = packWords("growing-plants");
  assert.ok(tooClose(by(words, "compost"), by(words, "fertilizer")));
  for (let seed = 1; seed <= 40; seed++) {
    assert.ok(!wordDistractors("compost", words, mulberry32(seed)).includes("fertilizer"));
    assert.ok(!wordDistractors("fertilizer", words, mulberry32(seed)).includes("compost"));
  }
});

test("genuinely different words still serve as distractors", () => {
  const words = packWords("math-vocabulary");
  // Word form vs expanded form share the word "form" but describe different
  // things; each is a fair wrong answer for the other's clue.
  assert.equal(tooClose(by(words, "word form"), by(words, "expanded form")), false);
  assert.equal(tooClose(by(words, "digit"), by(words, "round")), false);
});

test("every pack can still build a full card for every word", () => {
  for (const id of ["math-vocabulary", "growing-plants", "number-words"]) {
    const words = packWords(id);
    for (const w of words) {
      const wrong = wordDistractors(w.word, words, mulberry32(7));
      assert.equal(wrong.length, 3, `${id}: ${w.word} could not fill its card`);
      assert.ok(!wrong.includes(w.word));
      for (const d of wrong) {
        const cand = words.find((x) => x.word === d);
        if (cand) assert.ok(!tooClose(w, cand), `${id}: ${w.word} offered ${d}`);
      }
    }
  }
});
