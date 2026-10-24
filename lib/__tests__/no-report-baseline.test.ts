// The guarantee behind the school report card: a child with no report entered
// gets exactly the app he had before it existed. This snapshot was taken from
// the code as it stood before any report-card change (2026-10-24), over a
// school year of dates, every reading level and quarter, and seeded lessons.
// If a change moves any of it for a child with no report, this test fails.
//
// Regenerate only when a change is MEANT to move behaviour for everyone:
//   UPDATE_BASELINE=1 npx tsx --test lib/__tests__/no-report-baseline.test.ts

import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { mathSkillFor, planBeats } from "@/lib/daily-plan-beats";
import type { LessonItem } from "@/lib/items";
import { buildLesson, buildProductionSession } from "@/lib/lesson-builder";
import type { ListSummary } from "@/lib/lists";
import { mulberry32 } from "@/lib/math/rng";
import type { ClientWord, SkillState } from "@/lib/models/WordList";
import { questionPlan } from "@/lib/reading";

const FIXTURE = join(__dirname, "fixtures", "no-report-baseline.json");
const NOW = new Date("2026-10-24T17:00:00.000Z");

function skill(streak: number): SkillState {
  return { correct: streak, wrong: 0, streak, lastAt: streak ? NOW.toISOString() : null, dueAt: NOW.toISOString() };
}

function word(name: string, streak: number): ClientWord {
  return {
    word: name,
    clue: `${name} clue`,
    arabic: "كلمة",
    explanation: `to ${name} something`,
    examples: [`He likes to ${name} at school.`, `We ${name} every day.`, `Can you ${name} with me?`],
    family: [`${name}s`, `${name}ed`],
    srs: { interval: 0, dueAt: NOW.toISOString(), lastReviewed: null, reviewCount: streak, easyCount: 0, hardCount: 0 },
    skills: { recognize: skill(streak), listen: skill(streak), spell: skill(streak), use: skill(streak) },
  };
}

const WORDS = ["brave", "calm", "habitat", "predator", "survive", "shelter", "camouflage", "migrate"].map((w, i) =>
  word(w, i % 3)
);

const unit = {
  _id: "u1",
  name: "Unit 1",
  updatedAt: NOW.toISOString(),
  wordCount: WORDS.length,
  pathProgress: {},
  words: WORDS.map((w) => ({ word: w.word, skills: w.skills, reviewCount: w.srs.reviewCount })),
} as unknown as ListSummary;

/** Every day of the school year and the summer after, one in three. */
function days(): string[] {
  const out: string[] = [];
  for (let t = Date.parse("2026-08-01T12:00:00Z"); t <= Date.parse("2027-07-31T12:00:00Z"); t += 3 * 86_400_000) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

function itemKey(i: LessonItem): string {
  return [i.kind, i.word ?? "", "answer" in i ? String(i.answer) : "", "part" in i ? String(i.part) : ""].join("|");
}

function snapshot() {
  const levels = { "place-value": 2, "number-forms": 1 };
  return {
    mathSkill: days().map((d) => `${d} ${mathSkillFor(d, levels)}`),
    planHrefs: ["2026-09-25", "2026-10-24", "2026-11-20", "2027-02-15", "2027-06-10"].map((d) =>
      planBeats({ activity: [], lists: [unit], mathLevels: levels, today: d }).map((b) => `${b.id} ${b.href}`)
    ),
    newWords: [1, 2, 3, 4, 5].map((seed) =>
      buildLesson({ words: WORDS, step: "match", now: NOW, rng: mulberry32(seed), maxNew: 3, listId: "u1" }).map(itemKey)
    ),
    production: [1, 2, 3, 4, 5].map((seed) =>
      buildProductionSession({ words: WORDS, now: NOW, rng: mulberry32(seed), listId: "u1" }).map(itemKey)
    ),
    questionPlans: [1, 3, 4, 5, 7, 10].flatMap((level) =>
      (["story", "info"] as const).flatMap((kind) =>
        [false, true].flatMap((science) =>
          (["summer", "Q1", "Q2", "Q3", "Q4"] as const).map(
            (q) =>
              `${level} ${kind} ${science} ${q}: ` +
              questionPlan(level, kind, science, q)
                .map((s) => `${s.type}/${s.format}`)
                .join(",")
          )
        )
      )
    ),
  };
}

test("with no report card, the quest, lessons and reading questions are what they were", () => {
  const now = snapshot();
  if (process.env.UPDATE_BASELINE) {
    writeFileSync(FIXTURE, `${JSON.stringify(now, null, 1)}\n`);
    return;
  }
  const before = JSON.parse(readFileSync(FIXTURE, "utf8"));
  assert.deepEqual(now, before);
});
