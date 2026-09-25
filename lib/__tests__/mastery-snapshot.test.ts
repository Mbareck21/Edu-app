import assert from "node:assert/strict";
import test from "node:test";

import { masterySnapshot } from "@/lib/mastery-snapshot";
import { MATH_SKILL_IDS } from "@/lib/math/skills";
import { newSkillState } from "@/lib/mastery";
import { SKILL_IDS, type ClientWord } from "@/lib/models/WordList";
import { BADGES, emptyProfile } from "@/lib/rewards";
import { TABLES, TABLE_UP_TO, allFactKeys, factKey, newFact, type FactState } from "@/lib/tables";
import type { MasterySnapshot, SessionResult } from "@/lib/types";

const NOW = new Date("2026-09-25T10:00:00.000Z");

function word(text: string, streak: number): ClientWord {
  const skills = {} as ClientWord["skills"];
  for (const id of SKILL_IDS) skills[id] = { ...newSkillState(NOW), streak, correct: streak };
  return {
    word: text,
    clue: "",
    arabic: "",
    explanation: "",
    examples: [],
    family: [],
    srs: { interval: 0, dueAt: NOW.toISOString(), lastReviewed: null, reviewCount: streak, easyCount: 0, hardCount: 0 },
    skills,
  };
}

function fact(key: string, streak: number, lastFast = false): FactState {
  const [a, b] = key.split("x").map(Number);
  return { ...newFact(a, b), streak, correct: streak, lastFast };
}

const empty: MasterySnapshot = {
  wordsKnown: 0,
  factsLit: 0,
  factsKnown: 0,
  factsGold: 0,
  tablesKnown: 0,
  mathLevels: MATH_SKILL_IDS.map(() => 1),
};

// ── snapshot ──────────────────────────────────────────────────────────────

test("words known count each word once, known or mastered only", () => {
  const snap = masterySnapshot({
    words: [word("brave", 3), word("Brave ", 0), word("calm", 5), word("new", 0), word("learning", 1)],
    facts: {},
    mathLevels: {},
  });
  assert.equal(snap.wordsKnown, 2);
});

test("the grid counts lit, known, gold and whole tables", () => {
  const facts: Record<string, FactState> = {};
  for (let b = 1; b <= TABLE_UP_TO; b++) facts[factKey(TABLES[0], b)] = fact(factKey(TABLES[0], b), 3, b === 1);
  facts[factKey(TABLES[1], 5)] = fact(factKey(TABLES[1], 5), 1);
  const snap = masterySnapshot({ words: [], facts, mathLevels: {} });
  assert.equal(snap.tablesKnown, 1);
  assert.equal(snap.factsKnown, TABLE_UP_TO);
  assert.equal(snap.factsLit, TABLE_UP_TO + 1);
  assert.equal(snap.factsGold, 1);
});

test("every math skill has a level, 1 when never played", () => {
  const snap = masterySnapshot({ words: [], facts: {}, mathLevels: { [MATH_SKILL_IDS[0]]: 4 } });
  assert.equal(snap.mathLevels.length, MATH_SKILL_IDS.length);
  assert.equal(snap.mathLevels[0], 4);
  assert.ok(snap.mathLevels.slice(1).every((l) => l === 1));
});

// ── set 3 badges ──────────────────────────────────────────────────────────

const badge = (id: string) => BADGES.find((b) => b.id === id)!;
const withMastery = (over: Partial<MasterySnapshot>): SessionResult => ({
  kind: "vocab",
  ref: "x",
  answered: 1,
  correct: 1,
  fastCount: 0,
  ms: 1000,
  perfect: true,
  mastery: { ...empty, ...over },
});

test("each set 3 badge fires at its threshold and not one below", () => {
  const p = emptyProfile();
  const grid = allFactKeys().length;
  const cases: [string, (n: number) => Partial<MasterySnapshot>, number][] = [
    ["words-25", (n) => ({ wordsKnown: n }), 25],
    ["words-50", (n) => ({ wordsKnown: n }), 50],
    ["words-100", (n) => ({ wordsKnown: n }), 100],
    ["table-one", (n) => ({ tablesKnown: n }), 1],
    ["grid-lit", (n) => ({ factsLit: n }), grid],
    ["grid-known", (n) => ({ factsKnown: n }), grid],
    ["grid-gold", (n) => ({ factsGold: n }), grid],
    ["math-level-5", (n) => ({ mathLevels: [...empty.mathLevels.slice(1), n] }), 5],
    ["math-all-3", (n) => ({ mathLevels: [...empty.mathLevels.slice(1).map(() => 3), n] }), 3],
  ];
  for (const [id, over, n] of cases) {
    assert.equal(badge(id).check(p, withMastery(over(n))), true, `${id} at ${n}`);
    assert.equal(badge(id).check(p, withMastery(over(n - 1))), false, `${id} at ${n - 1}`);
  }
  const at = (level: number) => ({ ...p, reading: { level, recent: [] } });
  assert.equal(badge("reading-8").check(at(8), withMastery({})), true);
  assert.equal(badge("reading-8").check(at(7), withMastery({})), false);
});

test("without a snapshot the mastery badges wait", () => {
  const { mastery: _drop, ...plain } = withMastery({});
  void _drop;
  for (const id of ["words-25", "table-one", "grid-lit", "grid-known", "grid-gold", "math-level-5", "math-all-3"]) {
    assert.equal(badge(id).check(emptyProfile(), plain), false, id);
  }
});
