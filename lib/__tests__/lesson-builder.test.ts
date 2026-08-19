import assert from "node:assert/strict";
import test from "node:test";

import {
  gradeTyped,
  gradeItem,
  latinPartsOf,
  levenshtein,
  makeWrite,
  usableExamples,
  type AnswerableItem,
  type LessonItem,
} from "@/lib/items";
import {
  CHALLENGE_SIZE,
  LESSON_SIZE,
  buildLesson,
  buildProductionSession,
  buildReviewSession,
  countForWord,
  isNewWord,
  reEnqueue,
  stepSkill,
} from "@/lib/lesson-builder";
import { mulberry32 } from "@/lib/math/rng";
import type { ClientWord, SkillState, WordSkills } from "@/lib/models/WordList";

const NOW = new Date("2026-08-19T10:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

function skill(overrides: Partial<SkillState> = {}): SkillState {
  return {
    correct: 0,
    wrong: 0,
    streak: 0,
    lastAt: null,
    dueAt: NOW.toISOString(),
    ...overrides,
  };
}

function skills(overrides: Partial<Record<keyof WordSkills, Partial<SkillState>>> = {}): WordSkills {
  return {
    recognize: skill(overrides.recognize),
    listen: skill(overrides.listen),
    spell: skill(overrides.spell),
    use: skill(overrides.use),
  };
}

function word(name: string, overrides: Partial<ClientWord> = {}): ClientWord {
  return {
    word: name,
    clue: `${name} clue`,
    arabic: "كلمة",
    explanation: `to ${name} something`,
    examples: [
      `He likes to ${name} at school.`,
      `We ${name} every day.`,
      `Can you ${name} with me?`,
    ],
    family: [`${name}s`, `${name}ed`, `${name}ing`],
    srs: {
      interval: 0,
      dueAt: NOW.toISOString(),
      lastReviewed: null,
      reviewCount: 0,
      easyCount: 0,
      hardCount: 0,
    },
    skills: skills(),
    ...overrides,
  };
}

/** A word that has been practised: not new, nothing due yet. */
function seen(name: string, streak = 1, dueInDays = 3): ClientWord {
  const state = (): SkillState =>
    skill({
      correct: streak,
      streak,
      lastAt: NOW.toISOString(),
      dueAt: new Date(NOW.getTime() + dueInDays * DAY).toISOString(),
    });
  return word(name, {
    srs: {
      interval: 2,
      dueAt: new Date(NOW.getTime() + 2 * DAY).toISOString(),
      lastReviewed: NOW.toISOString(),
      reviewCount: 2,
      easyCount: 2,
      hardCount: 0,
    },
    skills: {
      recognize: state(),
      listen: state(),
      spell: state(),
      use: state(),
    },
  });
}

const SEEN_LIST = ["plant", "climb", "brush", "count", "shout", "trade"].map((w) => seen(w));

test("stepSkill maps the path steps", () => {
  assert.equal(stepSkill("match"), "recognize");
  assert.equal(stepSkill("listen"), "listen");
  assert.equal(stepSkill("spell"), "spell");
  assert.equal(stepSkill("use"), "use");
  assert.equal(stepSkill("challenge"), "mixed");
  assert.equal(stepSkill("flashcards"), null);
  assert.equal(stepSkill("read"), null);
});

test("isNewWord only for untouched words", () => {
  assert.equal(isNewWord(word("fresh")), true);
  assert.equal(isNewWord(seen("old")), false);
});

test("a lesson is 12 items and the challenge is 15", () => {
  const lesson = buildLesson({ words: SEEN_LIST, step: "match", now: NOW, rng: mulberry32(7) });
  assert.equal(lesson.length, LESSON_SIZE);
  const challenge = buildLesson({
    words: SEEN_LIST,
    step: "challenge",
    now: NOW,
    rng: mulberry32(7),
  });
  assert.equal(challenge.length, CHALLENGE_SIZE);
});

test("new words come as blocked mini-sets before any interleaved item", () => {
  const words = [word("gather"), word("shiver"), ...SEEN_LIST];
  const lesson = buildLesson({ words, step: "match", now: NOW, rng: mulberry32(3) });

  // Two learn cards, at the very front, each followed by 3 items on that word.
  assert.equal(lesson[0].kind, "learn-card");
  assert.equal(lesson[0].word, "gather");
  for (let i = 1; i <= 3; i++) assert.equal(lesson[i].word, "gather");
  assert.equal(lesson[4].kind, "learn-card");
  assert.equal(lesson[4].word, "shiver");
  for (let i = 5; i <= 7; i++) assert.equal(lesson[i].word, "shiver");

  // Nothing else in the lesson touches the new words.
  const after = lesson.slice(8);
  assert.equal(after.some((i) => i.word === "gather" || i.word === "shiver"), false);
  assert.equal(after.some((i) => i.kind === "learn-card"), false);
});

test("at most maxNew new words per lesson", () => {
  const words = [word("a1"), word("a2"), word("a3"), word("a4"), word("a5"), ...SEEN_LIST];
  const lesson = buildLesson({ words, step: "match", now: NOW, rng: mulberry32(11) });
  const cards = lesson.filter((i) => i.kind === "learn-card");
  assert.equal(cards.length, 3);

  const one = buildLesson({ words, step: "match", now: NOW, rng: mulberry32(11), maxNew: 1 });
  assert.equal(one.filter((i) => i.kind === "learn-card").length, 1);
});

test("every word in a lesson gets at least two items", () => {
  for (const seedNum of [1, 2, 3, 42, 99]) {
    for (const step of ["match", "listen", "spell", "use", "challenge"] as const) {
      const words = [word("gather"), ...SEEN_LIST];
      const lesson = buildLesson({ words, step, now: NOW, rng: mulberry32(seedNum) });
      const names = new Set(lesson.map((i) => i.word).filter(Boolean) as string[]);
      for (const name of names) {
        assert.ok(
          countForWord(lesson, name) >= 2,
          `${step}/${seedNum}: ${name} only got ${countForWord(lesson, name)} item(s)`
        );
      }
    }
  }
});

test("due skills are drilled before skills that are not due", () => {
  const dueWord = word("urgent", {
    srs: {
      interval: 4,
      dueAt: NOW.toISOString(),
      lastReviewed: NOW.toISOString(),
      reviewCount: 3,
      easyCount: 3,
      hardCount: 0,
    },
    skills: skills({
      recognize: { correct: 1, streak: 1, dueAt: new Date(NOW.getTime() - DAY).toISOString() },
      listen: { correct: 1, streak: 1, dueAt: new Date(NOW.getTime() - DAY).toISOString() },
      spell: { correct: 1, streak: 1, dueAt: new Date(NOW.getTime() - DAY).toISOString() },
      use: { correct: 1, streak: 1, dueAt: new Date(NOW.getTime() - DAY).toISOString() },
    }),
  });
  const words = [...SEEN_LIST.map((w) => seen(w.word, 3, 20)), dueWord];
  const lesson = buildLesson({ words, step: "match", now: NOW, rng: mulberry32(5) });
  assert.equal(lesson[0].word, "urgent");
});

test("the harder rung shows up once the streak reaches 2", () => {
  const easy = [seen("plant", 1), seen("climb", 1), seen("brush", 1)];
  const hard = [seen("plant", 3), seen("climb", 3), seen("brush", 3)];

  const easySpell = buildLesson({ words: easy, step: "spell", now: NOW, rng: mulberry32(2) });
  assert.equal(easySpell.every((i) => i.kind === "spell"), true);

  const hardSpell = buildLesson({ words: hard, step: "spell", now: NOW, rng: mulberry32(2) });
  assert.equal(hardSpell.every((i) => i.kind === "write"), true);

  const hardListen = buildLesson({ words: hard, step: "listen", now: NOW, rng: mulberry32(2) });
  assert.ok(hardListen.some((i) => i.kind === "listen" && i.variant === "type"));
});

test("the challenge mixes skills and teaches nothing new", () => {
  const words = [word("brandnew"), ...SEEN_LIST];
  const lesson = buildLesson({ words, step: "challenge", now: NOW, rng: mulberry32(8) });
  assert.equal(lesson.some((i) => i.kind === "learn-card"), false);
  const kinds = new Set(lesson.map((i) => i.skill));
  assert.ok(kinds.size >= 3, `expected mixed skills, got ${[...kinds].join(",")}`);
});

test("no two items in a row drill the same word (outside the blocked set)", () => {
  const lesson = buildLesson({ words: SEEN_LIST, step: "use", now: NOW, rng: mulberry32(13) });
  for (let i = 1; i < lesson.length; i++) {
    if (!lesson[i].word || !lesson[i - 1].word) continue;
    assert.notEqual(lesson[i].word, lesson[i - 1].word);
  }
});

test("review pulls due skills from every list and caps the size", () => {
  const overdue = (name: string) =>
    word(name, {
      srs: {
        interval: 3,
        dueAt: NOW.toISOString(),
        lastReviewed: NOW.toISOString(),
        reviewCount: 2,
        easyCount: 2,
        hardCount: 0,
      },
      skills: skills({
        recognize: { correct: 1, streak: 1, dueAt: new Date(NOW.getTime() - DAY).toISOString() },
        listen: { correct: 1, streak: 1, dueAt: new Date(NOW.getTime() - DAY).toISOString() },
        spell: { correct: 1, streak: 1, dueAt: new Date(NOW.getTime() - DAY).toISOString() },
        use: { correct: 1, streak: 1, dueAt: new Date(NOW.getTime() - DAY).toISOString() },
      }),
    });

  const items = buildReviewSession({
    lists: [
      { listId: "aaa", words: [overdue("river"), overdue("stone")] },
      { listId: "bbb", words: [overdue("cloud"), overdue("field")] },
    ],
    now: NOW,
    rng: mulberry32(4),
    cap: 8,
  });
  assert.equal(items.length, 8);
  assert.equal(new Set(items.map((i) => i.listId)).size, 2);
  assert.equal(items.every((i) => i.kind !== "learn-card"), true);
});

test("review still has work when nothing is due", () => {
  const items = buildReviewSession({
    lists: [{ listId: "aaa", words: SEEN_LIST }],
    now: NOW,
    rng: mulberry32(6),
  });
  assert.ok(items.length > 0);
  assert.ok(items.length <= 12);
});

test("production is 6 spell-and-use items", () => {
  const items = buildProductionSession({ words: SEEN_LIST, now: NOW, rng: mulberry32(9) });
  assert.equal(items.length, 6);
  assert.equal(items.every((i) => i.skill === "spell" || i.skill === "use"), true);
});

test("production types the word once its spell streak is 2", () => {
  const items = buildProductionSession({
    words: [seen("plant", 4), seen("climb", 4), seen("brush", 4)],
    now: NOW,
    rng: mulberry32(9),
  });
  assert.ok(items.some((i) => i.kind === "write"));
  assert.equal(items.some((i) => i.kind === "spell"), false);
});

test("reEnqueue puts a miss back 2 to 4 places later", () => {
  const queue = ["b", "c", "d", "e", "f"];
  for (const seedNum of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const next = reEnqueue(queue, "a", mulberry32(seedNum));
    const at = next.indexOf("a");
    assert.ok(at >= 2 && at <= 4, `landed at ${at}`);
    assert.equal(next.length, queue.length + 1);
  }
  assert.deepEqual(reEnqueue([], "a", mulberry32(1)), ["a"]);
  // A short queue takes the item at the end rather than dropping it.
  assert.deepEqual(reEnqueue(["b"], "a", mulberry32(1)), ["b", "a"]);
});

test("levenshtein counts single edits", () => {
  assert.equal(levenshtein("cat", "cat"), 0);
  assert.equal(levenshtein("cat", "cot"), 1);
  assert.equal(levenshtein("cat", "cart"), 1);
  assert.equal(levenshtein("cart", "cat"), 1);
  assert.equal(levenshtein("", "abc"), 3);
  assert.equal(levenshtein("kitten", "sitting"), 3);
});

test("typed spelling: exact is right, one letter off is almost, then wrong", () => {
  assert.equal(gradeTyped("garden", "garden"), "correct");
  assert.equal(gradeTyped("garden", " Garden "), "correct");
  assert.equal(gradeTyped("garden", "gardn"), "almost");
  assert.equal(gradeTyped("garden", "gardn", true), "wrong");
  assert.equal(gradeTyped("garden", "grass"), "wrong");
  // Short words get no second chance — one letter is most of the word.
  assert.equal(gradeTyped("cat", "cot"), "wrong");
});

test("choice items are exact match, write items use the typed grader", () => {
  const w = seen("garden", 3);
  const item = makeWrite(w, { words: [w] });
  assert.equal(gradeItem(item, "garden"), "correct");
  assert.equal(gradeItem(item, "gardan"), "almost");
  assert.equal(gradeItem(item, "gardan", true), "wrong");

  const lesson = buildLesson({ words: SEEN_LIST, step: "match", now: NOW, rng: mulberry32(1) });
  const choice = lesson.find((i) => i.kind === "recognize") as AnswerableItem;
  assert.equal(gradeItem(choice, choice.answer), "correct");
  assert.equal(gradeItem(choice, `${choice.answer}x`), "wrong");
});

test("latin parts split only when the split is safe", () => {
  assert.deepEqual(latinPartsOf("helpless"), ["help", "-less"]);
  assert.deepEqual(latinPartsOf("impossible"), ["im-", "possible"]);
  assert.deepEqual(latinPartsOf("rebuild"), ["re-", "build"]);
  assert.deepEqual(latinPartsOf("cat"), []);
  assert.deepEqual(latinPartsOf("under"), []);
});

test("typed dictation names the word parts in its feedback", () => {
  const w = seen("helpless", 3);
  const item = makeWrite(w, { words: [w] });
  assert.equal(item.parts.join("+"), "help+-less");
  assert.ok(item.feedback.includes("help + -less"));
});

test("cloze only uses example sentences that contain the word", () => {
  const w = word("climb", { examples: ["He can climb the tree.", "Nothing here.", ""] });
  assert.deepEqual(usableExamples(w), ["He can climb the tree."]);
});

test("a lesson with no words is empty, not broken", () => {
  const lesson: LessonItem[] = buildLesson({
    words: [],
    step: "match",
    now: NOW,
    rng: mulberry32(1),
  });
  assert.deepEqual(lesson, []);
});
