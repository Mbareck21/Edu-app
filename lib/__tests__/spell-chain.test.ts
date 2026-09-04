import assert from "node:assert/strict";
import { test } from "node:test";

import {
  CHAIN_TARGET,
  ROTATE_WIDTH,
  applyWrite,
  isGraduated,
  newChain,
  remaining,
  replay,
  rotate,
  rungFor,
} from "@/lib/spell-chain";

const NOW = "2026-09-01T18:00:00.000Z";

test("ten correct in a row graduates the word", () => {
  let s = newChain("fifty");
  for (let i = 0; i < CHAIN_TARGET; i++) s = applyWrite(s, "fifty", NOW).state;
  assert.equal(s.current, CHAIN_TARGET);
  assert.equal(remaining(s), 0);
  assert.ok(isGraduated(s));
});

test("one misspelling puts the count back to zero", () => {
  // The parent's rule, stated plainly. Nine correct then a slip is zero.
  let s = newChain("fifty");
  for (let i = 0; i < 9; i++) s = applyWrite(s, "fifty", NOW).state;
  assert.equal(s.current, 9);
  assert.equal(remaining(s), 1);

  s = applyWrite(s, "fefte", NOW).state; // his real substitution
  assert.equal(s.current, 0);
  assert.equal(remaining(s), CHAIN_TARGET);
  assert.ok(!isGraduated(s));
});

test("a reset costs him the chain but never the ground", () => {
  // reps is why. He keeps the support he has earned, so a reset at nine does
  // not send him back to copying letter by letter.
  let s = newChain("thirty");
  for (let i = 0; i < 9; i++) s = applyWrite(s, "thirty", NOW).state;
  const earned = s.reps;
  s = applyWrite(s, "therte", NOW).state;
  assert.equal(s.current, 0, "the chain falls");
  assert.equal(s.reps, earned, "the lifetime reps do not");
  assert.equal(s.best, 9, "and the best run is still on the board");
});

test("the write straight after a mistake always shows him the word", () => {
  // He must not practise the error. The rung after a miss is always copy,
  // whatever he has earned.
  let s = newChain("eighty");
  for (let i = 0; i < 20; i++) s = applyWrite(s, "eighty", NOW).state;
  assert.equal(rungFor(s, false), "blind", "earned his way to no help");
  assert.equal(rungFor(s, true), "copy", "but a miss puts the word back up");
});

test("support fades as lifetime reps build, and only forwards", () => {
  let s = newChain("ninety");
  assert.equal(rungFor(s, false), "copy");
  for (let i = 0; i < 2; i++) s = applyWrite(s, "ninety", NOW).state;
  assert.equal(rungFor(s, false), "cover");
  for (let i = 0; i < 2; i++) s = applyWrite(s, "ninety", NOW).state;
  assert.equal(rungFor(s, false), "chunk");
  for (let i = 0; i < 3; i++) s = applyWrite(s, "ninety", NOW).state;
  assert.equal(rungFor(s, false), "blind");
});

test("best only ever rises", () => {
  let s = newChain("twenty");
  for (let i = 0; i < 6; i++) s = applyWrite(s, "twenty", NOW).state;
  s = applyWrite(s, "twene", NOW).state;
  for (let i = 0; i < 3; i++) s = applyWrite(s, "twenty", NOW).state;
  assert.equal(s.current, 3);
  assert.equal(s.best, 6, "the shorter later run must not lower it");
});

test("capitals and stray punctuation do not fail a correct spelling", () => {
  // spellingKey is the same normaliser the spell items use. This drill is
  // about the letters, not about the shift key.
  const s = newChain("fifty");
  assert.ok(applyWrite(s, "Fifty", NOW).correct);
  assert.ok(applyWrite(s, " fifty ", NOW).correct);
  assert.ok(applyWrite(s, "fifty.", NOW).correct);
});

test("an almost is a miss", () => {
  // Elsewhere in the app a near-miss earns credit for the idea. Not here:
  // the whole point of this drill is the exact letters.
  const s = newChain("ninety");
  assert.ok(!applyWrite(s, "ninty", NOW).correct);
});

test("counters never leave their bounds", () => {
  let s = newChain("fifty");
  for (let i = 0; i < 40; i++) s = applyWrite(s, "fifty", NOW).state;
  assert.equal(s.current, CHAIN_TARGET, "never overshoots the target");
  assert.ok(s.best >= s.current);
  assert.ok(s.reps <= s.attempts);
  assert.equal(remaining(s), 0);
});

test("graduation is stamped once and never restamped", () => {
  let s = newChain("fifty");
  for (let i = 0; i < CHAIN_TARGET; i++) s = applyWrite(s, "fifty", NOW).state;
  const first = s.graduatedAt;
  s = applyWrite(s, "fefte", "2026-09-09T00:00:00.000Z").state;
  for (let i = 0; i < CHAIN_TARGET; i++) {
    s = applyWrite(s, "fifty", "2026-09-09T00:00:00.000Z").state;
  }
  assert.equal(s.graduatedAt, first, "the day he first did it does not move");
});

test("the server's replay agrees with the screen, keystroke for keystroke", () => {
  // The phone posts what he typed, never whether it was right. Both sides run
  // the same function, so there is nothing to forge and nothing to disagree on.
  const typed = ["fifty", "fifty", "fefte", "fifty", "Fifty", "fifty"];
  const onScreen = typed.reduce(
    (acc, t) => applyWrite(acc, t, NOW).state,
    newChain("fifty")
  );
  const onServer = replay(newChain("fifty"), typed, NOW);
  assert.deepEqual(onServer, onScreen);
  assert.equal(onServer.current, 3, "the miss reset it, the three after it count");
});

test("a sitting rotates between words instead of hammering one", () => {
  // Ten writes of the same word back to back is copying, not remembering: he
  // can hold the letters for four seconds without ever storing them. Another
  // word in between is not a mistake, so the chain still means what was asked.
  const words = ["fifty", "thirty", "eighty"];
  const order = Array.from({ length: 6 }, (_, i) => rotate(words, i));
  assert.deepEqual(order, ["fifty", "thirty", "eighty", "fifty", "thirty", "eighty"]);
  for (let i = 0; i < order.length - 1; i++) {
    assert.notEqual(order[i], order[i + 1], "never the same word twice running");
  }
  assert.ok(ROTATE_WIDTH >= 2, "one word alone would defeat the spacing");
});

test("an empty rotation does not crash the sitting", () => {
  assert.equal(rotate([], 3), "");
});
