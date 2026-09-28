import assert from "node:assert/strict";
import test from "node:test";

import {
  RIVALRY_START,
  SETTLE_GRACE_DAYS,
  freshRivalry,
  pointsOf,
  rankRows,
  rivalryView,
  settleDay,
  settleThrough,
} from "@/lib/rivalry";

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

test("the scoreboard sorts by XP today, then by trophy points", () => {
  const r = { through: "2026-09-26", holder: "wissam", points: 2 };
  const rows = [
    { learner: "nour", xp: 0 },
    { learner: "wissam", xp: 0 },
  ];
  assert.deepEqual(rankRows(rows, r).map((x) => x.learner), ["wissam", "nour"], "a new day: points decide");
  rows[0].xp = 40;
  assert.deepEqual(rankRows(rows, r).map((x) => x.learner), ["nour", "wissam"], "during the day: XP decides");
});

test("a day is shown the morning after but stored only after the grace days, so late sessions count", () => {
  const xp: Record<string, Record<string, number>> = {
    "2026-09-25": { nour: 300, wissam: 0 },
    "2026-09-26": { nour: 300, wissam: 650 }, // Wissam's 650 arrives late
  };
  const early = (day: string) => (day === "2026-09-26" ? { nour: 300, wissam: 0 } : (xp[day] ?? {}));
  // The morning of the 27th: the 26th is shown, not stored.
  const first = rivalryView(freshRivalry(), "2026-09-27", early);
  assert.equal(first.shown.holder, "nour");
  assert.equal(first.shown.points, 2);
  assert.equal(first.store, null, "nothing past the grace days yet");
  // Wissam's phone sends the 26th's session later: the shown count follows.
  const later = rivalryView(freshRivalry(), "2026-09-27", (day) => xp[day] ?? {});
  assert.equal(later.shown.points, 0);
  // Past the grace days the day is stored, with the late session in it.
  const stored = rivalryView(freshRivalry(), `2026-09-${27 + SETTLE_GRACE_DAYS}`, (day) => xp[day] ?? {});
  assert.equal(stored.store?.through, "2026-09-26");
  assert.equal(stored.store?.points, 0);
});

test("a stored day that is not a date cannot hang the scoreboard", () => {
  // addDays("") is "", and "" <= yesterday is always true: the loop never ended
  // and every Home and Me render hung with it.
  for (const through of ["", "2026-9-30", "undefined"]) {
    const out = settleThrough({ through, holder: null, points: 0 }, "2026-10-05", () => ({ nour: 10, wissam: 5 }));
    assert.equal(out.points, 0, through);
  }
});
