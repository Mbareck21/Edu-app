import assert from "node:assert/strict";
import test from "node:test";

import {
  SUGGESTED_WORD_MODES,
  nextMathMode,
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

const param = (href: string | undefined, key: string) =>
  new URL(href ?? "/", "http://x").searchParams.get(key);

test("word drills turn through every type, least played today first, shuffled among equals", () => {
  // Nothing played: any type. Played once: never that one again until all have been.
  const seen = new Set<string>();
  let refs: string[] = [];
  for (let i = 0; i < SUGGESTED_WORD_MODES.length; i++) {
    const mode = nextWordMode(refs, SUGGESTED_WORD_MODES, 1000 + i);
    assert.ok(!seen.has(mode), `${mode} again before every type had a turn`);
    seen.add(mode);
    refs = [...refs, `drill:vocab:${mode}`];
  }
  assert.equal(seen.size, SUGGESTED_WORD_MODES.length);
  assert.ok(seen.has("mixed") && seen.has("rescue"), "mixed and rescue are in the turn");
  // The order is shuffled: different seeds start on different types.
  const starts = new Set(Array.from({ length: 40 }, (_, i) => nextWordMode([], SUGGESTED_WORD_MODES, i + 1)));
  assert.ok(starts.size >= 4, `only ${[...starts]}`);
});

test("math drills turn through relaxed and timed, but a slipping skill is drilled relaxed", () => {
  const seen = new Set<string>();
  let refs: string[] = [];
  for (let i = 0; i < 3; i++) {
    const mode = nextMathMode(refs, false, 50 + i);
    assert.ok(!seen.has(mode));
    seen.add(mode);
    refs = [...refs, mode === "relaxed" ? "drill:math:fractions:relaxed" : `drill:math:fractions:${mode}#12`];
  }
  assert.deepEqual([...seen].sort(), ["relaxed", "t120", "t60"]);
  assert.equal(nextMathMode([], true, 7), "relaxed");
  // Angles is slipping (60%): its drill is relaxed, whatever the turn says.
  const s = suggestDrill({ weakWords: 0, skills, todayRefs: ["drill:math:x:relaxed"], seed: 3 });
  assert.equal(param(s?.href, "skill"), "angles");
  assert.equal(param(s?.href, "mode"), "relaxed");
});

test("a run of Next drill taps alternates words and math and never repeats a type or skill early", () => {
  let refs: string[] = [];
  const kinds: string[] = [];
  for (let i = 0; i < 12; i++) {
    const s = suggestDrill({ weakWords: 0, dueWords: 9, toGoWords: 40, skills, todayRefs: refs, seed: 77 + i });
    assert.ok(s);
    kinds.push(s.kind);
    const mode = param(s.href, "mode") ?? "";
    refs = [
      ...refs,
      s.kind === "words"
        ? `drill:vocab:${mode}`
        : `drill:math:${param(s.href, "skill")}:${mode}${mode === "relaxed" ? "" : "#10"}`,
    ];
  }
  assert.deepEqual(kinds, Array.from({ length: 12 }, (_, i) => (i % 2 === 0 ? "words" : "math")));
  const wordModes = refs.filter((r) => r.startsWith("drill:vocab:"));
  assert.equal(new Set(wordModes).size, wordModes.length, "six word drills, six different types");
  const mathSkills = refs.filter((r) => r.startsWith("drill:math:")).map((r) => r.split(":")[2]);
  // Three skills here: each comes round twice, never twice in a row.
  for (let i = 1; i < mathSkills.length; i++) assert.notEqual(mathSkills[i], mathSkills[i - 1]);
});

test("a math skill drilled today waits while others are left", () => {
  const first = suggestDrill({ weakWords: 0, skills, todayRefs: [], seed: 1 });
  assert.equal(param(first?.href, "skill"), "angles");
  const next = suggestDrill({ weakWords: 0, skills, todayRefs: ["drill:math:angles:t60#12"], seed: 1 });
  assert.equal(param(next?.href, "skill"), "decimals", "angles was drilled today, so the untried one");
  const all = skills.map((s) => `drill:math:${s.id}:relaxed`);
  assert.equal(param(suggestDrill({ weakWords: 0, skills, todayRefs: all, seed: 1 })?.href, "skill"), "angles", "all done: back to the weakest");
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
  assert.ok(s?.title.startsWith("Weak words · "));
  assert.notEqual(param(s?.href, "mode"), "match", "match was played today");
});

test("once every math skill is drilled, the least drilled today comes next, not the same one", () => {
  const all = skills.map((s) => `drill:math:${s.id}:relaxed`);
  const dealt: string[] = [];
  let refs = [...all];
  for (let i = 0; i < 6; i++) {
    const s = suggestDrill({ weakWords: 0, skills, todayRefs: refs, seed: 1 });
    const id = param(s?.href, "skill") ?? "";
    dealt.push(id);
    refs = [...refs, `drill:math:${id}:relaxed`];
  }
  // Angles is slipping, but it only comes round again with the others.
  assert.deepEqual(dealt, ["angles", "decimals", "fractions", "angles", "decimals", "fractions"]);
});

test("the weak-word drill type turns only through the ones that fix the weak skill", () => {
  const fixes = ["spell", "flashcards", "write"] as const;
  let refs: string[] = [];
  for (let i = 0; i < 3; i++) {
    const s = suggestDrill({ weakWords: 3, wordModes: fixes, skills: [], todayRefs: refs, seed: 9 + i });
    const mode = param(s?.href, "mode") ?? "";
    assert.ok((fixes as readonly string[]).includes(mode), mode);
    refs = [...refs, `drill:vocab:${mode}`];
  }
  assert.equal(new Set(refs).size, 3);
  // Rescue needs several fair puzzles: never on a handful of weak words.
  const all = suggestDrill({ weakWords: 2, skills: [], todayRefs: [], seed: 1, wordModes: ["rescue", "spell"] });
  assert.equal(param(all?.href, "mode"), "spell");
});

test("with no weak words the driver still drills words: due ones, then the ones to go", () => {
  const due = suggestDrill({ weakWords: 0, dueWords: 7, toGoWords: 40, skills, todayRefs: [], seed: 1 });
  assert.equal(due?.kind, "words");
  assert.ok(due?.title.startsWith("Due words · "));
  assert.ok(due?.href.includes("src=due"));
  const toGo = suggestDrill({ weakWords: 0, dueWords: 0, toGoWords: 40, skills, todayRefs: [], seed: 1 });
  assert.ok(toGo?.title.startsWith("Your words · "));
  assert.equal(toGo?.line, "40 words to go today");
  // Words and math still take turns.
  const next = suggestDrill({ weakWords: 0, dueWords: 7, toGoWords: 40, skills, todayRefs: ["drill:vocab:match"], seed: 1 });
  assert.equal(next?.kind, "math");
});

test("the Drill tab's card and Keep going pick the same drill until another is played", () => {
  const activity = [{ ref: "drill:vocab:match", at: "2026-09-28T16:00:00.000Z" }];
  const base = { weakWords: 0, dueWords: 6, toGoWords: 30, played: [], activity };
  const card = suggestionFor({ ...base, now: new Date("2026-09-28T17:00:00.000Z") });
  const keepGoing = suggestionFor({ ...base, now: new Date("2026-09-28T17:04:09.000Z") });
  assert.equal(card?.title, keepGoing?.title);
  assert.equal(param(card?.href, "mode"), param(keepGoing?.href, "mode"));
  assert.equal(param(card?.href, "skill"), param(keepGoing?.href, "skill"));
});
