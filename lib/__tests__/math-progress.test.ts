import assert from "node:assert/strict";
import { test } from "node:test";

import { MAX_MATH_LEVEL, cleanRounds, nextLevel, scoreRound } from "@/lib/models/MathProgress";

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

test("a round moves the level only when it was played at that level", () => {
  // "Play again" after a promotion still runs the old level, and a drill can
  // be played at any level: easy level-1 rounds must not push a level-2 skill.
  assert.deepEqual(scoreRound(2, [95, 95], 100, 1), { level: 2, recentPcts: [95, 95] });
  assert.deepEqual(scoreRound(2, [40], 10, 3), { level: 2, recentPcts: [40] }, "a hard drill cannot drop it");
  assert.deepEqual(scoreRound(2, [95, 95], 100, 2), { level: 3, recentPcts: [] }, "at its level it counts");
});

test("a round with no level counts as the stored level, as older queued sessions did", () => {
  assert.deepEqual(scoreRound(1, [90, 90], 100), { level: 2, recentPcts: [] });
  assert.deepEqual(scoreRound(1, [80], 90), { level: 1, recentPcts: [90, 80] });
  assert.deepEqual(scoreRound(3, [55], 40), { level: 2, recentPcts: [] });
  assert.deepEqual(scoreRound(2, [90, 90, 50], 70), { level: 2, recentPcts: [70, 90, 90] }, "window stays at three");
});
