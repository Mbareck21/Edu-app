// Lesson 13, "Use Multiplication to Convert Measurements", has questions of
// its own (2026-11-15 sweep). It mapped to word problems, which convert nothing.

import assert from "node:assert/strict";
import test from "node:test";

import { mathSkillFor } from "@/lib/daily-plan-beats";
import { buildSession, getSkill } from "@/lib/math";
import { IREADY_LESSONS } from "@/lib/math/iready";
import { mulberry32 } from "@/lib/math/rng";
import type { Level } from "@/lib/math/types";

const ALL: readonly Level[] = [1, 2, 3, 4, 5];
const lesson = (n: number) => {
  const l = IREADY_LESSONS.find((x) => x.lesson === n);
  assert.ok(l, `lesson ${n}`);
  return l;
};

test("the conversion lessons deal conversion questions", () => {
  assert.deepEqual(lesson(13).skills, ["measurement"]);
  assert.ok(lesson(29).skills.includes("measurement"));
  // The days the class is on Lesson 13 in 2026-27 serve it as the day's Math.
  assert.equal(mathSkillFor("2026-11-24", {}), "measurement");
});

test("every question names two units and its steps end on the answer", () => {
  const skill = getSkill("measurement");
  const units =
    /(centimeters?|meters?|kilometers?|grams?|kilograms?|liters?|milliliters?|hours?|minutes?|seconds?|weeks?|days?|foot|feet|inch|inches|yards?|pounds?|ounces?|gallons?|quarts?|pints?)/gi;
  for (const level of ALL) {
    const rng = mulberry32(13 * level);
    for (let i = 0; i < 300; i++) {
      const q = skill.generate(level, rng);
      // "A 4-meter rope", "4-inch pieces": the hyphen is a word break, so these count.
      const named = new Set((q.prompt.toLowerCase().match(units) ?? []).map((u) => u.replace(/(es|s)$/, "")));
      assert.ok(named.size >= 2, `level ${level}: "${q.prompt}"`);
      const numbers = q.how.replace(/,/g, "").match(/\d+/g) ?? [];
      assert.equal(Number(numbers[numbers.length - 1]), q.answer, `level ${level}: "${q.how}" for "${q.prompt}"`);
      assert.ok(Number.isInteger(q.answer) && q.answer > 0, `level ${level}: ${q.answer} for "${q.prompt}"`);
    }
  }
});

test("level 1 gives the fact, so the lesson is the multiplying", () => {
  const skill = getSkill("measurement");
  const rng = mulberry32(7);
  for (let i = 0; i < 200; i++) {
    const q = skill.generate(1, rng);
    assert.match(q.prompt, /^1 \w+ = [\d,]+ \w+\. How many /, q.prompt);
    assert.equal(q.op, "×");
    assert.equal((q.a ?? 0) * (q.b ?? 0), q.answer, q.prompt);
  }
});

test("a lesson of ten never runs short, at any level", () => {
  for (const level of ALL) {
    for (const seed of [1, 2, 3, 4, 5]) {
      const questions = buildSession({ skillId: "measurement", level, seed, count: 10 });
      assert.equal(questions.length, 10, `level ${level}, seed ${seed}`);
      assert.equal(new Set(questions.map((q) => q.prompt)).size, 10);
    }
  }
});

test("each Grade 4 level asks more than one kind of question", () => {
  const skill = getSkill("measurement");
  for (const level of [2, 3] as const) {
    const rng = mulberry32(99 + level);
    const ops = new Set<string>();
    for (let i = 0; i < 200; i++) ops.add(skill.generate(level, rng).op);
    assert.ok(ops.size >= 2, `level ${level}: only ${[...ops].join(" ")}`);
  }
});
