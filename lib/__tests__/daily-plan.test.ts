import assert from "node:assert/strict";
import test from "node:test";

import {
  PLAN_ORDER,
  doneToday,
  nextBeat,
  planCheer,
  planProgress,
  type BeatId,
  type PlanBeat,
} from "@/lib/daily-plan";
import { mathSkillFor, planBeats } from "@/lib/daily-plan-beats";
import type { ListSummary } from "@/lib/lists";
import { currentLesson } from "@/lib/math/iready";
import { MATH_SKILLS } from "@/lib/math";

const DAY = "2026-09-25";
// Noon in Chicago on DAY.
const AT = "2026-09-25T17:00:00.000Z";

function beats(done: BeatId[] = [], noHref: BeatId[] = []): PlanBeat[] {
  return PLAN_ORDER.map((id) => ({
    id,
    name: id,
    blurb: "",
    icon: "star",
    href: noHref.includes(id) ? null : `/${id}`,
    done: done.includes(id),
  }));
}

const blank = { correct: 0, wrong: 0, streak: 0, lastAt: null, dueAt: "" };
const unit = {
  _id: "u1",
  name: "Unit 1",
  updatedAt: AT,
  wordCount: 1,
  pathProgress: {},
  words: [{ word: "brave", skills: { recognize: blank, listen: blank, spell: blank, use: blank } }],
} as unknown as ListSummary;

test("the plan alternates subjects: review, reading, math, new words, structure, write", () => {
  assert.deepEqual([...PLAN_ORDER], ["review", "read", "math", "new", "structure", "production"]);
});

test("Start opens the first unfinished beat in plan order", () => {
  assert.equal(nextBeat(beats())?.id, "review");
  assert.equal(nextBeat(beats(["review"]))?.id, "read");
  assert.equal(nextBeat(beats(["review", "read", "new"]))?.id, "math");
  // Done out of order: the earliest gap comes first.
  assert.equal(nextBeat(beats(["read", "math"]))?.id, "review");
  assert.equal(nextBeat(beats([...PLAN_ORDER])), null);
});

test("a beat he cannot open yet is skipped", () => {
  const noLists: BeatId[] = ["review", "read", "new", "production"];
  assert.equal(nextBeat(beats([], noLists))?.id, "math");
  assert.equal(nextBeat(beats(["math", "structure"], noLists)), null);
});

test("a finish screen counts its own beat done and names the next one", () => {
  const p = planProgress(beats(["review"]), "read", DAY);
  assert.equal(p.done, 2);
  assert.equal(p.total, 6);
  assert.deepEqual(p.next, { id: "math", label: "Next: math", href: "/math" });
  assert.equal(p.beats.find((b) => b.id === "read")?.current, true);
  assert.equal(p.beats.find((b) => b.id === "read")?.done, true);
  assert.equal(p.day, DAY);
});

test("the last beat of the day goes back to Learn", () => {
  const p = planProgress(beats(["review", "read", "math", "new", "structure"]), "production", DAY);
  assert.equal(p.done, 6);
  assert.deepEqual(p.next, { id: null, label: "All done — back to Learn", href: "/" });
  // Doing a beat again after the day is done also lands there.
  const again = planProgress(beats([...PLAN_ORDER]), "math", DAY);
  assert.equal(again.next.label, "All done — back to Learn");
  // Nothing left he can open, but not all done: just back to Learn.
  const stuck = planProgress(beats(["math"], ["review", "read", "new", "production"]), "structure", DAY);
  assert.equal(stuck.next.label, "Back to Learn");
});

test("the cheer follows the count", () => {
  assert.equal(planCheer(3, 6), "3 of 6 done — keep going!");
  assert.equal(planCheer(5, 6), "5 of 6 done — one to go!");
  assert.equal(planCheer(6, 6), "All done today! Amazing work!");
});

test("done flags read today's activity the way Home always has", () => {
  const act = (ref: string, kind: "vocab" | "math" | "reading", at = AT) => ({ at, ref, kind });
  const flags = doneToday(
    [
      act("quest:review", "vocab"),
      act("read:u1@2026-09-25T10:00:00.000Z", "reading"),
      act("drill:math:place-value:quick", "math"), // a drill is not the math beat
      act("tables:7", "math"),
      act("read:structure", "reading"),
      // Yesterday in Chicago: does not count today.
      act("quest:production", "vocab", "2026-09-25T03:00:00.000Z"),
    ],
    DAY
  );
  assert.deepEqual(flags, {
    review: true,
    read: true,
    math: false,
    new: false,
    structure: true,
    production: false,
  });
  assert.equal(doneToday([act("math:fractions", "math")], DAY).math, true);
  assert.equal(doneToday([act("u1:read", "vocab")], DAY).read, true);
});

const metSkill = { correct: 1, wrong: 0, streak: 1, lastAt: AT, dueAt: AT };
const metUnit = {
  ...unit,
  words: [
    ...unit.words,
    { word: "calm", skills: { recognize: metSkill, listen: blank, spell: blank, use: blank } },
  ],
} as unknown as ListSummary;

test("the beats link straight into a lesson, math included", () => {
  const b = planBeats({ activity: [], lists: [metUnit], mathLevels: {}, today: DAY });
  assert.deepEqual(
    b.map((x) => x.id),
    [...PLAN_ORDER]
  );
  const href = Object.fromEntries(b.map((x) => [x.id, x.href]));
  assert.equal(href.review, "/learn/today/review");
  assert.equal(href.read, "/learn/u1/read");
  assert.match(href.math ?? "", /^\/math\/[a-z-]+$/);
  assert.equal(href.new, "/learn/today/new-words");
  assert.equal(href.structure, "/learn/structure");
  assert.equal(href.production, "/learn/today/production");

  const none = planBeats({ activity: [], lists: [], mathLevels: {}, today: DAY });
  assert.deepEqual(
    none.filter((x) => x.href).map((x) => x.id),
    ["math", "structure"]
  );
  // A list with no words is no unit: its beats would open an empty lesson.
  const empty = { ...unit, words: [] } as unknown as ListSummary;
  assert.deepEqual(
    planBeats({ activity: [], lists: [empty], mathLevels: {}, today: DAY })
      .filter((x) => x.href)
      .map((x) => x.id),
    ["math", "structure"]
  );
});

test("Review waits until he has met a word, so Start never lands on an empty one", () => {
  const b = planBeats({ activity: [], lists: [unit], mathLevels: {}, today: DAY });
  const review = b.find((x) => x.id === "review");
  assert.equal(review?.href, null);
  assert.equal(review?.lockedBlurb, "After New words");
  assert.equal(nextBeat(b)?.id, "read");
});

test("math is the school lesson's skill in the year, a lowest-level skill after it", () => {
  assert.ok(currentLesson(DAY).skills.includes(mathSkillFor(DAY, {})));
  const summer = "2027-07-01";
  const levels = Object.fromEntries(MATH_SKILLS.map((s) => [s.id, 3]));
  levels["fractions"] = 2;
  assert.equal(mathSkillFor(summer, levels), "fractions");
});

test("New words does not promise new words once every word is met", () => {
  const allMet = { ...metUnit, words: metUnit.words.slice(1) } as unknown as ListSummary;
  const blurb = (lists: ListSummary[]) =>
    planBeats({ activity: [], lists, mathLevels: {}, today: DAY }).find((x) => x.id === "new")?.blurb;
  assert.equal(blurb([metUnit]), "Three new words");
  assert.equal(blurb([allMet]), "Practise your words");
});
