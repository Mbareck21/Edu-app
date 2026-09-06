import assert from "node:assert/strict";
import { test } from "node:test";

import {
  FAST_MS,
  ROUND_SIZE,
  TABLES,
  TABLE_UP_TO,
  allFactKeys,
  applyFactAnswer,
  buildLightningRound,
  buildTableRound,
  factFromRow,
  factKey,
  isKnown,
  newFact,
  roundStars,
  tableProgress,
} from "@/lib/tables";
import { KNOWN_STREAK } from "@/lib/spacing";

const NOW = "2026-09-06T18:00:00.000Z";
const DAY = 24 * 60 * 60 * 1000;
const at = (d: number) => new Date(Date.parse(NOW) + d * DAY).toISOString();

function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test("7×8 and 8×7 are one fact", () => {
  assert.equal(factKey(7, 8), factKey(8, 7));
  assert.equal(factKey(9, 9), "9x9");
});

test("the grid is tables 2 to 9, ×1 to ×10, with no fact counted twice", () => {
  const keys = allFactKeys();
  assert.equal(new Set(keys).size, keys.length);
  assert.deepEqual(TABLES, [2, 3, 4, 5, 6, 7, 8, 9]);
  assert.equal(TABLE_UP_TO, 10);
  // 8 tables × 10 columns = 80 cells, but shared facts collapse: 2..9 pairs.
  assert.ok(keys.length < 80 && keys.length > 40);
});

test("a fact is known only after right answers on separate days", () => {
  // Same rule as words: a right answer before it is due is practice.
  let f = newFact(7, 8);
  f = applyFactAnswer(f, true, 1500, NOW);
  f = applyFactAnswer(f, true, 1500, NOW);
  f = applyFactAnswer(f, true, 1500, NOW);
  assert.equal(f.streak, 1, "three in one sitting is one step, not three");
  f = applyFactAnswer(f, true, 1500, at(1));
  f = applyFactAnswer(f, true, 1500, at(4));
  assert.equal(f.streak, KNOWN_STREAK);
  assert.ok(isKnown(f));
});

test("a miss zeroes the streak and brings the fact straight back", () => {
  let f = newFact(6, 7);
  f = applyFactAnswer(f, true, 1000, NOW);
  f = applyFactAnswer(f, true, 1000, at(1));
  f = applyFactAnswer(f, false, 1000, at(4));
  assert.equal(f.streak, 0);
  assert.equal(f.dueAt, at(4));
  assert.equal(f.lastFast, false, "a miss puts the gold out");
});

test("fast means under three seconds, and only the latest answer decides the gold", () => {
  let f = newFact(9, 9);
  f = applyFactAnswer(f, true, 800, NOW);
  assert.equal(f.lastFast, true);
  assert.equal(f.fast, 1);
  f = applyFactAnswer(f, true, FAST_MS + 1, at(1));
  assert.equal(f.lastFast, false, "slow this time, so not gold now");
  assert.equal(f.fast, 1, "but the count of fast answers is kept");
});

test("a round is the whole table, due and weak facts first, flipped at random", () => {
  const facts: Record<string, ReturnType<typeof newFact>> = {};
  // 7×3 is well known and not due; 7×8 was just missed.
  facts[factKey(7, 3)] = { ...newFact(7, 3), streak: 4, dueAt: at(30) };
  facts[factKey(7, 8)] = { ...newFact(7, 8), streak: 0, wrong: 1, dueAt: NOW };
  const round = buildTableRound(7, facts, NOW, seeded(3));
  assert.equal(round.length, TABLE_UP_TO);
  assert.equal(new Set(round.map((r) => r.key)).size, TABLE_UP_TO, "each fact once");
  assert.ok(round.every((r) => r.a === 7 || r.b === 7));
  assert.equal(round[round.length - 1].key, factKey(7, 3), "the strong fact goes last");
  assert.ok(round.findIndex((r) => r.key === factKey(7, 8)) < 5, "the missed fact comes early");
  // Over many seeds some facts appear the other way round.
  const flipped = Array.from({ length: 30 }, (_, i) => buildTableRound(7, facts, NOW, seeded(i + 1)))
    .flat()
    .some((r) => r.a !== 7);
  assert.ok(flipped, "7×8 must sometimes be asked as 8×7");
});

test("lightning draws from tables he has started, weakest first", () => {
  assert.deepEqual(buildLightningRound({}, NOW, seeded(1)), [], "nothing started, nothing asked");
  const facts: Record<string, ReturnType<typeof newFact>> = {};
  for (let b = 1; b <= 10; b++) facts[factKey(3, b)] = { ...newFact(3, b), streak: 4, dueAt: at(30) };
  // Missed once: a real miss must lead, ahead of facts he has never met.
  facts[factKey(8, 6)] = { ...newFact(8, 6), streak: 0, wrong: 1, dueAt: NOW };
  const round = buildLightningRound(facts, NOW, seeded(2));
  assert.equal(round.length, ROUND_SIZE);
  assert.equal(round[0].key, factKey(8, 6), "the missed fact from the 8s leads");
  assert.ok(round.some((r) => r.a === 8 || r.b === 8));
});

test("progress on a table counts known and fast facts", () => {
  const facts: Record<string, ReturnType<typeof newFact>> = {};
  facts[factKey(4, 4)] = { ...newFact(4, 4), streak: 3, lastFast: true };
  facts[factKey(4, 7)] = { ...newFact(4, 7), streak: 3, lastFast: false };
  facts[factKey(4, 9)] = { ...newFact(4, 9), streak: 1 };
  assert.deepEqual(tableProgress(4, facts), { table: 4, known: 2, fast: 1, total: 10 });
});

test("stars: all right for one, inside a minute for two, inside thirty seconds for three", () => {
  assert.equal(roundStars(9, 10, 10_000), 0, "speed counts for nothing until the answers do");
  assert.equal(roundStars(10, 10, 90_000), 1);
  assert.equal(roundStars(10, 10, 45_000), 2);
  assert.equal(roundStars(10, 10, 25_000), 3);
  assert.equal(roundStars(0, 0, 0), 0);
});

test("factFromRow tolerates an empty or partial row", () => {
  assert.deepEqual(factFromRow("7x8", null), newFact(7, 8));
  const f = factFromRow("7x8", { streak: 2, lastFast: true });
  assert.equal(f.streak, 2);
  assert.equal(f.lastFast, true);
  assert.equal(f.dueAt, null);
});
