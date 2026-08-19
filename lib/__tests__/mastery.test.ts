import assert from "node:assert/strict";
import test from "node:test";

import {
  countKnowledge,
  countKnown,
  dueSkills,
  newSkillState,
  scheduleSkill,
  skillDue,
  skillGapDays,
  wordKnowledge,
} from "@/lib/mastery";
import { SKILL_IDS, type ClientWord, type SkillState } from "@/lib/models/WordList";
import { applyReading, emptyProfile, nextReadingLevel } from "@/lib/rewards";
import type { ProfileState, ReadingLog } from "@/lib/types";

const NOW = new Date("2026-08-19T10:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

function word(over: Partial<ClientWord> = {}): ClientWord {
  return {
    word: "brave",
    clue: "not scared",
    arabic: "",
    explanation: "",
    examples: [],
    family: [],
    srs: {
      interval: 0,
      dueAt: NOW.toISOString(),
      lastReviewed: null,
      reviewCount: 0,
      easyCount: 0,
      hardCount: 0,
    },
    skills: {
      recognize: newSkillState(NOW),
      listen: newSkillState(NOW),
      spell: newSkillState(NOW),
      use: newSkillState(NOW),
    },
    ...over,
  };
}

function withStreaks(streak: number, interval = 0): ClientWord {
  const skills = {} as ClientWord["skills"];
  for (const id of SKILL_IDS) {
    skills[id] = { ...newSkillState(NOW), streak, correct: streak };
  }
  return word({ skills, srs: { ...word().srs, interval, reviewCount: streak } });
}

// ── scheduleSkill ─────────────────────────────────────────────────────────

test("right answers walk the 1/3/7/16/35/90 day ladder", () => {
  const gaps = [1, 3, 7, 16, 35, 90];
  let s: SkillState = newSkillState(NOW);
  for (let i = 0; i < gaps.length; i++) {
    s = scheduleSkill(s, true, NOW);
    assert.equal(s.streak, i + 1);
    assert.equal(new Date(s.dueAt).getTime(), NOW.getTime() + gaps[i] * DAY);
  }
  assert.equal(s.correct, gaps.length);
});

test("the review gap stops growing at 90 days", () => {
  assert.equal(skillGapDays(6), 90);
  assert.equal(skillGapDays(12), 90);
  const s = scheduleSkill({ ...newSkillState(NOW), streak: 20 }, true, NOW);
  assert.equal(new Date(s.dueAt).getTime(), NOW.getTime() + 90 * DAY);
});

test("a wrong answer resets the streak and makes the word due now", () => {
  const s = scheduleSkill({ ...newSkillState(NOW), streak: 4, correct: 4 }, false, NOW);
  assert.equal(s.streak, 0);
  assert.equal(s.wrong, 1);
  assert.equal(s.correct, 4);
  assert.equal(s.dueAt, NOW.toISOString());
  assert.equal(skillDue(s, NOW), true);
});

// ── wordKnowledge ─────────────────────────────────────────────────────────

test("an untouched word is new", () => {
  assert.equal(wordKnowledge(word()), "new");
});

test("one answer makes a word learning", () => {
  const w = word();
  w.skills.spell = scheduleSkill(w.skills.spell, true, NOW);
  assert.equal(wordKnowledge(w), "learning");
});

test("known needs 4 streaks of 3, a produced answer and a week of SRS", () => {
  // Streaks are there but the SRS interval has not reached a week.
  assert.equal(wordKnowledge(withStreaks(3, 2)), "learning");
  assert.equal(wordKnowledge(withStreaks(3, 7)), "known");
  assert.equal(wordKnowledge(withStreaks(2, 30)), "learning");
});

test("known needs the word produced, not just recognised", () => {
  const w = withStreaks(3, 7);
  w.skills.spell.correct = 0;
  w.skills.use.correct = 0;
  assert.equal(wordKnowledge(w), "learning");
  w.skills.use.correct = 1;
  assert.equal(wordKnowledge(w), "known");
});

test("mastered needs 4 streaks of 4 and a 16 day interval", () => {
  assert.equal(wordKnowledge(withStreaks(4, 7)), "known");
  assert.equal(wordKnowledge(withStreaks(3, 16)), "known");
  assert.equal(wordKnowledge(withStreaks(4, 16)), "mastered");
});

test("counts split the list and words known covers known + mastered", () => {
  const words = [word(), withStreaks(1), withStreaks(3, 7), withStreaks(4, 16)];
  assert.deepEqual(countKnowledge(words), {
    new: 1,
    learning: 1,
    known: 1,
    mastered: 1,
  });
  assert.equal(countKnown(words), 2);
});

test("dueSkills lists what is ready, weakest first", () => {
  const w = word();
  w.skills.recognize = scheduleSkill(w.skills.recognize, true, NOW); // due in 1 day
  w.skills.listen = { ...newSkillState(NOW), streak: 2 };
  assert.deepEqual(dueSkills(w, NOW), ["spell", "use", "listen"]);
});

// ── reading ladder ────────────────────────────────────────────────────────

function log(pct: number): ReadingLog {
  return { at: NOW.toISOString(), level: 1, pct, wordsCount: 60 };
}

test("three readings at 85%+ step the level up, capped at 10", () => {
  assert.equal(nextReadingLevel(1, [log(90), log(88), log(86)]), 2);
  assert.equal(nextReadingLevel(10, [log(90), log(88), log(86)]), 10);
  assert.equal(nextReadingLevel(1, [log(90), log(88)]), 1);
  assert.equal(nextReadingLevel(1, [log(90), log(88), log(80)]), 1);
});

test("two readings under 70% step the level down, floor 1", () => {
  assert.equal(nextReadingLevel(4, [log(50), log(65)]), 3);
  assert.equal(nextReadingLevel(4, [log(50), log(75)]), 4);
  assert.equal(nextReadingLevel(1, [log(10), log(10)]), 1);
});

test("applyReading logs newest first and caps at 20", () => {
  let p: ProfileState = emptyProfile();
  for (let i = 0; i < 25; i++) {
    p = applyReading(p, { level: 1, pct: 70, wordsCount: i }, { at: NOW, today: "2026-08-19" });
  }
  assert.equal(p.reading.recent.length, 20);
  assert.equal(p.reading.recent[0].wordsCount, 24);
});

test("applyReading moves the level after three strong readings", () => {
  const now = { at: NOW, today: "2026-08-19" };
  let p: ProfileState = emptyProfile();
  p = applyReading(p, { level: 1, pct: 90, wordsCount: 60 }, now);
  p = applyReading(p, { level: 1, pct: 92, wordsCount: 60 }, now);
  assert.equal(p.reading.level, 1);
  p = applyReading(p, { level: 1, pct: 88, wordsCount: 60, wpm: 92 }, now);
  assert.equal(p.reading.level, 2);
  assert.equal(p.reading.recent[0].wpm, 92);
  p = applyReading(p, { level: 2, pct: 40, wordsCount: 60 }, now);
  p = applyReading(p, { level: 2, pct: 55, wordsCount: 60 }, now);
  assert.equal(p.reading.level, 1);
});
