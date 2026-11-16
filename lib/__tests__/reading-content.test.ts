// What a passage is made of keeps pace too (2026-11-15 sweep): the words get
// harder with the level, not only the length, and an informational reading
// unit is read as information, not only as stories.

import assert from "node:assert/strict";
import test from "node:test";

import {
  READING_THEMES,
  infoAnglesFor,
  infoTopicFor,
  scienceUnitForWeek,
  type ReadingTheme,
} from "@/lib/curriculum";
import { readingSystemPrompt } from "@/lib/groq";
import { GRADE4_LEXILE, levelAtGrade, lexileForLevel, wordGradeFor } from "@/lib/reading";

// ── Word difficulty follows the level ─────────────────────────────────────

test("the word band climbs with the level's text difficulty", () => {
  assert.equal(wordGradeFor(1), "Grade 2-3");
  assert.equal(wordGradeFor(3), "Grade 2-3");
  assert.equal(wordGradeFor(4), "Grade 3");
  assert.equal(wordGradeFor(levelAtGrade() - 1), "Grade 3");
  assert.equal(wordGradeFor(levelAtGrade()), "Grade 4");
  assert.equal(wordGradeFor(10), "Grade 4");
  assert.equal(wordGradeFor(12), "Grade 5");
  // Grade 4 words start exactly where the texts enter the Grade 4 band.
  for (let level = 1; level <= 12; level++) {
    assert.equal(/Grade [45]/.test(wordGradeFor(level)), lexileForLevel(level) >= GRADE4_LEXILE.min, `level ${level}`);
  }
});

test("the writer is told the level's word band, not Grade 2-3 at every level", () => {
  const low = readingSystemPrompt(4, 1);
  assert.match(low, /reading below grade level/);
  assert.match(low, /common Grade 2-3 English/);

  const mid = readingSystemPrompt(4, 5);
  assert.match(mid, /reading below grade level/);
  assert.match(mid, /common Grade 3 English/);

  const high = readingSystemPrompt(4, 8);
  assert.match(high, /reading at grade level/);
  assert.match(high, /common Grade 4 English/);
  assert.doesNotMatch(high, /below grade level/);
  assert.doesNotMatch(high, /Grade 2-3 English/);
});

// ── Informational reading units are read as information ───────────────────

const theme = (id: string): ReadingTheme => {
  const t = READING_THEMES.find((x) => x.id === id);
  assert.ok(t, id);
  return t;
};
const science = scienceUnitForWeek("2026-11-16");

test("every reading unit says whether it is informational", () => {
  for (const t of READING_THEMES) assert.equal(typeof t.informational, "boolean", t.id);
  assert.equal(theme("government-in-action").informational, true);
  assert.equal(theme("technology-for-tomorrow").informational, true);
  assert.equal(theme("points-of-view").informational, false);
  assert.equal(theme("confronting-challenges").informational, false);
});

test("an informational unit shares the informational passages with science, turn about", () => {
  assert.ok(science);
  const unit = theme("government-in-action");
  // After a science passage, the reading unit; after the unit, science again.
  assert.equal(infoTopicFor(unit, science, science.title), "theme");
  assert.equal(infoTopicFor(unit, science, unit.title), "science");
  // Nothing informational read on this list yet: science first, as before.
  assert.equal(infoTopicFor(unit, science, undefined), "science");
});

test("a story unit leaves informational passages to science, as before", () => {
  assert.ok(science);
  const unit = theme("points-of-view");
  assert.equal(infoTopicFor(unit, science, science.title), "science");
  assert.equal(infoTopicFor(unit, science, undefined), "science");
});

test("with no science unit the reading unit carries the passage", () => {
  assert.equal(infoTopicFor(theme("points-of-view"), null, undefined), "theme");
  assert.equal(infoTopicFor(theme("government-in-action"), null, "anything"), "theme");
});

test("an informational passage is never given a story or poem angle", () => {
  for (const t of READING_THEMES) {
    const angles = infoAnglesFor(t);
    assert.ok(angles.length > 0, t.id);
    for (const a of angles) assert.doesNotMatch(a, /\b(poet|poem|story|character|narrator)\b/i, `${t.id}: ${a}`);
  }
});
