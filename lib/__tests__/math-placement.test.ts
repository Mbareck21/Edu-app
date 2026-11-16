// A skill is placed by the evidence already on record (2026-11-15 sweep): a
// clean round banked below the class level counts, without being played again.

import assert from "node:assert/strict";
import test from "node:test";

import { CLASS_LEVEL } from "@/lib/math/session";
import { applyRound, servedLevel, settleLevel } from "@/lib/models/MathProgress";

const DAY = "2026-11-16";
const at = `${DAY}T15:00:00.000Z`;

test("below the class level, a clean newest round already banked moves the skill up one", () => {
  assert.deepEqual(settleLevel(1, [100, 100]), { level: 2, recentPcts: [] });
  assert.deepEqual(settleLevel(2, [90]), { level: 3, recentPcts: [] });
  // One level for one round: two clean rounds at level 1 prove level 1, not level 2.
  assert.equal(settleLevel(1, [100, 100, 100]).level, 2);
});

test("anything short of that leaves the skill where it is", () => {
  assert.deepEqual(settleLevel(1, [87, 100]), { level: 1, recentPcts: [87, 100] }, "the newest round decides");
  assert.deepEqual(settleLevel(1, []), { level: 1, recentPcts: [] }, "never played: no evidence");
  assert.deepEqual(settleLevel(CLASS_LEVEL, [100, 100]), { level: CLASS_LEVEL, recentPcts: [100, 100] });
  assert.deepEqual(settleLevel(4, [100]), { level: 4, recentPcts: [100] });
});

test("the round is dealt at the settled level", () => {
  assert.equal(servedLevel({ level: 1, recentPcts: [100, 100], lastAt: at }, DAY), 2);
  assert.equal(servedLevel({ level: 1, recentPcts: [80], lastAt: at }, DAY), 1);
  assert.equal(servedLevel({ level: 1, lastAt: at }, DAY), 1);
  assert.equal(servedLevel(null, DAY), 1);
});

test("and scored at it, so the round he plays counts", () => {
  const stored = { level: 1, recentPcts: [100, 100], lastAt: at };
  // Dealt at 2, played clean: level 3, the class level, in one lesson.
  assert.deepEqual(applyRound(stored, { answered: 10, correct: 10, playedLevel: 2 }, DAY), { level: 3, recentPcts: [] });
  // Dealt at 2, a weak round: he stays at 2 with that round on record.
  assert.deepEqual(applyRound(stored, { answered: 10, correct: 5, playedLevel: 2 }, DAY), { level: 2, recentPcts: [50] });
  // A round queued from before, played at level 1: the banked round still
  // counts, and the easy round does not count twice.
  assert.deepEqual(applyRound(stored, { answered: 10, correct: 10, playedLevel: 1 }, DAY), { level: 2, recentPcts: [] });
});

test("a skill with nothing banked is scored as it always was", () => {
  assert.deepEqual(
    applyRound({ level: 1, recentPcts: [], lastAt: null }, { answered: 10, correct: 9, playedLevel: 1 }, DAY),
    { level: 2, recentPcts: [] }
  );
  assert.deepEqual(
    applyRound({ level: 3, recentPcts: [100, 100], lastAt: at }, { answered: 10, correct: 8, playedLevel: 3 }, DAY),
    { level: 3, recentPcts: [80, 100, 100] }
  );
});
