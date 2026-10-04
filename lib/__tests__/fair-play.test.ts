// The fair-play rules (lib/rewards.ts): XP follows learning, never a pattern
// that farms it. Variety, correctness and pace, each on its own.

import assert from "node:assert/strict";
import test from "node:test";

import {
  BONUS_MIN_PCT,
  FULL_PAY_PCT,
  MAX_READ_WPM,
  PACE_CAP,
  XP,
  accuracyFactor,
  applySession,
  emptyProfile,
  estimateXp,
  readTooFast,
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
  assert.equal(rightXp(5), Math.round(5 * perRight * accuracyFactor(50)) + XP.lessonDone);
  // 4 of 10 is under BONUS_MIN_PCT: the answers only.
  assert.ok(BONUS_MIN_PCT === 50);
  assert.equal(rightXp(4), Math.round(4 * perRight * accuracyFactor(40)));
});

// ── 4. Accuracy: pay slides with the share right ──────────────────────────

test("accuracy: from every answer wrong to every one right, pay only ever rises", () => {
  const pay = (n: number) => applySession(emptyProfile(), drill({ correct: n, perfect: n === 10 }), at(15)).gained.xp - XP.streakDay;
  const xp = Array.from({ length: 11 }, (_, n) => pay(n));
  for (let n = 1; n <= 10; n++) assert.ok(xp[n] >= xp[n - 1], `${n} right paid less than ${n - 1}: ${xp}`);
  // Every answer wrong pays the finish only; every one right pays the most.
  assert.equal(xp[0], XP.finished);
  assert.equal(Math.max(...xp), xp[10]);
  assert.ok(xp[10] > xp[9] && xp[9] > xp[5] && xp[5] > xp[2]);
});

test("accuracy: 3 of 4 right pays each answer in full, fewer pays each one less", () => {
  assert.equal(FULL_PAY_PCT, 75);
  assert.equal(accuracyFactor(100), 1);
  assert.equal(accuracyFactor(75), 1);
  assert.equal(accuracyFactor(50), 50 / 75);
  assert.equal(accuracyFactor(0), 0);
  // 8 of 10 in a drill: each right answer in full, as before.
  const [eight] = play([drill({ correct: 8 })]);
  assert.equal(eight, 8 * XP.mathCorrect + XP.lessonDone + XP.streakDay);
});

test("accuracy: a reading pays by how many he got right, and 5 XP with all of them wrong", () => {
  const reading = (correct: number): SessionResult => ({
    kind: "reading",
    ref: "read:l1@2026-09-28T10:00:00.000Z",
    answered: 4,
    correct,
    fastCount: 0,
    ms: 8 * 60_000,
    perfect: correct === 4,
    reading: { level: 4, pct: correct * 25, wordsCount: 200 },
  });
  const xp = [0, 1, 2, 3, 4].map((n) => play([reading(n)])[0] - XP.streakDay);
  assert.deepEqual(xp, [5, 50, 220, 470, 650]);
});

test("accuracy: guessing pays a fraction of what careful work pays, in any section", () => {
  // A four-choice reading tapped at random gets about one in four right.
  const careful = applySession(emptyProfile(), drill({ correct: 10, perfect: true }), at(15)).gained.xp;
  const guessed = applySession(emptyProfile(), drill({ correct: 3 }), at(15)).gained.xp;
  assert.ok(guessed - XP.streakDay < (careful - XP.streakDay) / 8, `guessed ${guessed}, careful ${careful}`);
  // A timed drill sprayed with guesses: 80 answers, 20 right, in a minute.
  const timed = (answered: number, correct: number) =>
    applySession(
      emptyProfile(),
      drill({ ref: "drill:math:fractions:t60#x", timed: true, answered, correct, ms: 60_000 }),
      at(15)
    ).gained.xp - XP.streakDay;
  assert.ok(timed(80, 20) < timed(20, 20) / 3, `sprayed ${timed(80, 20)}, honest ${timed(20, 20)}`);
});

test("accuracy: the 5 XP for finishing needs a real session, not one or two taps", () => {
  const [one] = play([drill({ answered: 1, correct: 0 })]);
  assert.equal(one, XP.streakDay, "one wrong answer: only the day");
  const [three] = play([drill({ answered: 3, correct: 0 })]);
  assert.equal(three, XP.finished + XP.streakDay);
  assert.equal(estimateXp(drill({ answered: 3, correct: 0 })), XP.finished);
});

test("accuracy: the finish screen says why a so-so run paid less", () => {
  const tip = applySession(emptyProfile(), drill({ correct: 6 }), at(15)).gained.tip;
  assert.equal(tip, "Get 3 out of 4 right for full XP on every answer.");
  assert.equal(applySession(emptyProfile(), drill({ correct: 8 }), at(15)).gained.tip, undefined);
});

// ── A passage finished faster than it can be read ─────────────────────────

test("a passage finished faster than it can be read does not count as a reading", () => {
  const passage = (ms: number): SessionResult => ({
    kind: "reading",
    ref: "read:l1@2026-09-28T10:00:00.000Z",
    answered: 4,
    correct: 0,
    fastCount: 0,
    ms,
    perfect: false,
    reading: { level: 4, pct: 0, wordsCount: 300 },
  });
  // 300 words at MAX_READ_WPM is a minute.
  assert.equal(MAX_READ_WPM, 300);
  assert.equal(readTooFast(passage(59_000)), true);
  assert.equal(readTooFast(passage(61_000)), false);
  assert.equal(readTooFast(passage(0)), false, "no time is not too fast");
  assert.equal(readTooFast({ ms: 5_000 }), false, "not a passage");
  const skimmed = applySession(emptyProfile(), passage(20_000), at(15)).gained;
  assert.equal(skimmed.tip, "Read the whole story first: a reading that fast does not count.");
  assert.equal(skimmed.xp, XP.finished + XP.streakDay);

  // Two good readings at level 4; a third, guessed right but skimmed, would
  // have stepped him up to 5 (and found the Book Buddy badge).
  const good = { level: 4, pct: 100, wordsCount: 300 };
  const start: ProfileState = {
    ...emptyProfile(),
    reading: {
      level: 4,
      since: "2026-09-27T10:00:00.000Z",
      recent: [
        { at: "2026-09-28T09:00:00.000Z", ...good },
        { at: "2026-09-27T12:00:00.000Z", ...good },
      ],
    },
  };
  const lucky = (ms: number): SessionResult => ({ ...passage(ms), correct: 4, perfect: true, reading: good });
  const badgesOf = (ms: number) => applySession(start, lucky(ms), at(15)).gained.newBadges.map((b) => b.id);
  assert.ok(!badgesOf(20_000).includes("reading-5"), "skimmed: no level, no badge");
  assert.ok(badgesOf(5 * 60_000).includes("reading-5"), "read: up a level");
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
