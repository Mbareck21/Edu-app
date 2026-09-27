import assert from "node:assert/strict";
import test from "node:test";

import { RIVALRY_START, freshRivalry, pointsOf, settleDay, settleThrough } from "@/lib/rivalry";

test("the winner takes a point, and a win against the holder takes one back", () => {
  let r = freshRivalry();
  r = settleDay(r, "2026-09-25", { nour: 200, wissam: 500 });
  assert.equal(pointsOf(r, "wissam"), 1);
  assert.equal(pointsOf(r, "nour"), 0);
  // Nour wins tonight: Wissam loses his point.
  r = settleDay(r, "2026-09-26", { nour: 600, wissam: 100 });
  assert.equal(pointsOf(r, "wissam"), 0);
  assert.equal(pointsOf(r, "nour"), 0);
  assert.equal(r.holder, null);
  // Nour wins again: now he holds one.
  r = settleDay(r, "2026-09-27", { nour: 300, wissam: 100 });
  assert.equal(pointsOf(r, "nour"), 1);
});

test("the holder keeps adding while he keeps winning", () => {
  let r = freshRivalry();
  for (const day of ["2026-09-25", "2026-09-26", "2026-09-27"]) {
    r = settleDay(r, day, { nour: 10, wissam: 90 });
  }
  assert.equal(pointsOf(r, "wissam"), 3);
  r = settleDay(r, "2026-09-28", { nour: 90, wissam: 10 });
  assert.equal(pointsOf(r, "wissam"), 2);
});

test("a tie, or a day nobody played, moves nothing but is counted as settled", () => {
  let r = settleDay(freshRivalry(), "2026-09-25", { nour: 50, wissam: 90 });
  r = settleDay(r, "2026-09-26", { nour: 70, wissam: 70 });
  r = settleDay(r, "2026-09-27", { nour: 0, wissam: 0 });
  assert.equal(pointsOf(r, "wissam"), 1);
  assert.equal(r.through, "2026-09-27");
});

test("settling runs every finished day since the start, and only once", () => {
  const xp: Record<string, Record<string, number>> = {
    "2026-09-25": { nour: 10, wissam: 20 },
    "2026-09-26": { nour: 10, wissam: 20 },
  };
  const xpOn = (d: string) => xp[d] ?? { nour: 0, wissam: 0 };
  const r = settleThrough(freshRivalry(), "2026-09-26", xpOn);
  assert.equal(r.through, "2026-09-26");
  assert.equal(pointsOf(r, "wissam"), 2);
  assert.deepEqual(settleThrough(r, "2026-09-26", xpOn), r);
  assert.equal(freshRivalry().through < RIVALRY_START, true);
});
