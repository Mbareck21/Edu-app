// The fair-play rules (lib/rewards.ts): XP follows learning, never a pattern
// that farms it. Variety, correctness and pace, each on its own.

import assert from "node:assert/strict";
import test from "node:test";

import {
  BONUS_MIN_PCT,
  PACE_CAP,
  XP,
  applySession,
  emptyProfile,
  varietyFactor,
} from "@/lib/rewards";
import { nudge, questLeft, raceXp, winXp } from "@/lib/scoreboard";
import type { ProfileState, SessionKind, SessionResult } from "@/lib/types";

const DAY = "2026-09-28";
const at = (h: number, m = 0) => ({
  at: new Date(`${DAY}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00.000Z`),
  today: DAY,
});

function drill(over: Partial<SessionResult> = {}): SessionResult {
  return {
    kind: "math",
    ref: "drill:math:fractions:relaxed",
    answered: 10,
    correct: 10,
    fastCount: 0,
    ms: 3 * 60_000,
    perfect: false,
    mathLevel: 1,
    ...over,
  };
}

/** Play `results` in order on one profile; the XP each one paid. */
function play(results: SessionResult[], start: ProfileState = emptyProfile()): number[] {
  let p = start;
  return results.map((r, i) => {
    const out = applySession(p, r, at(15, i));
    p = out.profile;
    return out.gained.xp;
  });
}

// ── 1. Variety ────────────────────────────────────────────────────────────

test("variety: the 3rd and 4th of the same kind pay half, the 5th on a quarter", () => {
  assert.deepEqual([0, 1, 2, 3, 4, 9].map((n) => varietyFactor(n)), [1, 1, 0.5, 0.5, 0.25, 0.25]);
  const xp = play(Array.from({ length: 6 }, () => drill()));
  const full = xp[1];
  assert.equal(xp[2], Math.round(full / 2));
  assert.equal(xp[3], Math.round(full / 2));
  assert.equal(xp[4], Math.round(full / 4));
  assert.equal(xp[5], Math.round(full / 4));
});

test("variety: turning through skills and drill types pays every session in full", () => {
  const refs = [
    "drill:math:fractions:relaxed",
    "drill:math:angles:relaxed",
    "drill:math:decimals:relaxed",
    "drill:math:shapes:relaxed",
  ];
  const xp = play(refs.map((ref) => drill({ ref })));
  assert.ok(xp.slice(1).every((x) => x === xp[1]), `all full: ${xp}`);
});

test("variety: a new day starts every kind fresh", () => {
  let p = emptyProfile();
  for (let i = 0; i < 4; i++) p = applySession(p, drill(), at(15, i)).profile;
  const tomorrow = { at: new Date("2026-09-29T15:00:00.000Z"), today: "2026-09-29" };
  const fresh = applySession(p, drill(), tomorrow).gained.xp;
  const firstEver = applySession(emptyProfile(), drill(), tomorrow).gained.xp;
  assert.equal(fresh, firstEver - XP.streakDay + XP.streakDay, "full pay again");
});

test("variety: learning bonuses are never cut — a word reaching known pays in full", () => {
  const words = (known: number): SessionResult => ({
    kind: "vocab",
    ref: "drill:vocab:spell",
    answered: 10,
    correct: 10,
    fastCount: 0,
    ms: 3 * 60_000,
    perfect: false,
    wordsKnownUp: known,
  });
  const plain = play([words(0), words(0), words(0), words(0), words(0)]);
  const withKnown = play([words(0), words(0), words(0), words(0), words(2)]);
  assert.equal(withKnown[4] - plain[4], 2 * XP.wordKnown);
});

test("variety: the race adds the XP as paid, so a third session is not halved twice", () => {
  const xp = play([drill(), drill(), drill()]);
  const activity = xp.map((x, i) => ({ at: at(15, i).at.toISOString(), xp: x, ref: "drill:math:fractions:relaxed" }));
  assert.equal(raceXp(activity, DAY, "UTC"), xp[0] + xp[1] + xp[2]);
});

// ── 2. Correctness ────────────────────────────────────────────────────────

test("correctness: only right answers pay", () => {
  const [all] = play([drill({ correct: 10 })]);
  const [half] = play([drill({ correct: 5 })]);
  const [none] = play([drill({ correct: 0 })]);
  assert.ok(all > half && half > none);
});

test("correctness: tapping through (under half right) earns no lesson bonus", () => {
  const rightXp = (n: number) =>
    applySession(emptyProfile(), drill({ correct: n }), at(15)).gained.xp - XP.streakDay;
  const perRight = XP.mathCorrect;
  // 5 of 10 is a real attempt: the answers and the bonus.
  assert.equal(rightXp(5), Math.round(5 * perRight) + XP.lessonDone);
  // 4 of 10 is under BONUS_MIN_PCT: the answers only.
  assert.ok(BONUS_MIN_PCT === 50);
  assert.equal(rightXp(4), Math.round(4 * perRight));
});

test("correctness: a perfect run earns the perfect bonus, nine of ten does not", () => {
  const perfect = applySession(emptyProfile(), drill({ perfect: true }), at(15)).gained.xp;
  const nine = applySession(emptyProfile(), drill({ correct: 9, perfect: true }), at(15)).gained.xp;
  assert.equal(perfect - nine, XP.mathCorrect + XP.perfect);
});

// ── 3. Pace: no pattern farming ───────────────────────────────────────────

test("pace: memorised Text structure taps cannot out-earn reading it", () => {
  const structure = (ms: number): SessionResult => ({
    kind: "reading",
    ref: "read:structure",
    answered: 6,
    correct: 6,
    fastCount: 0,
    ms,
    perfect: true,
  });
  // 2026-09-27: 300 XP for 30 seconds, nine times. Now: the time it took.
  const [rushed] = play([structure(30_000)]);
  assert.ok(rushed <= Math.round(0.5 * PACE_CAP.reading) + XP.streakDay, `${rushed}`);
  // Read properly (about 5 minutes), it pays in full.
  const [read] = play([structure(5 * 60_000)]);
  assert.equal(read, 6 * XP.readingCorrect + XP.lessonDone + XP.perfect + XP.streakDay);
  // Nine memorised repeats in eight minutes: a fraction of what they paid.
  const farm = play([structure(5 * 60_000), ...Array.from({ length: 9 }, () => structure(40_000))]);
  const repeats = farm.slice(1).reduce((a, b) => a + b, 0);
  assert.ok(repeats < 2430 / 5, `nine repeats paid ${repeats}, was 2,430`);
});

test("pace: no session pays more work XP than its minutes allow, in any kind", () => {
  const fast: SessionResult[] = [
    { kind: "vocab", ref: "drill:vocab:match", answered: 20, correct: 20, fastCount: 20, ms: 20_000, perfect: true },
    drill({ answered: 20, correct: 20, ms: 15_000, perfect: true, mathLevel: 5 }),
    { kind: "reading", ref: "read:l1@x", answered: 4, correct: 4, fastCount: 0, ms: 30_000, perfect: true, reading: { level: 3, pct: 100, wordsCount: 300 } },
  ];
  for (const r of fast) {
    const xp = applySession(emptyProfile(), r, at(15)).gained.xp - XP.streakDay;
    assert.ok(xp <= Math.round((r.ms / 60_000) * PACE_CAP[r.kind]), `${r.ref}: ${xp}`);
  }
});

test("pace: real work on 2026-09-27 is not cut", () => {
  // The fastest honest sessions that day, from the activity log.
  const honest: SessionResult[] = [
    { kind: "vocab", ref: "drill:vocab:listen", answered: 10, correct: 10, fastCount: 5, ms: 42_000, perfect: true },
    drill({ ref: "drill:math:shapes:relaxed", answered: 10, correct: 10, ms: 36_000, mathLevel: 3 }),
    { kind: "reading", ref: "read:l1@y", answered: 4, correct: 3, fastCount: 0, ms: 150_000, perfect: false, reading: { level: 3, pct: 75, wordsCount: 300 } },
  ];
  for (const r of honest) {
    const capped = applySession(emptyProfile(), r, at(15)).gained.xp;
    const uncapped = applySession(emptyProfile(), { ...r, ms: 0 }, at(15)).gained.xp;
    assert.equal(capped, uncapped, r.ref);
  }
});

test("the finish screen says which rule cut the XP, so he learns the rules by playing", () => {
  let p = emptyProfile();
  const tips: (string | undefined)[] = [];
  for (let i = 0; i < 5; i++) {
    const out = applySession(p, drill(), at(15, i));
    tips.push(out.gained.tip);
    p = out.profile;
  }
  assert.deepEqual(tips.slice(0, 2), [undefined, undefined]);
  assert.match(tips[2] ?? "", /^3rd time today: half XP/);
  assert.match(tips[4] ?? "", /^5th time today: a quarter of the XP/);
  const rushed = applySession(emptyProfile(), drill({ ms: 5_000 }), at(15)).gained.tip;
  assert.equal(rushed, "Take your time: rushing earns less XP.");
  const guessed = applySession(emptyProfile(), drill({ correct: 2 }), at(15)).gained.tip;
  assert.equal(guessed, "Get at least half right to earn the finish bonus.");
});

// ── The day is won with the whole quest ───────────────────────────────────

test("a lesson or quest beat is full once a day: a repeat pays half, then a quarter", () => {
  const review: SessionResult = {
    kind: "vocab",
    ref: "quest:review",
    answered: 10,
    correct: 10,
    fastCount: 0,
    ms: 3 * 60_000,
    perfect: false,
  };
  const xp = play([review, review, review]);
  // The first carries the day's streak bonus; the repeats pay no lesson bonus.
  const repeat = 10 * XP.correct;
  assert.equal(xp[1], Math.round(repeat / 2));
  assert.equal(xp[2], Math.round(repeat / 4));
  // Drills stay full twice: the driver already turns through them.
  const d = play([drill(), drill()]);
  assert.equal(d[1], d[0] - XP.streakDay - XP.lessonDone);
});

test("nobody wins the day without the whole quest done by 9:30 pm", () => {
  const Q = ["quest:review", "read:abc@2026-09-28T10:00:00.000Z", "math:fractions", "quest:new", "read:structure", "quest:production"];
  const kindOf = (ref: string): SessionKind =>
    ref.startsWith("read:") ? "reading" : ref.startsWith("math:") ? "math" : "vocab";
  const log = (refs: string[], xp: number, hour = 15) =>
    refs.map((ref, i) => ({ at: `2026-09-28T${hour}:${String(i).padStart(2, "0")}:00.000Z`, kind: kindOf(ref), ref, xp }));
  const all = log(Q, 500);
  const five = log(Q.slice(0, 5), 1000);
  assert.equal(questLeft(all, "2026-09-28", "UTC"), 0);
  assert.equal(questLeft(five, "2026-09-28", "UTC"), 1);
  // Five beats and 5,000 points cannot win; the whole quest with 3,000 can.
  assert.equal(winXp(five, "2026-09-28", "UTC"), 0);
  assert.equal(winXp(all, "2026-09-28", "UTC"), 3000);
  // The whole quest alone, under MIN_WIN_PTS, is not in the race either.
  const questOnly = log(Q, 200);
  assert.equal(questLeft(questOnly, "2026-09-28", "UTC"), 0);
  assert.equal(winXp(questOnly, "2026-09-28", "UTC"), 0, "1,200 pts: drills needed to reach 1,700");
  // The last beat after 9:30 pm is too late.
  const late = [...five, ...log(Q.slice(5), 100, 22)];
  assert.equal(questLeft(late, "2026-09-28", "UTC"), 1);
  // Days before the rule are settled on points, as they were.
  const old = five.map((a) => ({ ...a, at: a.at.replace("2026-09-28", "2026-09-27") }));
  assert.equal(winXp(old, "2026-09-27", "UTC"), raceXp(old, "2026-09-27", "UTC"));
});

test("the nudge sends him to finish the quest, then to drill up to 1,700", () => {
  const nour = { name: "Nour", xp: 900, questLeft: 2 };
  const wissam = { name: "Wissam", xp: 1450, questLeft: 0 };
  assert.equal(nudge(nour, [nour, wissam]), "Finish today's quest to be in the race: 2 to go!");
  assert.equal(nudge(wissam, [nour, wissam]), "Quest done! 250 more pts to be in the race: try a drill!");
  wissam.xp = 2600;
  assert.equal(nudge(wissam, [nour, wissam]), "You're in the race! Keep it up.");
  nour.questLeft = 0;
  nour.xp = 3000;
  assert.equal(nudge(wissam, [nour, wissam]), "400 pts to catch Nour!");
});
