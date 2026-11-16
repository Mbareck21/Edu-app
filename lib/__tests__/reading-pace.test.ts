// The reading ladder keeps pace (2026-11-15 sweep): a seven-question reading
// with two misses is a good one, and below grade level one near-perfect
// reading moves him up without waiting for three.

import assert from "node:assert/strict";
import test from "node:test";

import { levelAtGrade } from "@/lib/reading";
import {
  READING_FAST_PCT,
  READING_UP_PCT,
  applyReading,
  emptyProfile,
  nextReadingLevel,
  readingProgress,
} from "@/lib/rewards";
import type { ProfileState, ReadingLog } from "@/lib/types";

const NOW = new Date("2026-11-16T00:00:00Z");
const pct = (right: number, of: number) => Math.round((right / of) * 100);

function log(score: number, level: number): ReadingLog {
  return { at: NOW.toISOString(), level, pct: score, wordsCount: 180 };
}

const GRADE = levelAtGrade();

test("5 of 7 is a good reading, 2 of 3 is not", () => {
  // From level 4 a passage asks six or seven questions. At 75 the bar was
  // 6 of 7: one miss allowed in seven, where levels 1-3 allowed one in five.
  assert.ok(pct(5, 7) >= READING_UP_PCT);
  assert.ok(pct(5, 6) >= READING_UP_PCT);
  assert.ok(pct(4, 5) >= READING_UP_PCT);
  assert.ok(pct(3, 4) >= READING_UP_PCT);
  assert.ok(pct(2, 3) < READING_UP_PCT);
  assert.ok(pct(4, 6) < READING_UP_PCT);
  assert.ok(pct(4, 7) < READING_UP_PCT);
});

test("three readings at 5 of 7 step the level up", () => {
  const five = pct(5, 7);
  assert.equal(nextReadingLevel(GRADE, [log(five, GRADE), log(five, GRADE), log(five, GRADE)]), GRADE + 1);
  assert.equal(nextReadingLevel(4, [log(five, 4), log(five, 4), log(pct(5, 6), 4)]), 5);
  assert.equal(nextReadingLevel(4, [log(five, 4), log(five, 4)]), 4);
});

test("below grade level, one near-perfect reading moves him up at once", () => {
  assert.ok(pct(6, 7) >= READING_FAST_PCT);
  assert.ok(pct(5, 6) < READING_FAST_PCT);
  assert.ok(pct(4, 5) < READING_FAST_PCT);
  assert.equal(nextReadingLevel(1, [log(100, 1)]), 2);
  assert.equal(nextReadingLevel(4, [log(pct(6, 7), 4)]), 5);
  assert.equal(nextReadingLevel(GRADE - 1, [log(100, GRADE - 1)]), GRADE);
  // A good reading that is not near-perfect still waits for three.
  assert.equal(nextReadingLevel(4, [log(pct(5, 6), 4)]), 4);
  // Only the newest reading at the level: an old perfect one behind a weak one is not it.
  assert.equal(nextReadingLevel(4, [log(60, 4), log(100, 4)]), 4);
});

test("from grade level up, it still takes three good readings", () => {
  assert.equal(nextReadingLevel(GRADE, [log(100, GRADE)]), GRADE);
  assert.equal(nextReadingLevel(GRADE, [log(100, GRADE), log(100, GRADE)]), GRADE);
  assert.equal(nextReadingLevel(GRADE, [log(100, GRADE), log(100, GRADE), log(100, GRADE)]), GRADE + 1);
});

test("a fast step up does not cascade, and a leftover easier passage does not count", () => {
  let p: ProfileState = emptyProfile();
  const at = (min: number) => ({ at: new Date(NOW.getTime() + min * 60_000), today: "2026-11-15" });
  p = applyReading(p, { level: 1, pct: 100, wordsCount: 110 }, at(0));
  assert.equal(p.reading.level, 2);
  // A level-1 passage still open on another list: practice, not a level-2 reading.
  p = applyReading(p, { level: 1, pct: 100, wordsCount: 110 }, at(1));
  assert.equal(p.reading.level, 2);
  p = applyReading(p, { level: 2, pct: 60, wordsCount: 140 }, at(2));
  assert.equal(p.reading.level, 2);
  p = applyReading(p, { level: 2, pct: 100, wordsCount: 140 }, at(3));
  assert.equal(p.reading.level, 3);
});

test("a perfect reader climbs from level 1 to grade level in one reading a level", () => {
  let p: ProfileState = emptyProfile();
  let readings = 0;
  while (p.reading.level < GRADE) {
    const at = new Date(NOW.getTime() + readings * 86_400_000);
    p = applyReading(p, { level: p.reading.level, pct: 100, wordsCount: 200 }, { at, today: "2026-11-15" });
    readings++;
    assert.ok(readings <= GRADE, "stuck below grade level");
  }
  assert.equal(readings, GRADE - 1);
});

test("the progress card says when one great reading is enough", () => {
  assert.equal(readingProgress({ level: 4, recent: [] }, NOW).fastTrack, true);
  assert.equal(readingProgress({ level: GRADE, recent: [] }, NOW).fastTrack, false);
});
