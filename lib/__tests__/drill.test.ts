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
  isDoneForNow,
  isSettled,
  MAX_PER_WORD,
  modesFor,
  weakSkills,
  withFill,
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
  assert.equal(isWeak(word("melt"), NOW), false, "never started is new, not weak");
  assert.equal(isWeak(strong("solid"), NOW), false);
  assert.equal(isDue(word("melt"), NOW), true);
  assert.equal(isDue(strong("solid"), NOW), false);
});

test("weak means missed lately, or answered before and due again at streak 0", () => {
  const ago = (days: number) => new Date(NOW.getTime() - days * DAY).toISOString();
  const later = new Date(NOW.getTime() + 3 * DAY).toISOString();
  // Missed yesterday: weak.
  const missed = word("a", { skills: skills({ spell: { wrong: 1, lastAt: ago(1), dueAt: ago(1) } }) });
  assert.equal(isWeak(missed, NOW), true);
  // An early slip only halves the streak, but dueAt === lastAt gives it away.
  const slipped = word("b", {
    skills: skills({ listen: { streak: 2, wrong: 1, correct: 4, lastAt: ago(2), dueAt: ago(2) } }),
  });
  assert.equal(isWeak(slipped, NOW), true);
  // Right on the last try and not due yet: not weak.
  const right = word("c", {
    skills: skills({ spell: { streak: 1, wrong: 1, correct: 1, lastAt: ago(1), dueAt: later } }),
  });
  assert.equal(isWeak(right, NOW), false);
  // A miss long ago that is due again at streak 0: still weak.
  const old = word("d", { skills: skills({ use: { wrong: 1, lastAt: ago(30), dueAt: ago(30) } }) });
  assert.equal(isWeak(old, NOW), true);
  // Some skills never started, the others right and not due: not weak.
  const partly = word("e", { skills: skills({ recognize: { streak: 1, correct: 1, lastAt: ago(1), dueAt: later } }) });
  assert.equal(isWeak(partly, NOW), false);
  const counts = sourceCounts([{ listId: "l", name: "L", words: [missed, slipped, right, old, partly, word("f")] }], NOW);
  assert.equal(counts.weak, 3);
});

test("source counts report what is left, not totals", () => {
  // The chips used to show plain totals, so a mastered list looked exactly
  // like one he had never opened. `all` is now words still to learn; `total`
  // keeps the old number for anything that needs it.
  const counts = sourceCounts(lists(), NOW);
  assert.equal(counts.total, 4);
  assert.ok(counts.all <= counts.total);
  assert.equal(counts.weak, 0, "nothing answered yet, so nothing weak");
  assert.equal(counts.due, 2);
  assert.deepEqual(
    counts.lists.map((l) => l.total).sort(),
    [1, 3]
  );
  for (const l of counts.lists) assert.ok(l.toGo <= l.total);
  // Lists with the most left come first, so a finished list sinks.
  for (let i = 1; i < counts.lists.length; i++) {
    assert.ok(counts.lists[i - 1].toGo >= counts.lists[i].toGo);
  }
});

test("a word is settled only once produced and steady on every skill", () => {
  // strong() holds a streak of 4 everywhere but has never been produced
  // (correct stays 0), and a word he has never once spelled or used is not
  // known however steady its recognition looks. Same rule as wordKnowledge.
  assert.equal(isSettled(strong("solid")), false);
  const far = new Date(NOW.getTime() + 30 * DAY).toISOString();
  const produced = word("solid", {
    skills: skills({
      recognize: { streak: 4, dueAt: far },
      listen: { streak: 4, dueAt: far },
      spell: { streak: 4, dueAt: far, correct: 4 },
      use: { streak: 4, dueAt: far, correct: 4 },
    }),
  });
  assert.equal(isSettled(produced), true);
  // A fresh word: never produced, no streaks. Not settled.
  assert.equal(isSettled(word("wobble")), false);
});

test("pickWords filters by source", () => {
  const all = pickWords(lists(), { kind: "all" }, NOW);
  assert.equal(all.length, 4);
  assert.equal(pickWords(lists(), { kind: "weak" }, NOW).length, 0);
  const missed = word("sink", { skills: skills({ spell: { wrong: 1, lastAt: NOW.toISOString() } }) });
  const withMiss: DrillList[] = [...lists(), { listId: "c", name: "Unit 3", words: [missed] }];
  assert.deepEqual(
    pickWords(withMiss, { kind: "weak" }, NOW).map((p) => p.word.word),
    ["sink"]
  );
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

test("a drill has the asked-for number of items as far as the words allow, never two in a row on one word", () => {
  const picked = pickWords(lists(), { kind: "all" }, NOW);
  const items = buildDrillItems({
    picked,
    mode: "mixed",
    count: 20,
    now: NOW,
    rng: mulberry32(7),
  });
  // Four words, one round per skill: 16, not 20 with four repeats.
  assert.equal(items.length, Math.min(20, picked.length * 4));
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
  assert.equal(items.length, Math.min(10, picked.length * MAX_PER_WORD));
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

test("a word he got right today stops counting as to go, until tomorrow", () => {
  const earlier = new Date(NOW.getTime() - 60 * 60 * 1000).toISOString();
  const later = new Date(NOW.getTime() + DAY).toISOString();
  const rightToday = word("today", { skills: skills({ recognize: { streak: 1, lastAt: earlier, dueAt: later } }) });
  const missedToday = word("missed", { skills: skills({ recognize: { streak: 0, lastAt: earlier } }) });
  const fresh = word("fresh");
  assert.equal(isDoneForNow(rightToday, NOW), true);
  assert.equal(isDoneForNow(missedToday, NOW), false);
  assert.equal(isDoneForNow(fresh, NOW), false);
  assert.equal(isDoneForNow(rightToday, new Date(NOW.getTime() + 2 * DAY)), false);
  const counts = sourceCounts([{ listId: "l", name: "L", words: [rightToday, missedToday, fresh] }], NOW);
  assert.equal(counts.lists[0].toGo, 2);
});

test("a word missed early today is not done for now: the halved streak is a miss", () => {
  const earlier = new Date(NOW.getTime() - 60 * 60 * 1000).toISOString();
  // An early miss halves a streak of 2 to 1 and stamps dueAt === lastAt.
  const missedEarly = word("slip", {
    skills: skills({ spell: { streak: 1, correct: 2, wrong: 1, lastAt: earlier, dueAt: earlier } }),
  });
  assert.equal(isDoneForNow(missedEarly, NOW), false);
  assert.equal(isWeak(missedEarly, NOW), true);
  assert.deepEqual(weakSkills(missedEarly, NOW), ["spell"]);
});

test("the suggested word drill fixes the weak skill, not just any", () => {
  assert.deepEqual(modesFor(["spell"]), ["spell", "flashcards", "write"]);
  assert.deepEqual(modesFor(["recognize", "use"]), ["match", "use"]);
  assert.equal(modesFor([]).length, 6, "nothing weak: every type");
  const earlier = new Date(NOW.getTime() - 60 * 60 * 1000).toISOString();
  const missed = word("crippled", { skills: skills({ spell: { wrong: 1, lastAt: earlier } }) });
  assert.deepEqual(sourceCounts([{ listId: "l", name: "L", words: [missed, word("new")] }], NOW).weakSkills, ["spell"]);
});

test("a weak drill on few words is topped up so no word comes round more than twice", () => {
  const earlier = new Date(NOW.getTime() - 60 * 60 * 1000).toISOString();
  const weak = ["crippled", "criteria", "events"].map((w) =>
    word(w, { skills: skills({ spell: { wrong: 1, lastAt: earlier } }) })
  );
  const others = ["alpha", "beta", "gamma", "delta", "echo", "fox", "golf", "hotel"].map((w) => word(w));
  const lists: DrillList[] = [
    // The pool comes first; its copy of a weak word is the same word.
    { listId: "p", name: "Stuck", words: [weak[0]] },
    { listId: "l", name: "L", words: [...weak, ...others, strong("done")] },
  ];
  const picked = pickWords(lists, { kind: "weak" }, NOW);
  const filled = withFill(picked, lists, 20, NOW, mulberry32(1));
  const names = filled.map((p) => p.word.word);
  assert.equal(new Set(names).size, names.length, "no word twice");
  assert.equal(filled.length, Math.ceil(20 / MAX_PER_WORD));
  assert.ok(!names.includes("done"), "never a settled word");
  assert.equal(filled.find((p) => p.word.word === "crippled")?.pool.listId, "l", "the unit copy");
  assert.equal(buildDrillItems({ picked: filled, mode: "match", count: 20, now: NOW, rng: mulberry32(1) }).length, 20);
  // Enough words already: just the one copy of each.
  assert.deepEqual(
    withFill(picked, lists, 6, NOW, mulberry32(1)).map((p) => p.word.word).sort(),
    ["crippled", "criteria", "events"]
  );
});

test("a drill longer than its list stops before asking the same question a third time", () => {
  const few = Array.from({ length: 6 }, (_, i) => word(`w${i}`));
  const picked = pickWords([{ listId: "l", name: "L", words: few }], { kind: "all" }, NOW);
  const listen = buildDrillItems({ picked, mode: "listen", count: 40, now: NOW, rng: mulberry32(2) });
  assert.equal(listen.length, 6 * MAX_PER_WORD);
  const perWord = new Map<string, number>();
  for (const it of listen) perWord.set(it.word ?? "", (perWord.get(it.word ?? "") ?? 0) + 1);
  assert.ok([...perWord.values()].every((n) => n <= MAX_PER_WORD));
  // Mixed asks another skill each round, so it may go round once per skill.
  const mixed = buildDrillItems({ picked, mode: "mixed", count: 40, now: NOW, rng: mulberry32(2) });
  assert.equal(mixed.length, 24);
  const seen = new Set(mixed.map((it) => `${it.word}:${it.skill}`));
  assert.equal(seen.size, mixed.length, "no word asked the same skill twice");
});
