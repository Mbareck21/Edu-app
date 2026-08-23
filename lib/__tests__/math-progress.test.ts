import assert from "node:assert/strict";
import { test } from "node:test";

import { MAX_MATH_LEVEL, nextLevel } from "@/lib/models/MathProgress";

test("three strong sessions in a row step the level up", () => {
  assert.equal(nextLevel(1, [90, 95, 100]), 2);
  assert.equal(nextLevel(1, [90, 100, 80]), 1, "one weak score in the window blocks it");
  assert.equal(nextLevel(1, [100, 90]), 1, "two is not three");
  assert.equal(nextLevel(MAX_MATH_LEVEL, [100, 100, 100]), MAX_MATH_LEVEL);
});

test("one weak session steps the level down, floor 1", () => {
  assert.equal(nextLevel(3, [55, 100, 100]), 2);
  assert.equal(nextLevel(1, [10]), 1);
});

test("an empty window never moves the level", () => {
  // The route clears recentPcts on every level change. That means "nothing has
  // been scored at this level yet", not "he scored zero".
  assert.equal(nextLevel(2, []), 2);
  assert.equal(nextLevel(1, []), 1);
});
