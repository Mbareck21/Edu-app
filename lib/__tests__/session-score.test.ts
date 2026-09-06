import assert from "node:assert/strict";
import { test } from "node:test";

import { TIMED_MIN_ANSWERED, sessionPct, sessionPerfect } from "@/lib/session-score";

/**
 * The real row this came from: drill:math:mixed:t60#1 — one answer in sixty
 * seconds, scored 100, marked perfect, paid the bonus.
 */

test("one right answer in a timed minute is not 100%, and not perfect", () => {
  const run = { answered: 1, correct: 1, timed: true };
  assert.equal(sessionPct(run), Math.round((1 / TIMED_MIN_ANSWERED) * 100));
  assert.equal(sessionPerfect(run), false);
});

test("a timed run that clears the floor scores on what he actually did", () => {
  assert.equal(sessionPct({ answered: 5, correct: 5, timed: true }), 100);
  assert.equal(sessionPerfect({ answered: 5, correct: 5, timed: true }), true);
  assert.equal(sessionPct({ answered: 15, correct: 12, timed: true }), 80);
  assert.equal(sessionPerfect({ answered: 15, correct: 12, timed: true }), false);
});

test("a fixed set is scored right-over-asked, as before", () => {
  assert.equal(sessionPct({ answered: 10, correct: 10 }), 100);
  assert.equal(sessionPerfect({ answered: 10, correct: 10 }), true);
  assert.equal(sessionPct({ answered: 10, correct: 7 }), 70);
  assert.equal(sessionPerfect({ answered: 10, correct: 7 }), false);
});

test("nothing answered is nothing scored", () => {
  assert.equal(sessionPct({ answered: 0, correct: 0 }), 0);
  assert.equal(sessionPct({ answered: 0, correct: 0, timed: true }), 0);
  assert.equal(sessionPerfect({ answered: 0, correct: 0 }), false);
  assert.equal(sessionPerfect({ answered: 0, correct: 0, timed: true }), false);
});

test("correct can never exceed what was answered, whatever the wire says", () => {
  assert.equal(sessionPct({ answered: 3, correct: 9 }), 100);
  // Timed: clamped to the 3 he answered, judged against the floor of 5.
  assert.equal(sessionPct({ answered: 3, correct: 9, timed: true }), 60);
});

test("the floor is under any real pace, so it only catches a run cut short", () => {
  // His ten-question lessons run 45-185 seconds; five in sixty is slower than
  // his slowest. The floor must never punish a genuine minute of work.
  assert.ok(TIMED_MIN_ANSWERED <= 6);
  assert.ok(TIMED_MIN_ANSWERED >= 3, "and high enough that one answer cannot be a session");
});
