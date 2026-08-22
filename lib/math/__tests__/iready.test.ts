import assert from "node:assert/strict";
import { test } from "node:test";

import {
  IREADY_LESSONS,
  IREADY_UNITS,
  currentLesson,
  lessonByNumber,
  lessonLabel,
  lessonsForFpsUnit,
} from "@/lib/math/iready";
import { MATH_UNITS } from "@/lib/math/units";
import { isMathSkillId } from "@/lib/math/skills";

test("the sequence is all 34 lessons, numbered in order", () => {
  assert.equal(IREADY_LESSONS.length, 34);
  IREADY_LESSONS.forEach((l, i) => assert.equal(l.lesson, i + 1));
  assert.equal(IREADY_UNITS.length, 5);
});

test("every lesson names a real i-Ready unit, a real FPS unit and real skills", () => {
  const fpsIds = new Set(MATH_UNITS.map((u) => u.id));
  const ireadyIds = new Set(IREADY_UNITS.map((u) => u.id));
  for (const l of IREADY_LESSONS) {
    assert.ok(ireadyIds.has(l.ireadyUnit), `lesson ${l.lesson} i-Ready unit`);
    assert.ok(fpsIds.has(l.fpsUnit), `lesson ${l.lesson} FPS unit`);
    assert.ok(l.title.length > 0);
    assert.ok(l.standards.length > 0, `lesson ${l.lesson} has standards`);
    assert.ok(l.skills.length > 0, `lesson ${l.lesson} maps to a skill`);
    for (const s of l.skills) assert.ok(isMathSkillId(s), `${s} is a skill id`);
  }
});

test("units stay in order and every FPS unit is covered", () => {
  let seen = 0;
  for (const l of IREADY_LESSONS) {
    assert.ok(l.fpsUnit >= seen, "FPS units never go backwards");
    seen = l.fpsUnit;
  }
  for (const u of MATH_UNITS) {
    assert.ok(lessonsForFpsUnit(u.id).length > 0, `unit ${u.id} has lessons`);
  }
});

test("lessons pace across their unit's dates", () => {
  const u1 = MATH_UNITS[0];
  assert.equal(currentLesson(u1.start).lesson, 1);
  assert.equal(currentLesson(u1.end).lesson, 5);
  // Before school starts he is on the first lesson; after it ends, the last.
  assert.equal(currentLesson("2020-01-01").lesson, 1);
  assert.equal(currentLesson("2099-01-01").lesson, 34);
  // Mid-unit lands somewhere inside that unit, never outside it.
  const mid = currentLesson("2026-09-10");
  assert.equal(mid.fpsUnit, 1);
});

test("lesson lookup and label", () => {
  assert.equal(lessonByNumber(4)?.title, "Add Whole Numbers");
  assert.equal(lessonByNumber(99), undefined);
  assert.match(lessonLabel(IREADY_LESSONS[3]), /Lesson 4: Add Whole Numbers$/);
});
