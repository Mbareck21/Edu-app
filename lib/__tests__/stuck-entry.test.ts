import assert from "node:assert/strict";
import { test } from "node:test";

import { parseWordEntry } from "@/lib/stuck-entry";

/**
 * The parent adds words mid-homework, one hand on the worksheet. The box has
 * to take whatever shape they arrive in, and must never silently drop one.
 */

test("one word is one word", () => {
  assert.deepEqual(parseWordEntry("fifty").words, ["fifty"]);
});

test("several separated any way he types them", () => {
  assert.deepEqual(parseWordEntry("fifty, thirty, eighty").words, ["fifty", "thirty", "eighty"]);
  assert.deepEqual(parseWordEntry("fifty\nthirty\neighty").words, ["fifty", "thirty", "eighty"]);
  assert.deepEqual(parseWordEntry("fifty; thirty").words, ["fifty", "thirty"]);
  assert.deepEqual(parseWordEntry("fifty thirty eighty").words, ["fifty", "thirty", "eighty"]);
});

test("a two-word term stays one term", () => {
  // "fair test" and "place value" are real things he has to learn. Splitting
  // them on the space would quietly turn one word into two wrong ones.
  assert.deepEqual(parseWordEntry("fair test").words, ["fair test"]);
  assert.deepEqual(parseWordEntry("place value, fair test").words, ["place value", "fair test"]);
});

test("case and stray spacing are tidied", () => {
  assert.deepEqual(parseWordEntry("  Fifty ,  THIRTY  ").words, ["fifty", "thirty"]);
  assert.deepEqual(parseWordEntry("fair    test").words, ["fair test"]);
});

test("the same word twice is added once", () => {
  assert.deepEqual(parseWordEntry("fifty, Fifty, fifty").words, ["fifty"]);
});

test("what cannot be accepted comes back, never silently dropped", () => {
  // The parent has to see what did not take, or he finds out weeks later that
  // four of the six he pasted were never there.
  const out = parseWordEntry("fifty, 42, thirty, !!, eighty");
  assert.deepEqual(out.words, ["fifty", "thirty", "eighty"]);
  assert.deepEqual(out.rejected, ["42", "!!"]);
});

test("a pasted sentence splits into words, never stored as one long entry", () => {
  const long = "the quick brown fox jumped over the extraordinarily lazy dog today";
  const out = parseWordEntry(long);
  // Eleven words, but "the" twice, so ten survive de-duplication.
  assert.equal(out.words.length, 10);
  assert.equal(out.words.filter((w) => w === "the").length, 1);
  assert.ok(out.words.every((w) => w.length <= 40 && !w.includes(" ")));
});

test("apostrophes and hyphens survive", () => {
  assert.deepEqual(parseWordEntry("don't, twenty-one").words, ["don't", "twenty-one"]);
});

test("empty input yields nothing and does not throw", () => {
  assert.deepEqual(parseWordEntry("   ").words, []);
  assert.deepEqual(parseWordEntry(",,,").words, []);
});
