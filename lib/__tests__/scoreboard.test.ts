import assert from "node:assert/strict";
import test from "node:test";

import { dayXp, nudge } from "@/lib/scoreboard";

const TZ = "America/Chicago";

test("day XP counts only today in the kid's timezone", () => {
  const activity = [
    { at: "2026-09-25T15:00:00.000Z", xp: 40 }, // Friday
    { at: "2026-09-25T20:00:00.000Z", xp: 30 }, // Friday
    // Saturday 00:30 UTC is still Friday evening in Chicago.
    { at: "2026-09-26T00:30:00.000Z", xp: 5 },
    // Friday 03:00 UTC is Thursday night in Chicago: yesterday.
    { at: "2026-09-25T03:00:00.000Z", xp: 500 },
  ];
  assert.equal(dayXp(activity, "2026-09-25", TZ), 75);
  assert.equal(dayXp(activity, "2026-09-26", TZ), 0);
});

test("the nudge cheers the leader and tells the other how far to go", () => {
  const nour = { name: "Nour", xp: 120 };
  const wissam = { name: "Wissam", xp: 80 };
  const rows = [nour, wissam];
  assert.equal(nudge(nour, rows), "Ahead by 40 XP. Keep it up!");
  assert.equal(nudge(wissam, rows), "40 XP to catch Nour!");
});

test("the nudge handles a fresh day, a zero and a tie", () => {
  const a = { name: "Nour", xp: 0 };
  const b = { name: "Wissam", xp: 0 };
  assert.equal(nudge(a, [a, b]), "New day! First to play takes the lead.");
  b.xp = 20;
  assert.equal(nudge(a, [a, b]), "Play a round to catch Wissam!");
  a.xp = 20;
  assert.equal(nudge(a, [a, b]), "Tied! One more round breaks it.");
});
