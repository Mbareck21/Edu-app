import assert from "node:assert/strict";
import { test } from "node:test";

import { buildDigest } from "@/lib/digest";
import type { ClientWord, SkillState } from "@/lib/models/WordList";
import { newChain, type ChainState } from "@/lib/spell-chain";
import { newFact, type FactState } from "@/lib/tables";
import type { ActivityEntry } from "@/lib/types";

const now = new Date("2026-09-06T18:00:00Z");
const day = 24 * 60 * 60 * 1000;
const iso = (daysAgo: number) => new Date(now.getTime() - daysAgo * day).toISOString();

function skill(streak: number, lastAgo: number | null, dueIn: number): SkillState {
  return {
    correct: streak,
    wrong: 0,
    streak,
    lastAt: lastAgo === null ? null : iso(lastAgo),
    dueAt: new Date(now.getTime() + dueIn * day).toISOString(),
  };
}

function word(w: string, streak: number, lastAgo: number | null, dueIn = 5): ClientWord {
  const s = skill(streak, lastAgo, dueIn);
  return {
    word: w,
    clue: "",
    arabic: "",
    explanation: "",
    examples: [],
    family: [],
    srs: { interval: 0, dueAt: iso(0), lastReviewed: null, reviewCount: 0, easyCount: 0, hardCount: 0 },
    skills: { recognize: s, listen: s, spell: s, use: s },
  };
}

function session(kind: ActivityEntry["kind"], daysAgo: number, pct: number, ms: number): ActivityEntry {
  return { at: iso(daysAgo), kind, ref: "x", pct, xp: 0, ms };
}

test("sessions, minutes and accuracy count only this week", () => {
  const d = buildDigest({
    activity: [
      session("reading", 1, 80, 300_000),
      session("reading", 2, 60, 300_000),
      session("math", 3, 100, 120_000),
      session("vocab", 9, 50, 900_000),
    ],
    words: [],
    facts: [],
    chains: [],
    now,
  });
  assert.equal(d.sessions, 3);
  assert.equal(d.minutes, 12);
  assert.equal(d.byKind.reading.pct, 70);
  assert.equal(d.byKind.math.sessions, 1);
  assert.equal(d.byKind.vocab.pct, null);
});

test("words known this week need known status and recent practice", () => {
  const d = buildDigest({
    activity: [],
    words: [word("a", 4, 2), word("b", 4, 20), word("c", 1, 1)],
    facts: [],
    chains: [],
    now,
  });
  assert.equal(d.wordsKnownThisWeek, 1);
});

test("due tomorrow counts words, met facts and finished chains", () => {
  const dueWord = word("d", 2, 1, 0.5);
  const laterWord = word("e", 2, 1, 3);
  const met: FactState = { ...newFact(7, 8), correct: 1, dueAt: iso(-0.5), lastAt: iso(1) };
  const never = newFact(6, 7);
  const known: FactState = { ...newFact(2, 3), streak: 3, correct: 3, dueAt: iso(-10) };
  const finished: ChainState = {
    ...newChain("seventy"),
    current: 10,
    best: 10,
    graduatedAt: iso(5),
    dueAt: iso(-0.5),
  };
  const learning = newChain("eighty");
  const d = buildDigest({
    activity: [],
    words: [dueWord, laterWord],
    facts: [met, never, known],
    chains: [finished, learning],
    now,
  });
  assert.equal(d.dueTomorrow.words, 1);
  assert.equal(d.dueTomorrow.facts, 1);
  assert.equal(d.dueTomorrow.checks, 1);
  assert.equal(d.tablesLit, 1);
});
