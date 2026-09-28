import assert from "node:assert/strict";
import { test } from "node:test";

import {
  COMBINE_SEEDS,
  makeCloze,
  makePickSentence,
  makeWordForm,
  tooClose,
  wordDistractors,
} from "@/lib/items";
import { mulberry32 } from "@/lib/math/rng";
import { packById } from "@/lib/word-packs";
import type { ClientWord } from "@/lib/models/WordList";

/**
 * The bug: "Which word means this?" showed the clue for one word with a
 * second word that also fit among the options, and marked that pick wrong.
 * Distractors come from the same list, and lists are built from one topic,
 * so near-synonyms are the rule, not the exception.
 */

function packWords(id: string): ClientWord[] {
  const pack = packById(id);
  assert.ok(pack, `no pack ${id}`);
  return pack.words.map((w) => ({
    word: w.word,
    clue: w.clue,
    arabic: "",
    explanation: "",
    examples: [],
    family: [],
    srs: { interval: 0, dueAt: "", lastReviewed: null, reviewCount: 0, easyCount: 0, hardCount: 0 },
    skills: {
      recognize: { correct: 0, wrong: 0, streak: 0, lastAt: null, dueAt: "" },
      listen: { correct: 0, wrong: 0, streak: 0, lastAt: null, dueAt: "" },
      spell: { correct: 0, wrong: 0, streak: 0, lastAt: null, dueAt: "" },
      use: { correct: 0, wrong: 0, streak: 0, lastAt: null, dueAt: "" },
    },
  }));
}

const by = (words: ClientWord[], w: string) => {
  const found = words.find((x) => x.word === w);
  assert.ok(found, `missing ${w}`);
  return found;
};

test("value never offers place value as a wrong answer", () => {
  const words = packWords("math-vocabulary");
  assert.ok(tooClose(by(words, "value"), by(words, "place value")));
  for (let seed = 1; seed <= 40; seed++) {
    const wrong = wordDistractors("value", words, mulberry32(seed));
    assert.ok(!wrong.includes("place value"), `seed ${seed} offered place value`);
    assert.equal(wrong.length, 3, "and it still fills the card");
  }
});

test("compost and fertilizer are not each other's distractors", () => {
  const words = packWords("growing-plants");
  assert.ok(tooClose(by(words, "compost"), by(words, "fertilizer")));
  for (let seed = 1; seed <= 40; seed++) {
    assert.ok(!wordDistractors("compost", words, mulberry32(seed)).includes("fertilizer"));
    assert.ok(!wordDistractors("fertilizer", words, mulberry32(seed)).includes("compost"));
  }
});

test("a word whose clue names the target is not its distractor, from any list", () => {
  // The review pool holds "fair test" twice: one clue says "a test where you
  // change only one thing", the other "an experiment that treats every part
  // the same". Offered beside "experiment" for "The ____ uses three cups of
  // water", both fit.
  const [template] = packWords("growing-plants");
  const entry = (word: string, clue: string): ClientWord => ({ ...template, word, clue });
  const pool = [
    entry("experiment", "A test you set up on purpose to answer a question."),
    entry("fair test", "A test where you change only one thing, so you know what caused the change."),
    entry("fair test", "An experiment that treats every part the same"),
    entry("hypothesis", "Your best guess about what will happen, made before you test it."),
    entry("conclusion", "What you decide the data shows, once the test is done."),
  ];
  assert.ok(tooClose(pool[0], pool[2]));
  for (let seed = 1; seed <= 40; seed++) {
    assert.ok(!wordDistractors("experiment", pool, mulberry32(seed)).includes("fair test"), `seed ${seed}`);
    assert.ok(!wordDistractors("fair test", pool, mulberry32(seed)).includes("experiment"), `seed ${seed}`);
  }
});

test("genuinely different words still serve as distractors", () => {
  const words = packWords("math-vocabulary");
  // Word form vs expanded form share the word "form" but describe different
  // things; each is a fair wrong answer for the other's clue.
  assert.equal(tooClose(by(words, "word form"), by(words, "expanded form")), false);
  assert.equal(tooClose(by(words, "digit"), by(words, "round")), false);
});

test("every pack can still build a full card for every word", () => {
  for (const id of ["math-vocabulary", "growing-plants", "number-words", "g5-matter", "g5-ecosystems", "g5-earth-systems", "g5-space", "g5-math-words", "g5-reading-words"]) {
    const words = packWords(id);
    for (const w of words) {
      const wrong = wordDistractors(w.word, words, mulberry32(7));
      assert.equal(wrong.length, 3, `${id}: ${w.word} could not fill its card`);
      assert.ok(!wrong.includes(w.word));
      for (const d of wrong) {
        const cand = words.find((x) => x.word === d);
        if (cand) assert.ok(!tooClose(w, cand), `${id}: ${w.word} offered ${d}`);
      }
    }
  }
});

test("a number word's blank shows its numeral, so only one number fits", () => {
  const words = packWords("number-words").map((w) => ({
    ...w,
    examples: [`We need ${w.word} more minutes to finish.`],
  }));
  const seventy = by(words, "seventy");
  for (let seed = 1; seed <= 20; seed++) {
    const item = makeCloze(seventy, { words, listId: "n" }, mulberry32(seed));
    assert.ok(item);
    assert.equal(item.sentence, "We need ____ (70) more minutes to finish.");
  }
  const fiftyFive = makeCloze(by(words, "fifty-five"), { words, listId: "n" }, mulberry32(1));
  assert.equal(fiftyFive?.sentence, "We need ____ (55) more minutes to finish.");
});

test("a number word never borrows another number's sentence as the wrong one", () => {
  const numbers = packWords("number-words").map((w) => ({
    ...w,
    examples: [`I counted ${w.word} birds.`],
  }));
  // With only number words on the list there is no honest wrong sentence.
  assert.equal(makePickSentence(by(numbers, "seventy"), { words: numbers, listId: "n" }, mulberry32(3)), null);
  const mixed = [
    ...numbers,
    ...packWords("growing-plants").map((w, i) => ({ ...w, examples: [`The ${w.word} sat on shelf ${i}.`] })),
  ];
  for (let seed = 1; seed <= 20; seed++) {
    const item = makePickSentence(by(mixed, "seventy"), { words: mixed, listId: "m" }, mulberry32(seed));
    assert.ok(item);
    const wrong = item.options.filter((o) => o !== item.answer);
    for (const o of wrong) assert.ok(!/birds/.test(o), `number sentence used as wrong: ${o}`);
  }
});

test("a word that is not a number keeps a plain blank", () => {
  const words = packWords("growing-plants").map((w) => ({ ...w, examples: [`The ${w.word} was in the garden.`] }));
  const item = makeCloze(by(words, "soil"), { words, listId: "g" }, mulberry32(1));
  assert.equal(item?.sentence, "The ____ was in the garden.");
});

test("word form: the answer is not always the base word, so not always the shortest", () => {
  // help / helps / helped / helpful. When the base was always the answer it
  // was also the one short option, and "pick the short one" won unread.
  const help: ClientWord = {
    ...packWords("growing-plants")[0],
    word: "help",
    clue: "to make a job easier for someone",
    family: ["helps", "helped", "helpful"],
    examples: [
      "Can you help me carry this box?",
      "She helped her brother with his math.",
      "The map was very helpful on our trip.",
    ],
  };
  const runs = 2000;
  let base = 0;
  let shortest = 0;
  for (let seed = 1; seed <= runs; seed++) {
    const item = makeWordForm(help, { words: [help] }, mulberry32(seed));
    assert.ok(item);
    assert.equal(item.options.length, 4);
    assert.ok(item.options.includes(item.answer));
    // The answer is the form the sentence really had in that blank.
    const filled = item.sentence.replace("____", item.answer).toLowerCase();
    assert.ok(help.examples.some((s) => s.toLowerCase() === filled), `${item.sentence} / ${item.answer}`);
    if (item.answer === "help") base++;
    if (item.options.every((o) => o === item.answer || o.length > item.answer.length)) shortest++;
  }
  assert.ok(base <= runs * 0.6, `the base word was the answer ${base} of ${runs} times`);
  assert.ok(shortest <= runs * 0.4, `the answer was the shortest option ${shortest} of ${runs} times`);
});

/** How one option joins the two sentences: which comes first, and with what. */
function joinShape(first: string, second: string, option: string) {
  const a = first.replace(/\.$/, "").toLowerCase();
  const b = second.replace(/\.$/, "").toLowerCase();
  const text = option.toLowerCase();
  const joiners = text.replace(a, " ").replace(b, " ").match(/[a-z]+/g) ?? [];
  return { swapped: text.indexOf(b) < text.indexOf(a), splice: joiners.length === 0, joiners };
}

const CONJUNCTIONS = ["because", "but", "so", "although", "while", "when", "since", "unless", "and", "or"];

test("sentence joining has to be read: no option can be thrown out by its shape", () => {
  // The first bank had 8 items. In all 8 the comma splice and the swapped
  // option were wrong, so both went unread, and "never pick although" then
  // solved 6 of the 8.
  const n = COMBINE_SEEDS.length;
  assert.ok(n >= 24, `only ${n} items`);
  for (const c of CONJUNCTIONS) {
    assert.ok(COMBINE_SEEDS.some((s) => s.joiner === c), `"${c}" is never the right joiner`);
  }
  assert.ok(COMBINE_SEEDS.filter((s) => s.joiner === "although").length >= 3);

  let oneLeft = 0;
  let swappedRight = 0;
  let commaRight = 0;
  const solvedBy = new Map<string, number>();
  for (const seed of COMBINE_SEEDS) {
    const options = [seed.answer, ...seed.wrong];
    assert.equal(new Set(options).size, 4, `${seed.answer}: an option is repeated`);
    // Every option keeps both sentences word for word, or nothing below is measured.
    for (const o of options) {
      assert.ok(o.toLowerCase().includes(seed.first.replace(/\.$/, "").toLowerCase()), o);
      assert.ok(o.toLowerCase().includes(seed.second.replace(/\.$/, "").toLowerCase()), o);
    }
    const shapes = options.map((o) => joinShape(seed.first, seed.second, o));
    assert.deepEqual(shapes[0].joiners, [seed.joiner], seed.answer);
    if (shapes[0].swapped) swappedRight++;
    if (seed.answer.includes(",")) commaRight++;
    const plain = options.filter((_, i) => !shapes[i].splice && !shapes[i].swapped);
    if (plain.length === 1) oneLeft++;
    // On top of that, drop doubled joiners and "never pick <c>".
    for (const c of CONJUNCTIONS) {
      const left = options.filter(
        (_, i) =>
          !shapes[i].splice && !shapes[i].swapped && shapes[i].joiners.length === 1 && shapes[i].joiners[0] !== c
      );
      if (left.length === 1 && left[0] === seed.answer) solvedBy.set(c, (solvedBy.get(c) ?? 0) + 1);
    }
  }
  assert.ok(oneLeft * 2 <= n, `dropping the splice and the swapped options leaves one choice in ${oneLeft} of ${n}`);
  // Neither shape is always wrong: plenty of right answers are swapped (or
  // open with the joiner), and plenty have a comma.
  assert.ok(swappedRight * 3 >= n, `only ${swappedRight} of ${n} right answers are swapped`);
  assert.ok(commaRight * 3 >= n, `only ${commaRight} of ${n} right answers have a comma`);
  for (const [c, solved] of solvedBy) {
    assert.ok(solved * 5 <= n, `"never pick ${c}" solves ${solved} of ${n}`);
  }
});
