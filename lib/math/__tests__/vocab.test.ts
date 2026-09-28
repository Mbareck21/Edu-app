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

test("the hint only points at a picture when there is one", () => {
  const q = { prompt: "", answer: 6000, visual: { kind: "none" as const }, how: "", op: "?" as const };
  assert.ok(!mathHint(q, 9).includes("picture"));
  const shown = { ...q, visual: { kind: "placevalue" as const, value: 6000, place: "thousands" as const } };
  assert.ok(mathHint(shown, 9).includes("picture"));
});

test("the voice reads a mixed number with its \"and\"", () => {
  // "2 3/8" was read "2 3 over 8": two numbers, not two and three eighths.
  assert.equal(speakable("How many 1/8 make 2 3/8?"), "How many 1 over 8 make 2 and 3 over 8?");
  assert.equal(
    speakable("1 2/5 + 2 3/5 = ?/5. Type the top number."),
    "1 and 2 over 5 plus 2 and 3 over 5 equals what over 5. Type the top number."
  );
});

test("the voice says the blank in a list of factors", () => {
  // "1, 2, ?, 6" read "1, 2, , 6": the missing one was never said.
  assert.equal(
    speakable("The factors of 12 are 1, 2, ?, 4, 6, 12. What is missing?"),
    "The factors of 12 are 1, 2, what, 4, 6, 12. What is missing?"
  );
});

test("a division with something left over gets its own hint", () => {
  // "Which number times the one you know makes it?" has no answer when
  // something is left over; it sent him looking for one.
  const q = (prompt: string, answer: number) => ({
    prompt,
    answer,
    visual: { kind: "none" as const },
    how: "",
    op: "÷" as const,
  });
  for (const [prompt, answer] of [
    ["72 ÷ 7. How many are left over?", 2],
    ["72 ÷ 7. How many whole groups?", 10],
    ["Each box holds 9 marbles. There are 70. How many boxes are needed?", 8],
    ["Each box holds 14 cars. There are 150. How many full boxes?", 10],
  ] as const) {
    const hint = mathHint(q(prompt, answer), answer + 1);
    assert.ok(!hint.includes("times the one you know"), `${prompt}: ${hint}`);
    assert.ok(!hint.includes(String(answer)), `the hint gives ${answer} away: ${hint}`);
  }
  // The boxes question asks about the leftovers; the full-boxes one does not.
  assert.notEqual(
    mathHint(q("Each box holds 9 marbles. There are 70. How many boxes are needed?", 8), 7),
    mathHint(q("Each box holds 14 cars. There are 150. How many full boxes?", 10), 9)
  );
});
