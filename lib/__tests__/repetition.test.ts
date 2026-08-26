import assert from "node:assert/strict";
import { test } from "node:test";

import { mulberry32 } from "@/lib/math/rng";
import {
  insertRepeat,
  OTHER_REPEATS,
  REPEAT_GAPS,
  repeatsFor,
  SESSION_REPEAT_CAP,
  SPELL_REPEATS,
} from "@/lib/repetition";

const queueOf = (n: number) => Array.from({ length: n }, (_, i) => `q${i}`);

test("a missed spelling item earns more returns than any other kind", () => {
  // Spelling is the weak skill — the worksheet was 0/20 on written words.
  assert.ok(repeatsFor("spell") > repeatsFor("recognize"));
  assert.ok(repeatsFor("write") > repeatsFor("use-cloze"));
  assert.equal(repeatsFor("spell"), SPELL_REPEATS);
  assert.equal(repeatsFor("listen"), OTHER_REPEATS);
});

test("even the biggest per-item grant fits under the session cap", () => {
  assert.ok(SPELL_REPEATS < SESSION_REPEAT_CAP);
});

test("gaps expand across repeat indices", () => {
  for (let i = 1; i < REPEAT_GAPS.length; i++) {
    assert.ok(REPEAT_GAPS[i] > REPEAT_GAPS[i - 1], `gap ${i} should beat gap ${i - 1}`);
  }
});

test("a return never lands at index 0 or 1 — that is copying, not recall", () => {
  for (let seed = 1; seed <= 50; seed++) {
    for (let repeat = 0; repeat <= REPEAT_GAPS.length + 1; repeat++) {
      const next = insertRepeat(queueOf(20), "back", repeat, mulberry32(seed));
      assert.ok(next.indexOf("back") >= 2, `landed at ${next.indexOf("back")}`);
    }
  }
});

test("later repeat indices land further out than the first", () => {
  // Jitter is at most +1 and the gaps are 2 apart, so the ranges never overlap.
  for (let seed = 1; seed <= 30; seed++) {
    const first = insertRepeat(queueOf(20), "back", 0, mulberry32(seed)).indexOf("back");
    const last = insertRepeat(queueOf(20), "back", REPEAT_GAPS.length - 1, mulberry32(seed)).indexOf("back");
    assert.ok(last > first, `repeat ${REPEAT_GAPS.length - 1} at ${last}, repeat 0 at ${first}`);
  }
});

test("a short queue still takes the item and never drops it", () => {
  for (const len of [0, 1, 2]) {
    const next = insertRepeat(queueOf(len), "back", 2, mulberry32(9));
    assert.equal(next.length, len + 1);
    assert.ok(next.includes("back"));
  }
  // Empty queue: the item is all there is.
  assert.deepEqual(insertRepeat([], "back", 0, mulberry32(9)), ["back"]);
});

test("the same seed gives the same placement", () => {
  for (let repeat = 0; repeat < REPEAT_GAPS.length; repeat++) {
    assert.deepEqual(
      insertRepeat(queueOf(15), "back", repeat, mulberry32(41)),
      insertRepeat(queueOf(15), "back", repeat, mulberry32(41))
    );
  }
});
