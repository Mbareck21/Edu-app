import test from "node:test";
import assert from "node:assert/strict";

import type { Level, MathQuestion, MathSkillId } from "../types";
import { mulberry32, randInt, shuffle } from "../rng";
import { MATH_SKILLS, MATH_SKILL_IDS, getSkill, isMathSkillId, skillsForUnit } from "../skills";
import { MATH_UNITS, currentUnit, unitFor } from "../units";
import { MAX_SESSION_COUNT, buildSession, gradeAnswer, mixedSession, nextLevel } from "../session";

const LEVELS: readonly Level[] = [1, 2, 3];
const SAMPLES = 200;

/** Biggest answer that still makes sense for each skill. */
const MAX_ANSWER: Record<MathSkillId, number> = {
  "place-value": 1000000,
  "add-sub-big": 1000000,
  "mul-facts": 144,
  "mul-multi": 100000,
  "word-problems": 1000,
  division: 5000,
  "factors-multiples": 144,
  fractions: 200,
  data: 200,
  decimals: 1000,
  geometry: 250,
  angles: 360,
  shapes: 12,
};

function checkQuestion(q: MathQuestion, id: MathSkillId): void {
  assert.ok(Number.isInteger(q.answer), `${id}: answer not whole: ${q.answer}`);
  assert.ok(q.answer >= 0, `${id}: negative answer in "${q.prompt}"`);
  assert.ok(q.answer <= MAX_ANSWER[id], `${id}: answer ${q.answer} too big in "${q.prompt}"`);

  assert.ok(q.prompt.length > 0, `${id}: empty prompt`);
  assert.ok(q.prompt.length <= 80, `${id}: prompt too long (${q.prompt.length}): "${q.prompt}"`);
  assert.ok(!q.prompt.includes("  "), `${id}: double space in "${q.prompt}"`);
  assert.ok(!q.prompt.includes("undefined"), `${id}: bad template in "${q.prompt}"`);
  assert.ok(!q.prompt.includes("NaN"), `${id}: NaN in "${q.prompt}"`);

  assert.ok(q.how.length > 0, `${id}: empty how for "${q.prompt}"`);
  assert.ok(q.how.length <= 90, `${id}: how too long (${q.how.length}): "${q.how}"`);
  assert.ok(/\d/.test(q.how), `${id}: how has no numbers: "${q.how}"`);
  assert.ok(!q.how.includes("NaN"), `${id}: NaN in how "${q.how}"`);
  assert.ok(!q.how.includes("undefined"), `${id}: bad template in how "${q.how}"`);

  assert.ok(["+", "-", "×", "÷", "?"].includes(q.op), `${id}: bad op ${q.op}`);

  const v = q.visual;
  switch (v.kind) {
    case "groups":
      assert.ok(v.groups >= 1 && v.groups <= 12 && v.per >= 1 && v.per <= 12, `${id}: groups out of range`);
      break;
    case "bar":
      assert.ok(v.a > 0 && v.b > 0, `${id}: bar needs two sizes`);
      break;
    case "tenframes":
      assert.ok(v.n > 0, `${id}: tenframes needs a count`);
      break;
    case "placevalue":
      assert.ok(v.value > 0, `${id}: placevalue needs a number`);
      assert.ok(["ones", "tens", "hundreds", "thousands"].includes(v.place), `${id}: bad place`);
      break;
    case "rect":
      assert.ok(v.w > 0 && v.h > 0, `${id}: rect needs both sides`);
      assert.ok(v.label === "area" || v.label === "perimeter", `${id}: bad rect label`);
      break;
    case "table":
      assert.ok(v.rows.length >= 3, `${id}: table needs rows`);
      for (const row of v.rows) {
        assert.ok(row.label.length > 0 && row.value > 0, `${id}: bad table row`);
      }
      assert.equal(new Set(v.rows.map((r) => r.value)).size, v.rows.length, `${id}: rows must differ`);
      break;
    case "bars":
      assert.ok(v.bars.length >= 3, `${id}: bars need data`);
      assert.ok(v.scale >= 1, `${id}: bars need a scale`);
      for (const bar of v.bars) {
        assert.ok(bar.value % v.scale === 0, `${id}: bar ${bar.value} does not fit scale ${v.scale}`);
      }
      assert.equal(new Set(v.bars.map((b) => b.value)).size, v.bars.length, `${id}: bars must differ`);
      break;
    case "angle":
      assert.ok([90, 180, 360].includes(v.total), `${id}: odd angle total ${v.total}`);
      assert.ok(v.known > 0 && v.known < v.total, `${id}: angle part out of range`);
      break;
    case "shape":
      assert.ok(v.name.length > 0, `${id}: shape needs a name`);
      break;
    case "none":
      break;
  }
}

test("registry is complete and display-ready", () => {
  assert.equal(MATH_SKILLS.length, 13);
  assert.equal(new Set(MATH_SKILL_IDS).size, MATH_SKILLS.length);
  for (const skill of MATH_SKILLS) {
    assert.ok(skill.name.trim().split(/\s+/).length <= 2, `${skill.id}: name is more than 2 words`);
    assert.ok(skill.blurb.length > 0 && skill.blurb.length <= 40, `${skill.id}: blurb should be one short line`);
    assert.equal(skill.color, "purple");
    assert.equal(skill.grade, 4);
    assert.equal(getSkill(skill.id), skill);
    assert.ok(Array.isArray(skill.standards), `${skill.id}: standards must be a list`);
    for (const code of skill.standards) {
      assert.match(code, /^4\.[A-Z]+\.\d+$/, `${skill.id}: odd standard "${code}"`);
    }
  }
  assert.ok(isMathSkillId("mul-facts"));
  assert.ok(!isMathSkillId("nope"));
});

test("units cover the whole year and every skill once", () => {
  assert.equal(MATH_UNITS.length, 6);
  const placed: MathSkillId[] = [];
  let previousEnd = "";
  for (const unit of MATH_UNITS) {
    assert.match(unit.start, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(unit.end, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(unit.start < unit.end, `unit ${unit.id}: start must come first`);
    assert.ok(unit.start > previousEnd, `unit ${unit.id}: units must not overlap`);
    previousEnd = unit.end;
    assert.ok(unit.skills.length > 0, `unit ${unit.id}: needs skills`);
    for (const id of unit.skills) {
      placed.push(id);
      assert.equal(getSkill(id).unit, unit.id, `${id}: skill.unit must match its unit`);
    }
    assert.deepEqual(
      skillsForUnit(unit.id).map((s) => s.id),
      unit.skills,
    );
    assert.equal(unitFor(unit.id), unit);
  }
  assert.equal(placed.length, MATH_SKILLS.length);
  assert.equal(new Set(placed).size, MATH_SKILLS.length);
});

test("currentUnit finds the unit school is in", () => {
  assert.equal(currentUnit("2026-08-11").id, 1);
  assert.equal(currentUnit("2026-09-20").id, 1);
  assert.equal(currentUnit("2026-10-08").id, 1);
  assert.equal(currentUnit("2026-10-20").id, 2);
  assert.equal(currentUnit("2026-12-01").id, 3);
  assert.equal(currentUnit("2027-01-20").id, 4);
  assert.equal(currentUnit("2027-03-01").id, 5);
  assert.equal(currentUnit("2027-04-10").id, 6);
  // Summer before school starts, winter break, and after the last day.
  assert.equal(currentUnit("2026-07-01").id, 1);
  assert.equal(currentUnit("2026-12-28").id, 4);
  assert.equal(currentUnit("2027-06-15").id, 6);
  assert.equal(currentUnit("2027-04-10T09:30:00.000Z").id, 6);
});

for (const skill of MATH_SKILLS) {
  for (const level of LEVELS) {
    test(`${skill.id} level ${level}: ${SAMPLES} good questions`, () => {
      const rng = mulberry32(level * 7919 + skill.id.length * 104729);
      for (let i = 0; i < SAMPLES; i++) {
        checkQuestion(skill.generate(level, rng), skill.id);
      }
    });
  }
}

test("word problems stay at Grade-3 reading level", () => {
  const skill = getSkill("word-problems");
  for (const level of LEVELS) {
    const rng = mulberry32(1234 + level);
    for (let i = 0; i < SAMPLES; i++) {
      const q = skill.generate(level, rng);
      const sentences = q.prompt
        .split(/[.?]/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      assert.ok(sentences.length >= 2, `needs short sentences: "${q.prompt}"`);
      for (const s of sentences) {
        const words = s.split(/\s+/).length;
        assert.ok(words <= 10, `sentence too long (${words} words): "${s}"`);
      }
    }
  }
});

test("shape questions only use the eight named figures", () => {
  const names = [
    "rectangle",
    "square",
    "rhombus",
    "parallelogram",
    "trapezoid",
    "right triangle",
    "acute triangle",
    "obtuse triangle",
  ];
  const skill = getSkill("shapes");
  for (const level of LEVELS) {
    const rng = mulberry32(31 + level);
    const asked = new Set<string>();
    for (let i = 0; i < SAMPLES; i++) {
      const q = skill.generate(level, rng);
      assert.equal(q.visual.kind, "shape");
      if (q.visual.kind === "shape") {
        assert.ok(names.includes(q.visual.name), `unknown shape ${q.visual.name}`);
        assert.ok(q.prompt.includes(q.visual.name), `prompt and picture disagree: "${q.prompt}"`);
      }
      asked.add(q.prompt);
    }
    assert.ok(asked.size >= 12, `level ${level} needs at least 12 shape questions, got ${asked.size}`);
  }
});

test("buildSession is seeded, sized and repeat-free", () => {
  for (const skill of MATH_SKILLS) {
    for (const level of LEVELS) {
      const qs = buildSession({ skillId: skill.id, level, seed: 42 });
      assert.equal(qs.length, 10);
      assert.equal(new Set(qs.map((q) => q.prompt)).size, 10, `${skill.id} L${level}: duplicate prompts`);

      const again = buildSession({ skillId: skill.id, level, seed: 42 });
      assert.deepEqual(again, qs, `${skill.id}: same seed must give the same session`);

      for (const q of qs) checkQuestion(q, skill.id);
    }
  }
});

test("buildSession takes counts up to 40 and never repeats twice in a row", () => {
  for (const skill of MATH_SKILLS) {
    for (const level of LEVELS) {
      const qs = buildSession({ skillId: skill.id, level, seed: 7, count: 40 });
      assert.equal(qs.length, 40);
      for (let i = 1; i < qs.length; i++) {
        assert.notEqual(qs[i].prompt, qs[i - 1].prompt, `${skill.id} L${level}: prompt repeated back to back`);
      }
    }
  }
  assert.equal(buildSession({ skillId: "mul-facts", level: 1, seed: 3, count: 99 }).length, MAX_SESSION_COUNT);
  assert.equal(buildSession({ skillId: "mul-facts", level: 1, seed: 3, count: 0 }).length, 1);
});

test("mixedSession spreads over every skill", () => {
  for (const level of LEVELS) {
    const qs = mixedSession({ level, seed: 99, count: 13 });
    assert.equal(qs.length, 13);
    assert.equal(new Set(qs.map((q) => q.prompt)).size, 13);
    assert.ok(new Set(qs.map((q) => q.op)).size >= 3, "mixed drill should use several operations");
    for (let i = 1; i < qs.length; i++) {
      assert.notEqual(qs[i].prompt, qs[i - 1].prompt);
    }
    assert.deepEqual(mixedSession({ level, seed: 99, count: 13 }), qs);
  }
  assert.equal(mixedSession({ level: 3, seed: 5, count: 40 }).length, 40);
});

test("gradeAnswer only accepts the whole number", () => {
  const q = buildSession({ skillId: "mul-facts", level: 1, seed: 11, count: 1 })[0];
  assert.deepEqual(gradeAnswer(q, String(q.answer)), { correct: true, answer: q.answer });
  assert.deepEqual(gradeAnswer(q, ` ${q.answer} `), { correct: true, answer: q.answer });
  assert.equal(gradeAnswer(q, String(q.answer + 1)).correct, false);
  assert.equal(gradeAnswer(q, "").correct, false);
  assert.equal(gradeAnswer(q, "abc").correct, false);
  assert.equal(gradeAnswer(q, `${q.answer}.5`).correct, false);
  assert.equal(gradeAnswer(q, `-${q.answer}`).correct, false);

  const big: MathQuestion = { prompt: "x", answer: 43207, visual: { kind: "none" }, how: "1", op: "?" };
  assert.equal(gradeAnswer(big, "43,207").correct, true);
  assert.equal(gradeAnswer(big, "43 207").correct, true);
});

test("nextLevel moves on three strong sessions and drops after a weak one", () => {
  assert.equal(nextLevel(1, [90, 95, 100]), 2);
  assert.equal(nextLevel(2, [90, 90, 90]), 3);
  assert.equal(nextLevel(3, [100, 100, 100]), 3);
  assert.equal(nextLevel(2, [95, 95]), 2);
  assert.equal(nextLevel(2, [100, 100, 89]), 2);
  assert.equal(nextLevel(2, [70, 80, 85]), 2);
  assert.equal(nextLevel(3, [100, 100, 50]), 2);
  assert.equal(nextLevel(1, [10]), 1);
  assert.equal(nextLevel(2, []), 2);
  assert.equal(nextLevel(2, [95, 50, 95]), 2);
});

test("rng helpers are seeded and in range", () => {
  const a = mulberry32(5);
  const b = mulberry32(5);
  for (let i = 0; i < 50; i++) {
    const v = a();
    assert.equal(v, b());
    assert.ok(v >= 0 && v < 1);
  }
  const rng = mulberry32(9);
  for (let i = 0; i < 200; i++) {
    const n = randInt(rng, 3, 7);
    assert.ok(Number.isInteger(n) && n >= 3 && n <= 7);
  }
  const source = [1, 2, 3, 4, 5];
  const mixed = shuffle(mulberry32(2), source);
  assert.deepEqual(source, [1, 2, 3, 4, 5]);
  assert.deepEqual(
    mixed.slice().sort((x, y) => x - y),
    source,
  );
});
