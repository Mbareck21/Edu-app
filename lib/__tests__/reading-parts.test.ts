import assert from "node:assert/strict";
import test from "node:test";

import { partPlan, splitParts, wordsFirst } from "@/lib/reading";

const P1 = "One. Two. Three. Four. Five. Six. Seven.";
const P2 = "Eight is here. Mr. Diaz waved. Nine.";

test("parts are about three sentences and stay inside a paragraph", () => {
  const parts = splitParts(`${P1}\n\n${P2}`);
  assert.deepEqual(parts, [
    "One. Two. Three.",
    "Four. Five.",
    "Six. Seven.",
    "Eight is here. Mr. Diaz waved. Nine.",
  ]);
});

test("each question waits for the part with its answer; the last waits for the end", () => {
  const parts = ["A cat sat.", "The dog ran.", "Then it rained."];
  const plan = partPlan(parts, [
    { source: "" }, // main idea: the end
    { source: "The dog ran." },
    { source: "A cat sat." },
    { source: "The dog ran." },
  ]);
  assert.deepEqual(plan.order, [2, 1, 3, 0]);
  assert.deepEqual(plan.partOf, [2, 1, 0, 1]);
});

test("the last question is pulled to the last part so every part gets read", () => {
  const plan = partPlan(["A cat sat.", "The dog ran.", "Then it rained."], [
    { source: "A cat sat." },
    { source: "The dog ran." },
  ]);
  assert.deepEqual(plan.order, [0, 1]);
  assert.deepEqual(plan.partOf, [0, 2]);
});

test("words first: the longest three, in passage order, once each", () => {
  // shelter and habitat tie on length; the first one listed wins.
  const text = "The habitat gave shelter. Its camouflage hid it from predators.";
  const g = (word: string) => ({ word, meaning: "", arabic: "" });
  const picked = wordsFirst([g("shelter"), g("predators"), g("habitat"), g("camouflage"), g("Habitat")], text);
  assert.deepEqual(picked.map((w) => w.word), ["shelter", "camouflage", "predators"]);
});
