import assert from "node:assert/strict";
import test from "node:test";

import { weekDaysPlayed, weekStart, weekXp } from "@/lib/scoreboard";

const TZ = "America/Chicago";

test("the week starts on Monday", () => {
  assert.equal(weekStart("2026-09-21"), "2026-09-21"); // Monday
  assert.equal(weekStart("2026-09-25"), "2026-09-21"); // Friday
  assert.equal(weekStart("2026-09-27"), "2026-09-21"); // Sunday
  assert.equal(weekStart("2026-10-01"), "2026-09-28"); // across a month
});

test("week XP counts Monday to today in the kid's timezone", () => {
  const activity = [
    { at: "2026-09-25T15:00:00.000Z", xp: 40 }, // Friday
    { at: "2026-09-21T15:00:00.000Z", xp: 30 }, // Monday
    // Monday 00:30 UTC is still Sunday evening in Chicago: last week.
    { at: "2026-09-21T00:30:00.000Z", xp: 500 },
    { at: "2026-09-14T15:00:00.000Z", xp: 99 }, // last week
  ];
  assert.equal(weekXp(activity, "2026-09-25", TZ), 70);
  assert.equal(weekDaysPlayed(activity, "2026-09-25", TZ), 2);
});
