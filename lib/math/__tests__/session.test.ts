import assert from "node:assert/strict";
import test from "node:test";

import { isMathLesson, mathLessonRef } from "@/lib/math";

test("only a finished math lesson counts for the daily Math beat", () => {
  assert.ok(isMathLesson(mathLessonRef("fractions")));
  assert.ok(!isMathLesson("drill:math:mixed:t60#2"), "a two-answer drill");
  assert.ok(!isMathLesson("tables:7"), "a times-tables round");
  assert.ok(!isMathLesson("tables:voice"));
});
