import assert from "node:assert/strict";
import { test } from "node:test";

import {
  MAX_MATH_LEVEL,
  applyRound,
  cleanRounds,
  nextLevel,
  scoreRound,
  servedLevel,
} from "@/lib/models/MathProgress";

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

test("levels climb through Grade 5: 3 -> 4 -> 5, and stop at 5", () => {
  assert.equal(MAX_MATH_LEVEL, 5);
  assert.equal(nextLevel(3, [90, 95, 100]), 4);
  assert.equal(nextLevel(4, [90, 95, 100]), 5);
  assert.equal(nextLevel(5, [100, 100, 100]), 5);
  assert.equal(nextLevel(5, [50, 40]), 4);
  assert.equal(nextLevel(9, []), 5, "clamped to the top level");
});

const G4_DAY = "2026-10-01";
const G5_DAY = "2027-08-20";

test("a short timed drill never drops the level", () => {
  // 2 of 2 in a minute scores 40% against the timed floor. That is not a weak round.
  let state = { level: 2, recentPcts: [] as number[], lastAt: null };
  for (let i = 0; i < 2; i++) {
    state = { ...applyRound(state, { answered: 2, correct: 2, timed: true, playedLevel: 2 }, G4_DAY), lastAt: null };
  }
  assert.equal(state.level, 2);
  assert.deepEqual(state.recentPcts, []);
  // A relaxed round at 40% still counts, so two in a row do drop it.
  let relaxed = { level: 2, recentPcts: [] as number[], lastAt: null };
  for (let i = 0; i < 2; i++) {
    relaxed = { ...applyRound(relaxed, { answered: 5, correct: 2, playedLevel: 2 }, G4_DAY), lastAt: null };
  }
  assert.equal(relaxed.level, 1);
});

test("Grade 5 serves and saves every skill at level 4 or higher", () => {
  // Grade 4: unchanged, and a level past 3 is allowed.
  assert.equal(servedLevel({ level: 1, lastAt: null }, G4_DAY), 1);
  assert.equal(servedLevel({ level: 5, lastAt: `${G4_DAY}T15:00:00.000Z` }, G4_DAY), 5);
  // Grade 5: a Grade 4 level, or a skill never played, starts at 4.
  assert.equal(servedLevel(null, G5_DAY), 4);
  assert.equal(servedLevel({ level: 2, lastAt: `${G4_DAY}T15:00:00.000Z` }, G5_DAY), 4);
  assert.equal(servedLevel({ level: 5, lastAt: `${G4_DAY}T15:00:00.000Z` }, G5_DAY), 5);
  // Saved in Grade 5 at 3 (a support drop): it stays 3.
  assert.equal(servedLevel({ level: 3, lastAt: `${G5_DAY}T15:00:00.000Z` }, G5_DAY), 3);

  // The next round saves the lift, and drops the window earned at the old level.
  const lifted = applyRound(
    { level: 2, recentPcts: [95, 95], lastAt: new Date(`${G4_DAY}T15:00:00.000Z`) },
    { answered: 10, correct: 10, playedLevel: 4 },
    G5_DAY
  );
  assert.deepEqual(lifted, { level: 4, recentPcts: [100] });
});

test("Grade 5 can drop to 3 for support, never lower", () => {
  const at = new Date(`${G5_DAY}T15:00:00.000Z`);
  const down = applyRound({ level: 4, recentPcts: [40], lastAt: at }, { answered: 10, correct: 3, playedLevel: 4 }, G5_DAY);
  assert.equal(down.level, 3);
  const floor = applyRound({ level: 3, recentPcts: [40], lastAt: at }, { answered: 10, correct: 3, playedLevel: 3 }, G5_DAY);
  assert.equal(floor.level, 3);
});
