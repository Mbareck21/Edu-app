import assert from "node:assert/strict";
import test from "node:test";

import { suggestDrill, weakestSkill, type SkillSeen } from "@/components/drill/suggest";

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
