import assert from "node:assert/strict";
import { test } from "node:test";

import { PATCH } from "@/app/api/lists/[id]/route";
import { judgeAnswer } from "@/lib/answer-check";
import {
  makeCloze,
  makeContextClue,
  makePickSentence,
  makeRecognize,
  makeSpell,
  makeWordForm,
  makeWordPartMeaning,
  makeWrite,
  oneEntryPerWord,
  tooClose,
  usableExamples,
  type LessonItem,
} from "@/lib/items";
import { buildLesson, writeItWords } from "@/lib/lesson-builder";
import { mulberry32 } from "@/lib/math/rng";
import type { ClientWord, SkillState, WordSkills } from "@/lib/models/WordList";
import { newChain, type ChainState } from "@/lib/spell-chain";
import { packById } from "@/lib/word-packs";

// Fixes from the 2026-09-28 vocabulary review. Each test was written to fail
// on the code as it stood, then the fix made it pass.

const NOW = new Date("2026-09-20T15:00:00.000Z");
const DAY = 86_400_000;

function skill(o: Partial<SkillState> = {}): SkillState {
  return { correct: 0, wrong: 0, streak: 0, lastAt: null, dueAt: NOW.toISOString(), ...o };
}

function skills(o: Partial<Record<keyof WordSkills, Partial<SkillState>>> = {}): WordSkills {
  return { recognize: skill(o.recognize), listen: skill(o.listen), spell: skill(o.spell), use: skill(o.use) };
}

function word(name: string, o: Partial<ClientWord> = {}): ClientWord {
  return {
    word: name,
    clue: `${name} clue`,
    arabic: "كلمة",
    explanation: "",
    examples: [`He likes to ${name} at school.`, `We ${name} every day.`, `Can you ${name} with me?`],
    family: [],
    srs: { interval: 0, dueAt: NOW.toISOString(), lastReviewed: null, reviewCount: 0, easyCount: 0, hardCount: 0 },
    skills: skills(),
    ...o,
  };
}

/** Practised, every skill at `streak`, due in `dueInDays`. */
function seen(name: string, streak = 1, dueInDays = 3, o: Partial<ClientWord> = {}): ClientWord {
  const st = () =>
    skill({ correct: streak, streak, lastAt: NOW.toISOString(), dueAt: new Date(NOW.getTime() + dueInDays * DAY).toISOString() });
  return word(name, { skills: { recognize: st(), listen: st(), spell: st(), use: st() }, ...o });
}

/** The Growing Plants pack with its own clues and ordinary AI-style sentences. */
const PLANT_SENTENCES: Record<string, string[]> = {
  seed: ["I planted a seed in a cup.", "The seed began to grow.", "A seed is very small."],
  soil: ["The soil is dark and wet.", "Plants grow in soil.", "We dug in the soil."],
  compost: ["We put compost on the garden.", "Old leaves turn into compost.", "Compost helps the soil."],
  fertilizer: ["Dad put fertilizer on the garden.", "The fertilizer made the corn grow tall.", "Fertilizer is plant food."],
  nutrients: ["Plants take nutrients from the soil.", "Food gives your body nutrients.", "The nutrients help the roots grow."],
  mass: ["We measured the mass of the plant.", "The mass of the rock did not change.", "A scale shows mass in grams."],
  variable: ["Water was the variable in our test.", "Change only one variable at a time.", "The variable we changed was light."],
  "fair test": ["We ran a fair test with two plants.", "A fair test changes only one thing.", "Is this a fair test?"],
  hypothesis: ["My hypothesis is that the plant will grow.", "We wrote a hypothesis before the test.", "The data proved our hypothesis right."],
  experiment: ["We did an experiment with seeds.", "The experiment took two weeks.", "Our experiment used three cups."],
  data: ["We wrote the data in a chart.", "The data shows the plant grew.", "Look at the data from Monday."],
  observe: ["We will observe the plant every day.", "Scientists observe things closely.", "Did you observe any change?"],
  conclusion: ["Our conclusion was that plants need light.", "Write your conclusion at the end.", "The conclusion comes after the data."],
  sprout: ["The bean will sprout in a week.", "A green sprout came up.", "Seeds sprout in warm soil."],
};

function plantWords(): ClientWord[] {
  const pack = packById("growing-plants");
  assert.ok(pack);
  return pack.words.map((p) => word(p.word, { clue: p.clue, examples: PLANT_SENTENCES[p.word] }));
}

function wordIn(text: string, w: string): RegExp {
  return new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
}

// ── V1: pick the sentence ─────────────────────────────────────────────────

test("pick-sentence never borrows a close word's sentence as the wrong use", () => {
  const words = plantWords();
  let built = 0;
  for (const target of words) {
    for (let seed = 1; seed <= 150; seed++) {
      const item = makePickSentence(target, { words }, mulberry32(seed));
      if (!item) continue;
      built++;
      assert.equal(new Set(item.options).size, 4, `${target.word}: ${item.options.join(" | ")}`);
      assert.ok(item.options.includes(item.answer));
      for (const option of item.options) {
        if (option === item.answer) continue;
        const donors = words.filter(
          (w) => w !== target && usableExamples(w).some((s) => s.replace(wordIn(s, w.word), target.word) === option)
        );
        assert.ok(donors.length > 0, `no donor for "${option}"`);
        for (const d of donors) {
          assert.ok(!tooClose(target, d), `${target.word} took ${d.word}'s sentence: "${option}"`);
        }
      }
    }
  }
  assert.ok(built > 0, "no pick-sentence item was built at all");
});

test("compost is never offered as a 'wrong' use in fertilizer's sentence", () => {
  const words = plantWords();
  const compost = words.find((w) => w.word === "compost")!;
  for (let seed = 1; seed <= 500; seed++) {
    const item = makePickSentence(compost, { words }, mulberry32(seed));
    if (!item) continue;
    for (const o of item.options) assert.ok(!/garden|corn|plant food/.test(o) || o === item.answer, o);
  }
});

test("a wrong use puts the word in a place for another kind of word: a verb where a noun goes", () => {
  const words = plantWords();
  const observe = words.find((w) => w.word === "observe")!;
  let built = 0;
  for (let seed = 1; seed <= 100; seed++) {
    const item = makePickSentence(observe, { words }, mulberry32(seed));
    if (!item) continue;
    built++;
    for (const o of item.options) {
      if (o === item.answer) continue;
      // "observe" is a verb ("will observe"); every wrong use puts it after a/an/the/my...
      assert.match(o, /\b(a|an|the|this|these|those|my|your|his|her|its|our|their|some|any|every|each|no|much|many) observe\b/i, o);
    }
  }
  assert.ok(built > 0);
  // "sprout" is a noun too ("a green sprout"), so no place is surely wrong for it.
  const sprout = words.find((w) => w.word === "sprout")!;
  for (let seed = 1; seed <= 20; seed++) assert.equal(makePickSentence(sprout, { words }, mulberry32(seed)), null);
});

// ── V2: word form ─────────────────────────────────────────────────────────

const HELP = {
  clue: "to make a job easier for someone",
  examples: [
    "Can you help me carry this box?",
    "She helped her brother with his math.",
    "The map was very helpful on our trip.",
  ],
};

test("word form never offers another tense of the answer: helped and helps both fit", () => {
  const help = word("help", { ...HELP, family: ["helps", "helped", "helpful"] });
  const tenses = new Set(["help", "helps", "helped"]);
  for (let seed = 1; seed <= 2000; seed++) {
    const item = makeWordForm(help, { words: [help] }, mulberry32(seed));
    assert.ok(item, `seed ${seed}`);
    assert.equal(new Set(item.options).size, 4);
    if (tenses.has(item.answer)) {
      const others = item.options.filter((o) => o !== item.answer && tenses.has(o));
      assert.deepEqual(others, [], `"${item.sentence}" answer ${item.answer} also offers ${others.join(", ")}`);
    }
  }
});

test("a tense can still be the answer when the family has enough other kinds of form", () => {
  const help = word("help", { ...HELP, family: ["helps", "helped", "helpful", "helper", "helpless"] });
  const answers = new Set<string>();
  for (let seed = 1; seed <= 400; seed++) {
    const item = makeWordForm(help, { words: [help] }, mulberry32(seed));
    assert.ok(item);
    answers.add(item.answer);
    assert.equal(new Set(item.options).size, 4);
    if (item.answer === "helped") {
      assert.ok(!item.options.includes("help") && !item.options.includes("helps"), item.options.join("/"));
    }
  }
  assert.ok(answers.has("helped"), [...answers].join(","));
});

test("word form with too few honest options is not built", () => {
  const brave = word("brave", { family: ["bravely", "bravery"], examples: ["The brave dog acted bravely."] });
  assert.equal(makeWordForm(brave, { words: [brave] }, mulberry32(2)), null);
  const dup = word("help", { family: ["helps", "Helps", "helped"], examples: ["She helps me."] });
  assert.equal(makeWordForm(dup, { words: [dup] }, mulberry32(3)), null);
});

// ── V3: the parent's clue wins over the AI explanation ────────────────────

test("questions show the parent's clue, not the AI explanation", () => {
  const pack = packById("math-vocabulary")!;
  const pv = pack.words.find((w) => w.word === "place value")!;
  const w = word("place value", { clue: pv.clue, explanation: "the value a digit has because of its place" });
  const others = ["digit", "period", "compare", "round"].map((x) => word(x, { clue: pack.words.find((p) => p.word === x)!.clue }));
  const r = makeRecognize(w, { words: [w, ...others] }, mulberry32(1));
  assert.equal(r?.clue, pv.clue);
  const helpful = word("helpful", { clue: "Ready to do things for other people.", explanation: "always ready to help others" });
  assert.equal(makeSpell(helpful, { words: [helpful] }, mulberry32(2)).hint, "Ready to do things for other people.");
  assert.equal(makeWrite(helpful, { words: [helpful] }).meaning, "Ready to do things for other people.");
});

test("an explanation that names the word is never the question", () => {
  const helpful = word("helpful", { clue: "", explanation: "always ready to help others" });
  assert.equal(makeRecognize(helpful, { words: [helpful] }, mulberry32(1)), null);
  assert.equal(makeWrite(helpful, { words: [helpful] }).meaning, "");
  // One that does not name it is still used when there is no clue.
  const calm = word("calm", { clue: "", explanation: "feeling relaxed, not worried" });
  assert.equal(makeRecognize(calm, { words: [calm] }, mulberry32(1))?.clue, "feeling relaxed, not worried");
});

// ── V5: one entry per word ────────────────────────────────────────────────

test("a word saved twice, in any case, is kept once, and the copy with progress survives", () => {
  const rows = [{ word: "brave" }, { word: "Brave " }, { word: "calm" }, { word: "brave" }];
  assert.deepEqual(oneEntryPerWord(rows).map((r) => r.word), ["brave", "calm"]);

  const stored = [
    { word: "brave", answers: 0 },
    { word: "calm", answers: 2 },
    { word: "brave", answers: 5 },
  ];
  const kept = oneEntryPerWord(stored, (later, first) => later.answers > first.answers);
  assert.deepEqual(kept, [
    { word: "brave", answers: 5 },
    { word: "calm", answers: 2 },
  ]);
});

// ── V8: saving the Stuck-words pool, and errors a person can read ─────────

const LIST_ID = "64b000000000000000000001";

async function patch(body: unknown, id = LIST_ID): Promise<Response | null> {
  const req = new Request(`http://x/api/lists/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  // Past validation the route needs a signed-in request and the database,
  // which a unit test has neither of. Throwing there means it got past.
  return PATCH(req, { params: Promise.resolve({ id }) }).catch(() => null);
}

test("every refused save says what is wrong in a sentence", async () => {
  const bad = await patch({ words: [{ word: "calm", clue: "" }, { word: "br@ve", clue: "" }] });
  assert.equal(bad?.status, 400);
  const body = (await bad!.json()) as { error: unknown };
  assert.equal(typeof body.error, "string");
  assert.match(body.error as string, /br@ve/);

  for (const res of [await patch({ words: [] }, "nope"), await patch("{not json")]) {
    assert.equal(res?.status, 400);
    assert.equal(typeof ((await res!.json()) as { error: unknown }).error, "string");
  }
});

test("a 72-word pool save is not refused by the size check before the list is read", async () => {
  const words = Array.from({ length: 72 }, (_, i) => ({ word: `word${"abcdefghij"[i % 10]}${"abcdefghij"[Math.floor(i / 10)]}`, clue: "a clue" }));
  const res = await patch({ name: "Words to fix", words });
  assert.ok(res === null || res.status !== 400, "refused before the list kind was known");
});

// ── V6, V7, V19: judging typed answers ────────────────────────────────────

test("cant and wont typed without the apostrophe are can not and will not", () => {
  const q = "What is wrong with the bird?";
  assert.equal(judgeAnswer("it cant fly", ["It cannot fly."], q).verdict, "correct");
  assert.equal(judgeAnswer("it wont fly", ["It will not fly."], q).verdict, "correct");
  assert.notEqual(judgeAnswer("they wont", ["They will not come back."], "What will the birds do now?").verdict, "correct");
});

test("Omar is Omar's: a possessive is the name it belongs to", () => {
  assert.equal(judgeAnswer("Omar", ["It was Omar's hat."], "Whose hat was it?").verdict, "correct");
  assert.equal(judgeAnswer("Sara", ["Sara's"], "Whose idea was the lemonade stand?").verdict, "correct");
  assert.equal(judgeAnswer("Omar’s", ["Omar"], "Whose hat was it?").verdict, "correct");
  // Contractions still behave.
  assert.equal(judgeAnswer("it's dry", ["It is dry."], "What was the soil like?").verdict, "correct");
  assert.equal(judgeAnswer("it's not dry", ["It is dry."], "What was the soil like?").verdict, "wrong");
  assert.equal(judgeAnswer("that's a seed", ["That is a seed."], "What did she find?").verdict, "correct");
});

test("an extra 'not' about something else does not turn a right answer wrong", () => {
  const q = "How did the dog feel?";
  assert.notEqual(judgeAnswer("the dog was hungry, not sleepy", ["The dog was hungry."], q).verdict, "wrong");
  assert.notEqual(judgeAnswer("he was hungry and not tired", ["He was hungry."], q).verdict, "wrong");
  assert.notEqual(judgeAnswer("not sleepy, the dog was hungry", ["The dog was hungry."], q).verdict, "wrong");
  // A real contradiction is still wrong, either way round.
  assert.equal(judgeAnswer("the dog was not hungry", ["The dog was hungry."], q).verdict, "wrong");
  assert.equal(judgeAnswer("he was never hungry", ["He was hungry."], q).verdict, "wrong");
  assert.equal(judgeAnswer("the seeds got water", ["The seeds got no water."], "Why did the seeds die?").verdict, "wrong");
  assert.equal(judgeAnswer("the seeds did get water", ["The seeds did not get water."], "Why did the seeds die?").verdict, "wrong");
});

// ── V9, V15: meanings and fillers that are also right ─────────────────────

test("context clue never offers a close word's meaning as a wrong one", () => {
  const words = plantWords();
  for (const target of words) {
    const close = words.filter((w) => w !== target && tooClose(target, w)).map((w) => w.clue);
    for (let seed = 1; seed <= 60; seed++) {
      const item = makeContextClue(target, { words }, mulberry32(seed));
      if (!item) continue;
      for (const o of item.options) {
        if (o !== item.answer) assert.ok(!close.includes(o), `${target.word} offered "${o}"`);
      }
    }
  }
  const compost = words.find((w) => w.word === "compost")!;
  const fertilizer = words.find((w) => w.word === "fertilizer")!;
  for (let seed = 1; seed <= 300; seed++) {
    const item = makeContextClue(compost, { words }, mulberry32(seed));
    assert.ok(item);
    assert.ok(!item.options.includes(fertilizer.clue), `seed ${seed}`);
  }
});

test("filler words and meanings on a tiny list pass the same closeness check", () => {
  const calm = word("calm", { clue: "Feeling quiet and relaxed, not upset." });
  for (let seed = 1; seed <= 500; seed++) {
    const r = makeRecognize(calm, { words: [calm] }, mulberry32(seed));
    assert.ok(r);
    assert.equal(r.options.length, 4);
    assert.ok(!r.options.includes("quiet"), `seed ${seed}: ${r.options.join("/")}`);
  }
  const protect = word("protect", { clue: "To keep something safe from harm.", examples: ["A helmet will protect your head."] });
  for (let seed = 1; seed <= 500; seed++) {
    const c = makeContextClue(protect, { words: [protect] }, mulberry32(seed));
    assert.ok(c);
    assert.equal(new Set(c.options).size, 4);
    assert.ok(!c.options.includes("to keep something safe"), `seed ${seed}`);
  }
});

// ── V12: word parts that mean the same ────────────────────────────────────

test("word-part meaning never offers a second option with the same core meaning", () => {
  const family = (m: string) =>
    /^not\b/.test(m) ? "not" : /^makes a noun/.test(m) ? "noun" : /^can be done/.test(m) ? "can" : /^a person/.test(m) ? "person" : /^(look|see)$/.test(m) ? "look" : m;
  for (let seed = 1; seed <= 5000; seed++) {
    const item = makeWordPartMeaning({ words: [] }, mulberry32(seed));
    assert.ok(item);
    assert.equal(new Set(item.options).size, 4);
    const rivals = item.options.filter((o) => o !== item.answer && family(o) === family(item.answer));
    assert.deepEqual(rivals, [], `${item.part}: "${item.answer}" beside ${rivals.join(", ")}`);
  }
});

// ── V14: a blank with the word still showing ──────────────────────────────

test("a cloze never uses a sentence that holds the word twice", () => {
  const layer = word("layer", {
    examples: ["Each layer of rock is older than the layer on top.", "A layer of dust covered the shelf."],
  });
  for (let seed = 1; seed <= 50; seed++) {
    const item = makeCloze(layer, { words: [layer] }, mulberry32(seed));
    assert.equal(item?.sentence, "A ____ of dust covered the shelf.");
  }
  const only = word("layer", { examples: ["Each layer of rock is older than the layer on top."] });
  assert.equal(makeCloze(only, { words: [only] }, mulberry32(1)), null);
});

// ── V10: a new word with no meaning yet ───────────────────────────────────

function sameShape(a: LessonItem, b: LessonItem): boolean {
  const v = (i: LessonItem) => ("variant" in i ? i.variant : "");
  return a.kind === b.kind && v(a) === v(b);
}

test("a new word with no meaning does not get the same listen question twice in a row", () => {
  const others = ["plant", "climb", "brush", "count", "shout"].map((w) => seen(w));
  for (const examples of [undefined, [] as string[]]) {
    const bare = word("canyon", { clue: "", explanation: "", ...(examples ? { examples } : {}) });
    for (const step of ["match", "listen", "spell", "use"] as const) {
      for (let seed = 1; seed <= 20; seed++) {
        const lesson = buildLesson({ words: [bare, ...others], step, now: NOW, rng: mulberry32(seed) });
        assert.equal(lesson[0].kind, "learn-card");
        const block = lesson.slice(1, 4);
        assert.ok(block.every((i) => i.word === "canyon"), `${step}: ${block.map((i) => i.kind).join(",")}`);
        for (let i = 0; i < block.length; i++) {
          for (let j = i + 1; j < block.length; j++) {
            assert.ok(!sameShape(block[i], block[j]), `${step}/${seed}: ${block.map((x) => x.kind).join(",")}`);
          }
        }
      }
    }
  }
});

// ── V16: the Arabic gloss fades on the ladder, not on a legacy field ─────

test("the Arabic gloss fades once recognize and listen are both on their harder rung", () => {
  const fresh = word("canyon");
  assert.equal(makeWrite(fresh, { words: [fresh] }).glossFaded, false);
  // srs.interval is only written by an old route; it must not decide.
  const legacy = word("canyon", { srs: { ...fresh.srs, interval: 30 } });
  assert.equal(makeWrite(legacy, { words: [legacy] }).glossFaded, false);
  const mastered = seen("canyon", 5, 30);
  assert.equal(makeRecognize(mastered, { words: [mastered] }, mulberry32(1))?.glossFaded, true);
  assert.equal(makeWrite(mastered, { words: [mastered] }).glossFaded, true);
  const halfway = word("canyon", { skills: skills({ recognize: { streak: 2, correct: 2 }, listen: { streak: 1, correct: 1 } }) });
  assert.equal(makeWrite(halfway, { words: [halfway] }).glossFaded, false);
});

// ── V18: a word-part question is not the list word's recognize result ────

test("a word-part question built from a list word does not carry that word", () => {
  const transfer = seen("transfer");
  const item = makeWordPartMeaning({ words: [transfer], listId: "L1" }, mulberry32(1), transfer);
  assert.ok(item);
  assert.equal(item.part, "trans-");
  assert.equal(item.word, undefined);
});

// ── V21: Write It picks words that still need their chain ─────────────────

test("Write It skips finished chains that are not due while other words wait", () => {
  const words = ["alpha", "bravo", "charlie", "delta", "echo"].map((w, i) =>
    // The finished ones have the weakest spell streak, so need alone picks them.
    seen(w, i < 3 ? 0 : 2, 3)
  );
  const finished = (w: string): ChainState => ({
    ...newChain(w),
    current: 10,
    best: 10,
    reps: 10,
    attempts: 10,
    graduatedAt: NOW.toISOString(),
    dueAt: new Date(NOW.getTime() + 5 * DAY).toISOString(),
  });
  const chains: Record<string, ChainState> = {
    alpha: finished("alpha"),
    bravo: finished("bravo"),
    charlie: { ...finished("charlie"), dueAt: new Date(NOW.getTime() - DAY).toISOString() },
    delta: newChain("delta"),
    echo: newChain("echo"),
  };
  for (let seed = 1; seed <= 30; seed++) {
    const picked = writeItWords(words, chains, NOW, mulberry32(seed));
    assert.equal(picked.length, 3);
    assert.deepEqual([...picked].sort(), ["charlie", "delta", "echo"], `seed ${seed}`);
  }
  // Everything resting: the step still has words to write.
  const allDone = Object.fromEntries(words.map((w) => [w.word, finished(w.word)]));
  assert.equal(writeItWords(words, allDone, NOW, mulberry32(1)).length, 3);
});
