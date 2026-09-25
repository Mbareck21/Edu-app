import assert from "node:assert/strict";
import test from "node:test";

import { mathHint } from "../hint";
import { speakable, termSegments } from "../vocab";

test("math words are marked, longest phrase first, the rest is plain text", () => {
  const segs = termSegments("Sam had 640 cars. He gave away 215. How many left?");
  assert.deepEqual(
    segs.filter((s) => s.term).map((s) => s.text),
    ["gave away", "left"]
  );
  assert.equal(segs.map((s) => s.text).join(""), "Sam had 640 cars. He gave away 215. How many left?");
  const over = termSegments("17 ÷ 5. How many are left over?");
  assert.deepEqual(over.filter((s) => s.term).map((s) => s.text), ["left over"]);
});

test("whole words only: 'each' is not found inside 'reach'", () => {
  assert.equal(termSegments("They reach home.").filter((s) => s.term).length, 0);
  assert.equal(termSegments("Each box holds 8.")[0].term?.term, "each");
});

test("the voice reads symbols as words", () => {
  assert.equal(speakable("24 × 3 = ?"), "24 times 3 equals what");
  assert.equal(speakable("56 ÷ 7 = ?"), "56 divided by 7 equals what");
  assert.equal(speakable("3/8 + 2/8 = ?/8. Type the top number."), "3 over 8 plus 2 over 8 equals what over 8. Type the top number.");
  assert.equal(speakable("A right angle is 90°."), "A right angle is 90 degrees.");
  assert.equal(speakable("4,500 - 1,250 = ?"), "4500 minus 1250 equals what");
  assert.equal(speakable("$4.50 - $1.20 = ? Type it in cents."), "$4.50 minus $1.20 equals what Type it in cents.");
});

test("the hint says too big or too small, and so close when nearly right", () => {
  const q = { prompt: "", answer: 100, visual: { kind: "none" as const }, how: "", op: "+" as const };
  assert.match(mathHint(q, 150), /^Too big\. Put the amounts together\.$/);
  assert.match(mathHint(q, 40), /^Too small\./);
  assert.match(mathHint(q, 95), /^So close!/);
  // The hint never gives the answer away.
  assert.ok(!mathHint(q, 40).includes("100"));
});
