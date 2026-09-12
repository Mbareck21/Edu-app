import assert from "node:assert/strict";
import { test } from "node:test";

import { judgeAnswer } from "@/lib/answer-check";

test("an exact answer is correct", () => {
  const j = judgeAnswer("the fox ran into the forest", ["The fox ran into the forest."]);
  assert.equal(j.verdict, "correct");
  assert.equal(j.matched, "The fox ran into the forest.");
  assert.equal(j.coverage, 1);
});

test("a spelling slip still counts — he understood", () => {
  const j = judgeAnswer("in the forrest", ["in the forest"]);
  assert.equal(j.verdict, "close");
  assert.equal(j.coverage, 1);
  assert.equal(j.matched, "in the forest");
});

test("plural vs singular is not a comprehension mistake", () => {
  const j = judgeAnswer("rocks", ["a rock"]);
  assert.equal(j.verdict, "close");
  assert.equal(j.coverage, 1);
});

test("word order does not matter", () => {
  const j = judgeAnswer("into the forest the fox ran", ["the fox ran into the forest"]);
  assert.equal(j.verdict, "correct");
  assert.equal(j.coverage, 1);
});

test("extra words he added are not punished", () => {
  const j = judgeAnswer("i think the fox ran into the forest yesterday", [
    "the fox ran into the forest",
  ]);
  assert.equal(j.verdict, "correct");
  assert.equal(j.coverage, 1);
});

test("a genuinely wrong answer is wrong", () => {
  const j = judgeAnswer("the dog sat down", ["the fox ran into the forest"]);
  assert.equal(j.verdict, "wrong");
  assert.equal(j.matched, "");
});

test("an empty answer is always wrong", () => {
  assert.deepEqual(judgeAnswer("", ["the fox"]), { verdict: "wrong", matched: "", coverage: 0 });
  assert.deepEqual(judgeAnswer("   ", ["the fox"]), { verdict: "wrong", matched: "", coverage: 0 });
});

test("a partial answer at the 0.6 boundary is close, below it is wrong", () => {
  // 3 of the 5 content words (dog, dug, fence) is exactly 0.6.
  const close = judgeAnswer("the dog dug the fence", ["the dog dug under the old fence"]);
  assert.equal(close.verdict, "close");
  assert.equal(close.coverage, 3 / 5);
  // 2 of 5 is under the line.
  const wrong = judgeAnswer("the dog fence", ["the dog dug under the old fence"]);
  assert.equal(wrong.verdict, "wrong");
  assert.equal(wrong.coverage, 2 / 5);
});

test("number words and digits are the same answer", () => {
  assert.equal(judgeAnswer("5 rocks", ["five rocks"]).verdict, "correct");
  assert.equal(judgeAnswer("twenty one", ["21"]).verdict, "correct");
});

test("a stopword-only acceptable answer falls back to whole-string matching", () => {
  assert.equal(judgeAnswer("he did", ["he did"]).verdict, "correct");
  assert.equal(judgeAnswer("no", ["he did"]).verdict, "wrong");
});

test("the best of several acceptable answers is reported", () => {
  const j = judgeAnswer("a big wave", ["the storm", "a big wave"]);
  assert.equal(j.verdict, "correct");
  assert.equal(j.matched, "a big wave");
});

test("a yes/no question takes a plain yes or no", () => {
  const acc = ["yes it matches", "yes it fits", "it matches"];
  const q = "Does the later conclusion match the earlier observations?";
  assert.equal(judgeAnswer("yes", acc, q).verdict, "correct");
  assert.equal(judgeAnswer("Yes.", acc, q).verdict, "correct");
  assert.equal(judgeAnswer("yeah it does", acc, q).verdict, "correct");
  assert.equal(judgeAnswer("no", acc, q).verdict, "wrong");
  assert.equal(judgeAnswer("no it does not", acc, q).verdict, "wrong");
});

test("a leading no is not a yes/no answer when the question is not yes/no", () => {
  assert.equal(judgeAnswer("no", ["no money"], "What did he have left?").verdict, "wrong");
});

test("naming the thing without its describing word is close", () => {
  const q = "What did Sam use to measure wind speed?";
  assert.equal(judgeAnswer("a model", ["a small model"], q).verdict, "close");
  assert.equal(judgeAnswer("small", ["a small model"], q).verdict, "wrong");
});

test("the thing named in the question does not answer it", () => {
  assert.equal(judgeAnswer("car", ["red car"], "What color was the car?").verdict, "wrong");
  assert.equal(judgeAnswer("happy", ["not happy"], "How did she feel?").verdict, "wrong");
});
