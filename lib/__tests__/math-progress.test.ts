import assert from "node:assert/strict";
import { test } from "node:test";

import { MAX_MATH_LEVEL, cleanRounds, nextLevel } from "@/lib/models/MathProgress";

test("three strong sessions in a row step the level up", () => {
  assert.equal(nextLevel(1, [90, 95, 100]), 2);
  assert.equal(nextLevel(1, [90, 100, 80]), 1, "one weak score in the window blocks it");
  assert.equal(nextLevel(1, [100, 90]), 1, "two is not three");
  assert.equal(nextLevel(MAX_MATH_LEVEL, [100, 100, 100]), MAX_MATH_LEVEL);
});

test("a weak run steps the level down, floor 1", () => {
  assert.equal(nextLevel(3, [55, 40, 100]), 2);
  assert.equal(nextLevel(1, [10, 10]), 1);
});

test("an empty window never moves the level", () => {
  // The route clears recentPcts on every level change. That means "nothing has
  // been scored at this level yet", not "he scored zero".
  assert.equal(nextLevel(2, []), 2);
  assert.equal(nextLevel(1, []), 1);
});

test("one bad round no longer drops a level, two in a row still do", () => {
  // He grinds one skill for days. A single off afternoon used to wipe the run.
  assert.equal(nextLevel(2, [55, 100, 100]), 2, "one weak round holds the level");
  assert.equal(nextLevel(2, [55, 40, 100]), 1, "two in a row do drop it");
  assert.equal(nextLevel(1, [10, 10]), 1, "floor is 1");
});

test("clean rounds count the run he has banked toward the next level", () => {
  assert.equal(cleanRounds([]), 0);
  assert.equal(cleanRounds([95]), 1);
  assert.equal(cleanRounds([95, 90]), 2);
  assert.equal(cleanRounds([95, 90, 100]), 3);
  assert.equal(cleanRounds([95, 80, 100]), 1, "the run stops at the weak round");
  assert.equal(cleanRounds([80, 95, 100]), 0, "a weak newest round banks nothing");
});
