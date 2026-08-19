import assert from "node:assert/strict";
import test from "node:test";

import {
  bestDrillScore,
  mathDrillRef,
  parseLength,
  parseSource,
  sourceParam,
  vocabHref,
} from "@/components/drill/options";
import {
  buildDrillItems,
  isDue,
  isWeak,
  modeSkill,
  pickWords,
  sourceCounts,
  type DrillList,
} from "@/components/drill/picks";
import { mulberry32 } from "@/lib/math/rng";
import type { ClientWord, SkillState, WordSkills } from "@/lib/models/WordList";

const NOW = new Date("2026-08-19T10:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

function skill(overrides: Partial<SkillState> = {}): SkillState {
  return { correct: 0, wrong: 0, streak: 0, lastAt: null, dueAt: NOW.toISOString(), ...overrides };
}

function skills(overrides: Partial<Record<keyof WordSkills, Partial<SkillState>>> = {}): WordSkills {
  return {
    recognize: skill(overrides.recognize),
    listen: skill(overrides.listen),
    spell: skill(overrides.spell),
    use: skill(overrides.use),
  };
}

function word(name: string, overrides: Partial<ClientWord> = {}): ClientWord {
  return {
    word: name,
    clue: `${name} clue`,
    arabic: "كلمة",
    explanation: `to ${name} something`,
    examples: [`He likes to ${name} at school.`, `We ${name} every day.`],
    family: [],
    srs: {
      interval: 0,
      dueAt: NOW.toISOString(),
      lastReviewed: null,
      reviewCount: 0,
      easyCount: 0,
      hardCount: 0,
    },
    skills: skills(),
    ...overrides,
  };
}

/** Everything strong and scheduled far out: not weak, not due. */
function strong(name: string): ClientWord {
  const far = new Date(NOW.getTime() + 30 * DAY).toISOString();
  return word(name, {
    skills: skills({
      recognize: { streak: 4, dueAt: far },
      listen: { streak: 4, dueAt: far },
      spell: { streak: 4, dueAt: far },
      use: { streak: 4, dueAt: far },
    }),
  });
}

function lists(): DrillList[] {
  return [
    { listId: "a", name: "Unit 1", words: [word("melt"), word("float"), strong("solid")] },
    { listId: "b", name: "Unit 2", words: [strong("layer")] },
  ];
}

test("source params round-trip", () => {
  assert.deepEqual(parseSource("all"), { kind: "all" });
  assert.deepEqual(parseSource("weak"), { kind: "weak" });
  assert.deepEqual(parseSource("list:abc"), { kind: "list", listId: "abc" });
  assert.deepEqual(parseSource("list:"), { kind: "all" });
  assert.deepEqual(parseSource(undefined), { kind: "all" });
  assert.equal(sourceParam({ kind: "list", listId: "abc" }), "list:abc");
});

test("length falls back to 10", () => {
  assert.equal(parseLength("20"), 20);
  assert.equal(parseLength("40"), 40);
  assert.equal(parseLength("15"), 10);
  assert.equal(parseLength(undefined), 10);
});

test("the again href carries the settings but no seed", () => {
  const href = vocabHref({ source: { kind: "weak" }, mode: "spell", count: 20 });
  assert.equal(href, "/drill/vocab?src=weak&mode=spell&n=20");
});

test("timed refs carry the score, relaxed refs do not", () => {
  assert.equal(mathDrillRef("mul-facts", "relaxed", 8), "drill:math:mul-facts:relaxed");
  assert.equal(mathDrillRef("mul-facts", "t60", 14), "drill:math:mul-facts:t60#14");
});

test("best score reads counts for timed and percents for relaxed", () => {
  const activity = [
    { ref: "drill:math:mul-facts:t60#14", pct: 90 },
    { ref: "drill:math:mul-facts:t60#9", pct: 100 },
    { ref: "drill:math:mul-facts:relaxed", pct: 70 },
    { ref: "drill:math:division:t60#40", pct: 50 },
    { ref: "quest:review", pct: 100 },
  ];
  assert.equal(bestDrillScore(activity, "mul-facts", "t60"), 14);
  assert.equal(bestDrillScore(activity, "mul-facts", "relaxed"), 70);
  assert.equal(bestDrillScore(activity, "mul-facts", "t120"), null);
  assert.equal(bestDrillScore(activity, "fractions", "t60"), null);
});

test("weak and due read the skill states", () => {
  assert.equal(isWeak(word("melt")), true);
  assert.equal(isWeak(strong("solid")), false);
  assert.equal(isDue(word("melt"), NOW), true);
  assert.equal(isDue(strong("solid"), NOW), false);
});

test("source counts add up per chip", () => {
  const counts = sourceCounts(lists(), NOW);
  assert.equal(counts.all, 4);
  assert.equal(counts.weak, 2);
  assert.equal(counts.due, 2);
  assert.deepEqual(
    counts.lists.map((l) => l.count),
    [3, 1]
  );
});

test("pickWords filters by source", () => {
  const all = pickWords(lists(), { kind: "all" }, NOW);
  assert.equal(all.length, 4);
  assert.equal(pickWords(lists(), { kind: "weak" }, NOW).length, 2);
  assert.equal(pickWords(lists(), { kind: "due" }, NOW).length, 2);
  const one = pickWords(lists(), { kind: "list", listId: "b" }, NOW);
  assert.equal(one.length, 1);
  assert.equal(one[0].pool.listId, "b");
});

test("modeSkill maps the single-skill modes", () => {
  assert.equal(modeSkill("match"), "recognize");
  assert.equal(modeSkill("write"), "spell");
  assert.equal(modeSkill("mixed"), null);
  assert.equal(modeSkill("flashcards"), null);
});

test("a drill has exactly the asked-for number of items, never two in a row on one word", () => {
  const picked = pickWords(lists(), { kind: "all" }, NOW);
  const items = buildDrillItems({
    picked,
    mode: "mixed",
    count: 20,
    now: NOW,
    rng: mulberry32(7),
  });
  assert.equal(items.length, 20);
  for (let i = 1; i < items.length; i++) {
    assert.notEqual(items[i].word, items[i - 1].word);
  }
});

test("the spelling test is typed dictation for every item", () => {
  const picked = pickWords(lists(), { kind: "all" }, NOW);
  const items = buildDrillItems({
    picked,
    mode: "write",
    count: 10,
    now: NOW,
    rng: mulberry32(3),
  });
  assert.equal(items.length, 10);
  assert.ok(items.every((i) => i.kind === "write"));
  assert.ok(items.every((i) => i.skill === "spell"));
});

test("a mixed drill works more than one skill", () => {
  const picked = pickWords(lists(), { kind: "all" }, NOW);
  const items = buildDrillItems({
    picked,
    mode: "mixed",
    count: 12,
    now: NOW,
    rng: mulberry32(11),
  });
  assert.ok(new Set(items.map((i) => i.skill)).size > 1);
});

test("no words means no items", () => {
  assert.deepEqual(
    buildDrillItems({ picked: [], mode: "match", count: 10, now: NOW, rng: mulberry32(1) }),
    []
  );
});

test("same seed builds the same drill", () => {
  const picked = pickWords(lists(), { kind: "all" }, NOW);
  const a = buildDrillItems({ picked, mode: "listen", count: 10, now: NOW, rng: mulberry32(5) });
  const b = buildDrillItems({ picked, mode: "listen", count: 10, now: NOW, rng: mulberry32(5) });
  assert.deepEqual(
    a.map((i) => `${i.kind}:${i.word}`),
    b.map((i) => `${i.kind}:${i.word}`)
  );
});
