import assert from "node:assert/strict";
import test from "node:test";

import { missedLetters } from "@/lib/spelling-marks";

/** The answer with its marked letters in brackets, for readable asserts. */
function shown(answer: string, typed: string): string {
  const marks = missedLetters(answer, typed);
  return [...answer].map((ch, i) => (marks[i] ? `[${ch}]` : ch)).join("");
}

test("a right spelling marks nothing", () => {
  assert.equal(shown("because", "because"), "because");
  assert.equal(shown("because", "  Because "), "because");
});

test("a missing letter marks that letter only, not every letter after it", () => {
  assert.equal(shown("because", "becuse"), "bec[a]use");
  assert.equal(shown("fifty", "fify"), "fif[t]y");
});

test("a wrong letter marks that letter", () => {
  assert.equal(shown("fifty", "fefty"), "f[i]fty");
});

test("two letters swapped mark both", () => {
  assert.equal(shown("because", "becuase"), "bec[a][u]se");
});

test("an extra letter marks the answer letter where it went in", () => {
  assert.equal(shown("because", "becausse"), "becau[s]e");
  assert.equal(shown("because", "becauuse"), "beca[u]se");
  assert.equal(shown("cat", "cats"), "ca[t]");
});

test("nothing typed marks every letter", () => {
  assert.equal(shown("cat", ""), "[c][a][t]");
  assert.deepEqual(missedLetters("", "abc"), []);
});
