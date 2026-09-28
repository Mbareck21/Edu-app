import assert from "node:assert/strict";
import test from "node:test";

import { RACE_CAP, activityKind, nudge, raceClosed, raceXp } from "@/lib/scoreboard";

const TZ = "America/Chicago";

test("race XP counts today in the kid's timezone, before 9:30 pm", () => {
  const activity = [
    { at: "2026-09-25T15:00:00.000Z", xp: 40, ref: "quest:review" }, // Friday 10:00
    { at: "2026-09-25T20:00:00.000Z", xp: 30, ref: "math:place-value" }, // Friday 15:00
    // Saturday 00:30 UTC is still Friday evening (19:30) in Chicago.
    { at: "2026-09-26T00:30:00.000Z", xp: 5, ref: "read:structure" },
    // Saturday 02:45 UTC is Friday 21:45 in Chicago: after the race closed.
    { at: "2026-09-26T02:45:00.000Z", xp: 900, ref: "tables:7" },
    // Friday 03:00 UTC is Thursday night in Chicago: yesterday.
    { at: "2026-09-25T03:00:00.000Z", xp: 500, ref: "tables:8" },
  ];
  assert.equal(raceXp(activity, "2026-09-25", TZ), 75);
  assert.equal(raceXp(activity, "2026-09-26", TZ), 0);
});

test("race XP stops counting at the cap, and the race closes at 9:30 pm", () => {
  const long = ["quest:review", "math:place-value", "drill:vocab:mixed"].map((ref) => ({
    at: "2026-09-25T15:00:00.000Z",
    xp: 4000,
    ref,
  }));
  assert.equal(RACE_CAP, 10000);
  assert.equal(raceXp(long, "2026-09-25", TZ), RACE_CAP);
  assert.equal(raceXp(long.slice(0, 2), "2026-09-25", TZ), 8000, "under the cap counts in full");
  assert.equal(raceClosed(new Date("2026-09-26T02:29:00.000Z"), TZ), false); // 21:29
  assert.equal(raceClosed(new Date("2026-09-26T02:30:00.000Z"), TZ), true); // 21:30
});

test("past two of the same kind, the rest count half: the two biggest stay full", () => {
  const at = (h: number) => `2026-09-25T${String(h).padStart(2, "0")}:00:00.000Z`;
  const drills = [
    { at: at(18), xp: 100, ref: "drill:math:place-value:quick" },
    { at: at(15), xp: 100, ref: "drill:math:place-value:t60#9" },
    { at: at(16), xp: 100, ref: "drill:math:place-value:quick" },
    { at: at(17), xp: 100, ref: "drill:math:place-value:relaxed" },
  ];
  assert.equal(raceXp(drills, "2026-09-25", TZ), 300); // 2 full + 2 half
  // 100 + 60 full, then 40 / 2 — whatever order they were played in.
  const uneven = [
    { at: at(17), xp: 100, ref: "tables:7" },
    { at: at(15), xp: 40, ref: "tables:3" },
    { at: at(16), xp: 60, ref: "tables:lightning" },
  ];
  assert.equal(raceXp(uneven, "2026-09-25", TZ), 180);
});

test("a session that arrives late never takes race points away", () => {
  const at = (h: number) => `2026-09-25T${String(h).padStart(2, "0")}:00:00.000Z`;
  const two = [
    { at: at(16), xp: 200, ref: "drill:math:fractions:relaxed" },
    { at: at(17), xp: 200, ref: "drill:math:fractions:quick" },
  ];
  const before = raceXp(two, "2026-09-25", TZ);
  // Played earlier offline, sent after: it is the one that counts half.
  const after = raceXp([...two, { at: at(15), xp: 30, ref: "drill:math:fractions:relaxed" }], "2026-09-25", TZ);
  assert.equal(before, 400);
  assert.equal(after, 415);
});

test("mixing kinds counts every session in full", () => {
  const refs = [
    "quest:review",
    "quest:new",
    "read:abc@2026-09-25T10:00:00.000Z",
    "read:structure",
    "math:place-value",
    "drill:math:rounding:quick",
    "drill:vocab:mixed",
    "tables:7",
    "abc123:spell",
  ];
  const mixed = refs.map((ref) => ({ at: "2026-09-25T15:00:00.000Z", xp: 50, ref }));
  assert.equal(raceXp(mixed, "2026-09-25", TZ), 50 * refs.length);
});

test("the cap applies after the halving", () => {
  const same = Array.from({ length: 6 }, () => ({
    at: "2026-09-25T15:00:00.000Z",
    xp: 3000,
    ref: "drill:vocab:mixed",
  }));
  // 3000 + 3000 + 4 x 1500 = 12000, capped.
  assert.equal(raceXp(same, "2026-09-25", TZ), RACE_CAP);
  // 3000 + 3000 + 1500 = 7500: under the cap, and not 9000.
  assert.equal(raceXp(same.slice(0, 3), "2026-09-25", TZ), 7500);
});

test("activity kinds group by what he is learning", () => {
  assert.equal(activityKind("quest:review"), "quest:review");
  assert.notEqual(activityKind("quest:review"), activityKind("quest:new"));
  assert.equal(activityKind("read:a@1"), activityKind("read:b@2"));
  assert.equal(activityKind("abc:read"), activityKind("read:a@1"));
  assert.notEqual(activityKind("read:structure"), activityKind("read:a@1"));
  // A math skill is its own thing, and so is each type of word drill.
  assert.notEqual(activityKind("math:place-value"), activityKind("math:fractions"));
  assert.equal(activityKind("math:place-value"), activityKind("math:place-value"));
  assert.notEqual(activityKind("math:place-value"), activityKind("drill:math:place-value:quick"));
  assert.equal(activityKind("drill:math:angles:t60#12"), activityKind("drill:math:angles:relaxed"));
  assert.notEqual(activityKind("drill:math:angles:relaxed"), activityKind("drill:math:fractions:relaxed"));
  assert.notEqual(activityKind("drill:vocab:mixed"), activityKind("drill:vocab:spell"));
  assert.equal(activityKind("drill:vocab:spell"), activityKind("drill:vocab:spell"));
  assert.equal(activityKind("tables:7"), activityKind("tables:voice"));
  assert.equal(activityKind("abc:spell"), activityKind("def:spell"));
  assert.notEqual(activityKind("abc:spell"), activityKind("abc:match"));
});

test("the nudge cheers the leader and tells the other how far to go", () => {
  const nour = { name: "Nour", xp: 120 };
  const wissam = { name: "Wissam", xp: 80 };
  const rows = [nour, wissam];
  assert.equal(nudge(nour, rows), "Ahead by 40 pts. Keep it up!");
  assert.equal(nudge(wissam, rows), "40 pts to catch Nour!");
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

test("a long run through the suggested drills counts in full: each type and skill is its own kind", () => {
  const refs = [
    "drill:vocab:match",
    "drill:math:angles:relaxed",
    "drill:vocab:listen",
    "drill:math:fractions:relaxed",
    "drill:vocab:spell",
    "drill:math:decimals:relaxed",
    "drill:vocab:use",
    "drill:math:rounding:relaxed",
  ];
  const run = refs.map((ref, i) => ({ at: `2026-09-25T1${i}:00:00.000Z`, xp: 100, ref }));
  assert.equal(raceXp(run, "2026-09-25", TZ), 800);
});
