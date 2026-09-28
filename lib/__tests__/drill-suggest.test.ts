import assert from "node:assert/strict";
import test from "node:test";

import {
  nextWordMode,
  suggestDrill,
  suggestionFor,
  weakestSkill,
  type SkillSeen,
} from "@/components/drill/suggest";

const skills: SkillSeen[] = [
  { id: "fractions", name: "Fractions", recentPcts: [95], lastAt: "2026-09-20T10:00:00Z" },
  { id: "angles", name: "Angles", recentPcts: [60], lastAt: "2026-09-26T10:00:00Z" },
  { id: "decimals", name: "Decimals", recentPcts: [], lastAt: null },
];

test("the weakest math skill is the slipping one, else the one left longest", () => {
  assert.equal(weakestSkill(skills)?.skill.id, "angles");
  const noneSlipping = skills.map((s) => ({ ...s, recentPcts: s.recentPcts.length ? [95] : [] }));
  assert.equal(weakestSkill(noneSlipping)?.skill.id, "decimals", "never played comes first");
});

test("weak words come first, then math, turning between them through the day", () => {
  const base = { weakWords: 12, skills, seed: 1 };
  assert.equal(suggestDrill({ ...base, todayRefs: [] })?.kind, "words");
  assert.equal(suggestDrill({ ...base, todayRefs: ["drill:vocab:mixed"] })?.kind, "math");
  assert.equal(
    suggestDrill({ ...base, todayRefs: ["drill:vocab:mixed", "drill:math:angles:relaxed"] })?.kind,
    "words"
  );
  const math = suggestDrill({ ...base, todayRefs: ["drill:vocab:mixed"] });
  assert.ok(math?.href.startsWith("/drill/math?"));
  assert.equal(math?.title, "Angles");
});

test("no weak words: math; nothing at all: no suggestion", () => {
  assert.equal(suggestDrill({ weakWords: 0, skills, todayRefs: [], seed: 1 })?.kind, "math");
  assert.equal(suggestDrill({ weakWords: 0, skills: [], todayRefs: [], seed: 1 }), null);
});

test("word drills turn through the types, least played today first", () => {
  assert.equal(nextWordMode([]), "match");
  assert.equal(nextWordMode(["drill:vocab:match"]), "listen");
  assert.equal(nextWordMode(["drill:vocab:match", "drill:vocab:listen", "drill:vocab:mixed"]), "spell");
  const everyOnce = ["match", "listen", "spell", "use", "flashcards", "write"].map((m) => `drill:vocab:${m}`);
  assert.equal(nextWordMode(everyOnce), "match", "a tie goes back to the start of the order");
  assert.equal(nextWordMode([...everyOnce, "drill:vocab:match"]), "listen");

  const words = suggestDrill({ weakWords: 5, skills, todayRefs: ["drill:vocab:match"], seed: 1 });
  // One word drill and no math yet: math is next. Then words again, a new type.
  assert.equal(words?.kind, "math");
  const again = suggestDrill({
    weakWords: 5,
    skills,
    todayRefs: ["drill:vocab:match", "drill:math:angles:relaxed"],
    seed: 1,
  });
  assert.equal(again?.title, "Weak words · Listen");
  assert.ok(again?.href.includes("mode=listen"));
  assert.ok(again?.href.includes("src=weak"));
});

test("a math skill drilled today waits while others are left", () => {
  const first = suggestDrill({ weakWords: 0, skills, todayRefs: [], seed: 1 });
  assert.equal(first?.title, "Angles");
  const next = suggestDrill({ weakWords: 0, skills, todayRefs: ["drill:math:angles:t60#12"], seed: 1 });
  assert.equal(next?.title, "Decimals", "angles was drilled today, so the untried one");
  const all = skills.map((s) => `drill:math:${s.id}:relaxed`);
  assert.equal(suggestDrill({ weakWords: 0, skills, todayRefs: all, seed: 1 })?.title, "Angles", "all done: back to the weakest");
});

test("suggestionFor counts only today's sessions", () => {
  const now = new Date("2026-09-27T17:00:00.000Z");
  const s = suggestionFor({
    weakWords: 4,
    played: [],
    activity: [
      { ref: "drill:vocab:match", at: "2026-09-20T17:00:00.000Z" },
      { ref: "drill:vocab:match", at: "2026-09-27T16:00:00.000Z" },
      { ref: "drill:math:fractions:relaxed", at: "2026-09-27T16:30:00.000Z" },
    ],
    now,
  });
  assert.equal(s?.kind, "words");
  assert.equal(s?.title, "Weak words · Listen");
});

test("once every math skill is drilled, the least drilled today comes next, not the same one", () => {
  const all = skills.map((s) => `drill:math:${s.id}:relaxed`);
  const dealt: string[] = [];
  let refs = [...all];
  for (let i = 0; i < 6; i++) {
    const s = suggestDrill({ weakWords: 0, skills, todayRefs: refs, seed: 1 });
    dealt.push(s?.title ?? "");
    const id = skills.find((k) => k.name === s?.title)?.id;
    refs = [...refs, `drill:math:${id}:relaxed`];
  }
  // Angles is slipping, but it only comes round again with the others.
  assert.deepEqual(dealt, ["Angles", "Decimals", "Fractions", "Angles", "Decimals", "Fractions"]);
});

test("the weak-word drill type turns only through the ones that fix the weak skill", () => {
  const s = suggestDrill({ weakWords: 3, wordModes: ["spell", "flashcards", "write"], skills: [], todayRefs: [], seed: 1 });
  assert.equal(s?.title, "Weak words · Spell");
  const next = suggestDrill({
    weakWords: 3,
    wordModes: ["spell", "flashcards", "write"],
    skills: [],
    todayRefs: ["drill:vocab:spell"],
    seed: 1,
  });
  assert.ok(next?.href.includes("mode=flashcards"));
});

test("with no weak words the driver still drills words: due ones, then the ones to go", () => {
  const due = suggestDrill({ weakWords: 0, dueWords: 7, toGoWords: 40, skills, todayRefs: [], seed: 1 });
  assert.equal(due?.kind, "words");
  assert.equal(due?.title, "Due words · Match");
  assert.ok(due?.href.includes("src=due"));
  const toGo = suggestDrill({ weakWords: 0, dueWords: 0, toGoWords: 40, skills, todayRefs: [], seed: 1 });
  assert.equal(toGo?.title, "Your words · Match");
  assert.equal(toGo?.line, "40 words to go today");
  // Words and math still take turns.
  const next = suggestDrill({ weakWords: 0, dueWords: 7, toGoWords: 40, skills, todayRefs: ["drill:vocab:match"], seed: 1 });
  assert.equal(next?.kind, "math");
});
