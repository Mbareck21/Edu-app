import assert from "node:assert/strict";
import test from "node:test";

import { isStuckMiss, newSkillState, scheduleSkill, settledStuck } from "@/lib/mastery";
import { SKILL_IDS, type SkillState, type WordSkills } from "@/lib/models/WordList";
import { dueAfterDays } from "@/lib/spacing";
import { ACTIVE_STUCK, CHAIN_TARGET, newChain, splitStuck, type ChainState } from "@/lib/spell-chain";

const NOW = "2026-09-27T18:00:00.000Z";
const DAY = 24 * 60 * 60 * 1000;

function finished(word: string, dueAt: string): ChainState {
  return { ...newChain(word), current: CHAIN_TARGET, best: CHAIN_TARGET, graduatedAt: NOW, dueAt };
}

test("only the newest unfinished words are worked on; the older ones wait", () => {
  const words = Array.from({ length: 30 }, (_, i) => `w${i}`);
  const later = new Date(Date.parse(NOW) + 3 * DAY).toISOString();
  const chains: Record<string, ChainState> = {
    w0: finished("w0", later), // finished, not due
    w1: finished("w1", NOW), // finished, check due now
  };
  const { working, waiting, finished: done } = splitStuck(words, chains, NOW);
  assert.deepEqual(done, ["w0"]);
  // 28 unfinished (w2..w29): the newest 20 work, the oldest 8 wait.
  assert.equal(waiting.length, 28 - ACTIVE_STUCK);
  assert.deepEqual(waiting, ["w2", "w3", "w4", "w5", "w6", "w7", "w8", "w9"]);
  assert.equal(working[0], "w1", "a due re-check is never held back");
  assert.equal(working.length, 1 + ACTIVE_STUCK);
  assert.ok(working.includes("w29"));
});

test("a short pool has nothing waiting", () => {
  const { working, waiting } = splitStuck(["a", "b"], {}, NOW);
  assert.deepEqual(working, ["a", "b"]);
  assert.deepEqual(waiting, []);
});

function skills(state: SkillState): WordSkills {
  return Object.fromEntries(SKILL_IDS.map((id) => [id, { ...state }])) as unknown as WordSkills;
}

test("a stuck word leaves the pool once its unit copy is known again", () => {
  // Stuck: two misses in a row on a skill that was due.
  let t = new Date(NOW);
  let s = scheduleSkill(newSkillState(t), false, t);
  assert.ok(isStuckMiss(s, false, t));
  s = scheduleSkill(s, false, t);
  assert.equal(s.streak, 0);
  const stuck = [{ word: "fifty", skills: skills(s) }];
  assert.deepEqual(settledStuck(["fifty"], stuck), []);

  // Right the same afternoon again and again: streak holds, still in the pool.
  s = scheduleSkill(s, true, t);
  for (let i = 0; i < 5; i++) s = scheduleSkill(s, true, t);
  assert.deepEqual(settledStuck(["fifty"], [{ word: "fifty", skills: skills(s) }]), []);

  // Right each time it falls due: three separate review windows.
  for (let i = 0; i < 2; i++) {
    t = new Date(s.dueAt);
    s = scheduleSkill(s, true, t);
  }
  assert.equal(s.streak, 3);
  const fixed = [{ word: "fifty", skills: skills(s) }];
  assert.deepEqual(settledStuck(["fifty", "thirty"], fixed), ["fifty"]);
});

test("a word on no unit list, or not known there, stays", () => {
  const far = dueAfterDays(new Date(NOW), 30).toISOString();
  const strong: SkillState = { correct: 5, wrong: 0, streak: 3, lastAt: NOW, dueAt: far };
  const shaky: WordSkills = { ...skills(strong), spell: { ...strong, streak: 1 } };
  assert.deepEqual(settledStuck(["eighty"], [{ word: "forty", skills: skills(strong) }]), []);
  assert.deepEqual(settledStuck(["forty"], [{ word: "forty", skills: shaky }]), []);
  assert.deepEqual(settledStuck(["forty"], [{ word: "Forty ", skills: skills(strong) }]), ["forty"]);
});
