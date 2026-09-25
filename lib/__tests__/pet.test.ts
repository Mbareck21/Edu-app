import assert from "node:assert/strict";
import test from "node:test";

import { PET_STAGES, growthPoints, mathLevelsUp, petLines, petMood, petState } from "@/lib/pet";

test("growth counts known words, mastered words again, and math levels gained", () => {
  assert.equal(growthPoints({ wordsKnown: 5, wordsMastered: 2, mathLevelsUp: 3 }), 10);
  assert.equal(growthPoints({ wordsKnown: -1, wordsMastered: NaN, mathLevelsUp: 0 }), 0);
});

test("math levels only count above level 1", () => {
  assert.equal(mathLevelsUp([1, 2, 3]), 3);
  assert.equal(mathLevelsUp([]), 0);
});

test("the pet starts as an egg and grows at each stage's mark", () => {
  assert.equal(petState(0, "happy").stage.id, "egg");
  assert.equal(petState(2, "happy").stage.id, "egg");
  for (const stage of PET_STAGES) {
    assert.equal(petState(stage.at, "happy").stage.id, stage.id);
  }
  assert.equal(petState(10_000, "happy").stage.id, "legend");
});

test("progress and points to next are measured within the stage", () => {
  const pet = petState(6, "happy"); // baby: 3 → kid: 10
  assert.equal(pet.stage.id, "baby");
  assert.equal(pet.toNext, 4);
  assert.ok(Math.abs(pet.progress - 3 / 7) < 1e-9);
  const top = petState(150, "happy");
  assert.equal(top.next, null);
  assert.equal(top.toNext, 0);
  assert.equal(top.progress, 1);
});

test("mood follows today's lessons against the goal", () => {
  assert.equal(petMood(0, 3), "sleepy");
  assert.equal(petMood(1, 3), "happy");
  assert.equal(petMood(3, 3), "proud");
  assert.equal(petMood(1, 0), "proud");
});

test("lines name what is next, with the right plural", () => {
  const growth = { wordsKnown: 1, wordsMastered: 0, mathLevelsUp: 1 };
  const lines = petLines(petState(growthPoints(growth), "sleepy"), growth);
  assert.ok(lines.some((l) => l.includes("You know 1 word ")));
  assert.ok(lines.some((l) => l.includes("1 more word or math level and I grow into Baby Sparky")));
});
