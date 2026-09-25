import assert from "node:assert/strict";
import test from "node:test";

import { PET_STAGES, growthPoints, mathLevelsUp, petLines, petMood, petState } from "@/lib/pet";

test("growth counts known words, mastered words again, and math levels gained", () => {
  assert.equal(growthPoints({ wordsKnown: 5, wordsMastered: 2, mathLevelsUp: 3 }), 10);
  assert.equal(growthPoints({ wordsKnown: -1, wordsMastered: NaN, mathLevelsUp: 0 }), 0);
});

test("math levels only count above level 1", () => {
  assert.equal(mathLevelsUp([1, 2, 3], "2026-09-25"), 3);
  assert.equal(mathLevelsUp([], "2026-09-25"), 0);
});

test("the Grade 5 lift to level 4 neither adds growth nor takes Grade 4 growth away", () => {
  const grade4 = "2027-05-20";
  const grade5 = "2027-05-21";
  // Last day of Grade 4: 1, 2 and 3 are all earned.
  assert.equal(mathLevelsUp([1, 2, 3], grade4), 3);
  // The switch day: the same levels still count, so Sparky never shrinks.
  assert.equal(mathLevelsUp([1, 2, 3], grade5), 3);
  // The lift to 4 counts no more than the Grade 4 top, level 3.
  assert.equal(mathLevelsUp([3, 3, 3], grade4), mathLevelsUp([4, 4, 4], grade5));
  // A support drop to 3 in Grade 5 keeps the Grade 4 credit.
  assert.equal(mathLevelsUp([3, 4], grade5), 4);
  // Earning level 5 in Grade 5 grows him by one.
  assert.equal(mathLevelsUp([5, 4, 4], grade5), 7);
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
