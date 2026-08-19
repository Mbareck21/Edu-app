// Lesson items: the atoms a runner shows on screen.
//
// Pure data + pure generators. No React, no Mongo, no Math.random (an rng is
// always injected), so every item list is reproducible from a seed.
//
// One item = one thing to do. Most are multiple choice; `spell` builds a word
// from letter tiles; `write` is typed dictation; `learn-card` teaches and asks
// nothing.
//
// Every item carries `feedback`: the one or two lines shown when the answer is
// wrong. Short, concrete, uses the real word for the idea (see the plan's
// "Explanation quality rule").

import { LATIN_PARTS } from "@/lib/curriculum";
import { pick, randInt, shuffle } from "@/lib/math/rng";
import type { Rng } from "@/lib/math/types";
import type { ClientWord, SkillId } from "@/lib/models/WordList";

/** Which per-word schedule an answer feeds. Same ids as WordList skills. */
export type ItemSkill = SkillId;

export type ItemKind =
  | "learn-card"
  | "recognize"
  | "listen"
  | "spell"
  | "write"
  | "use-cloze"
  | "use-pick-sentence"
  | "use-word-form"
  | "word-part-meaning"
  | "word-part-build"
  | "context-clue"
  | "sentence-combine";

type Base = {
  /** Unique inside one lesson. Also the re-queue key. */
  id: string;
  /** The list word being drilled, when the item has one. */
  word?: string;
  /** Which list the word came from — set for cross-list review sessions. */
  listId?: string;
  /** Schedule this answer feeds. */
  skill: ItemSkill;
  /** The instruction line at the top of the screen. */
  prompt: string;
  /** 1-2 lines shown on a miss. */
  feedback: string;
  /** Arabic gloss for the AR chip. Empty string = no gloss to show. */
  arabic?: string;
  /** srs.interval >= 7: the chip is not offered, long-press still reveals. */
  glossFaded?: boolean;
};

/** New-word intro. No answer — the kid reads, listens, then continues. */
export type LearnCardItem = Base & {
  kind: "learn-card";
  word: string;
  explanation: string;
  examples: string[];
  family: string[];
};

/** meaning → word */
export type RecognizeItem = Base & {
  kind: "recognize";
  word: string;
  clue: string;
  options: string[];
  answer: string;
};

/** audio → word (pick from four, or type it) */
export type ListenItem = Base & {
  kind: "listen";
  word: string;
  variant: "mcq" | "type";
  audioText: string;
  options: string[];
  answer: string;
};

/** clue + audio → build the word from letter tiles */
export type SpellItem = Base & {
  kind: "spell";
  word: string;
  hint: string;
  audioText: string;
  tiles: string[];
  answer: string;
};

/** Dictation: hear it, type it. No tiles, no options. */
export type WriteItem = Base & {
  kind: "write";
  word: string;
  audioText: string;
  /** Lower streaks also see the meaning. */
  meaning: string;
  showMeaning: boolean;
  /** Latin parts, when the word has any: ["im-", "possible"]. */
  parts: string[];
  answer: string;
};

/** One of the word's own sentences with the word blanked out. */
export type ClozeItem = Base & {
  kind: "use-cloze";
  word: string;
  sentence: string;
  options: string[];
  answer: string;
};

/** Four sentences, one uses the word correctly. */
export type PickSentenceItem = Base & {
  kind: "use-pick-sentence";
  word: string;
  options: string[];
  answer: string;
};

/** Pick the right form of the word for the sentence (decide / decision / ...). */
export type WordFormItem = Base & {
  kind: "use-word-form";
  word: string;
  sentence: string;
  options: string[];
  answer: string;
};

/** What does this prefix / base / suffix mean? (4.FR.1.PD) */
export type WordPartMeaningItem = Base & {
  kind: "word-part-meaning";
  part: string;
  partKind: "prefix" | "suffix" | "base";
  examples: string[];
  options: string[];
  answer: string;
};

/** Put two parts together to make a real word. (4.FR.1.PD / 4.FR.4.PE) */
export type WordPartBuildItem = Base & {
  kind: "word-part-build";
  lead: string;
  partMeaning: string;
  tiles: string[];
  answer: string;
};

/** Work the meaning out from the sentence around it. (4.V.2) */
export type ContextClueItem = Base & {
  kind: "context-clue";
  word: string;
  sentence: string;
  options: string[];
  answer: string;
};

/** Join two sentences with because / although / when. (4.L.14.S) */
export type SentenceCombineItem = Base & {
  kind: "sentence-combine";
  first: string;
  second: string;
  options: string[];
  answer: string;
};

export type LessonItem =
  | LearnCardItem
  | RecognizeItem
  | ListenItem
  | SpellItem
  | WriteItem
  | ClozeItem
  | PickSentenceItem
  | WordFormItem
  | WordPartMeaningItem
  | WordPartBuildItem
  | ContextClueItem
  | SentenceCombineItem;

/** Items with a right answer — everything except the learn card. */
export type AnswerableItem = Exclude<LessonItem, LearnCardItem>;

export function isAnswerable(item: LessonItem): item is AnswerableItem {
  return item.kind !== "learn-card";
}

/* ------------------------------------------------------------------ *
 * Queue helper
 * ------------------------------------------------------------------ */

/**
 * A miss comes back 2-4 places later — far enough that it is recall, close
 * enough that the kid still remembers being told.
 *
 * Lives here rather than in the lesson builder so the runner can import it
 * without dragging the Mongoose model into the browser bundle.
 */
export function reEnqueue<T>(queue: T[], item: T, rng: Rng): T[] {
  if (queue.length === 0) return [item];
  const offset = 2 + Math.floor(rng() * 3); // 2, 3 or 4
  const at = Math.min(queue.length, offset);
  const next = queue.slice();
  next.splice(at, 0, item);
  return next;
}

/* ------------------------------------------------------------------ *
 * Answer checking
 * ------------------------------------------------------------------ */

export function normalizeAnswer(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Edit distance. Used to spot a one-letter spelling slip. */
export function levenshtein(a: string, b: string): number {
  const s = a ?? "";
  const t = b ?? "";
  if (s === t) return 0;
  if (s.length === 0) return t.length;
  if (t.length === 0) return s.length;
  let prev = new Array<number>(t.length + 1);
  let curr = new Array<number>(t.length + 1);
  for (let j = 0; j <= t.length; j++) prev[j] = j;
  for (let i = 1; i <= s.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= t.length; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    const swap = prev;
    prev = curr;
    curr = swap;
  }
  return prev[t.length];
}

export type Grade = "correct" | "almost" | "wrong";

/** Words this short get no "almost" — one letter is most of the word. */
export const ALMOST_MIN_LENGTH = 4;

/**
 * Grade a typed answer. One letter off on a longer word is "almost", which
 * buys exactly one more try; after that it is wrong.
 */
export function gradeTyped(answer: string, given: string, retried = false): Grade {
  const a = normalizeAnswer(answer);
  const g = normalizeAnswer(given);
  if (a === g) return "correct";
  if (retried) return "wrong";
  if (a.length >= ALMOST_MIN_LENGTH && levenshtein(a, g) === 1) return "almost";
  return "wrong";
}

/** Grade any answerable item. Choice items are exact-match only. */
export function gradeItem(item: AnswerableItem, given: string, retried = false): Grade {
  if (item.kind === "write" || (item.kind === "listen" && item.variant === "type")) {
    return gradeTyped(item.answer, given, retried);
  }
  return normalizeAnswer(item.answer) === normalizeAnswer(given) ? "correct" : "wrong";
}

/* ------------------------------------------------------------------ *
 * Latin parts
 * ------------------------------------------------------------------ */

const PREFIXES = LATIN_PARTS.filter((p) => p.kind === "prefix");
const SUFFIXES = LATIN_PARTS.filter((p) => p.kind === "suffix");

/** "in-/im-" → ["in", "im"], "-er/-or" → ["er", "or"]. */
function partVariants(part: string): string[] {
  return part
    .split("/")
    .map((p) => p.replace(/-/g, "").trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Split a word into its Latin parts, if it clearly has any.
 * Conservative on purpose: a wrong split teaches the wrong thing, so a word
 * only splits when it is a published example of the part, or when what is
 * left over is long enough to be a real base.
 */
export function latinPartsOf(word: string): string[] {
  const w = word.trim().toLowerCase();
  if (w.length < 5) return [];

  // A published example is the sure thing — "impossible" is im- + possible,
  // not imposs + -ible, and only the word list knows that.
  for (const entry of PREFIXES) {
    if (!entry.examples.includes(w)) continue;
    for (const v of partVariants(entry.part)) {
      if (w.startsWith(v)) return [`${v}-`, w.slice(v.length)];
    }
  }
  for (const entry of SUFFIXES) {
    if (!entry.examples.includes(w)) continue;
    for (const v of partVariants(entry.part)) {
      if (w.endsWith(v)) return [w.slice(0, w.length - v.length), `-${v}`];
    }
  }

  // Otherwise fall back on length: a real base is at least four letters.
  for (const entry of SUFFIXES) {
    for (const v of partVariants(entry.part)) {
      if (!w.endsWith(v)) continue;
      const base = w.slice(0, w.length - v.length);
      if (base.length >= 4) return [base, `-${v}`];
    }
  }
  for (const entry of PREFIXES) {
    for (const v of partVariants(entry.part)) {
      if (!w.startsWith(v)) continue;
      const rest = w.slice(v.length);
      if (rest.length >= 5) return [`${v}-`, rest];
    }
  }
  return [];
}

/* ------------------------------------------------------------------ *
 * Distractors
 * ------------------------------------------------------------------ */

/** Padding for tiny lists so a 4-option question is always possible. */
const FILLER_WORDS = [
  "quiet", "brave", "sudden", "gather", "steady", "narrow", "polite", "clever",
  "shiver", "wander", "gentle", "sturdy", "borrow", "settle", "notice", "reply",
];

const FILLER_MEANINGS = [
  "to look at something closely",
  "a small piece of something",
  "to move very fast",
  "a place where people meet",
  "to keep something safe",
  "the sound a thing makes",
];

function otherWords(target: string, pool: ClientWord[]): ClientWord[] {
  const t = target.toLowerCase();
  return pool.filter((w) => w.word.toLowerCase() !== t);
}

/**
 * Three wrong words for a 4-option question. Near misses first: same first
 * letter, then the same prefix, then anything else on the list, then filler.
 */
export function wordDistractors(
  target: string,
  pool: ClientWord[],
  rng: Rng,
  count = 3
): string[] {
  const t = target.toLowerCase();
  const others = otherWords(target, pool).map((w) => w.word.toLowerCase());
  const parts = latinPartsOf(t);
  const prefix = parts.length === 2 && parts[0].endsWith("-") ? parts[0].slice(0, -1) : "";

  const sameFirst = others.filter((w) => w[0] === t[0]);
  const samePrefix = prefix ? others.filter((w) => w.startsWith(prefix)) : [];
  const sameLength = others.filter((w) => Math.abs(w.length - t.length) <= 1);
  const tiers = [shuffle(rng, samePrefix), shuffle(rng, sameFirst), shuffle(rng, sameLength), shuffle(rng, others), shuffle(rng, FILLER_WORDS)];

  const out: string[] = [];
  for (const tier of tiers) {
    for (const w of tier) {
      if (out.length >= count) break;
      if (w === t || out.includes(w)) continue;
      out.push(w);
    }
    if (out.length >= count) break;
  }
  return out.slice(0, count);
}

/** Three wrong meanings, taken from other words on the list where possible. */
function meaningDistractors(
  target: ClientWord,
  pool: ClientWord[],
  rng: Rng,
  count = 3
): string[] {
  const mine = meaningOf(target);
  const others = shuffle(rng, otherWords(target.word, pool))
    .map(meaningOf)
    .filter((m) => m && m !== mine);
  const out: string[] = [];
  for (const m of [...others, ...shuffle(rng, FILLER_MEANINGS)]) {
    if (out.length >= count) break;
    if (!m || out.includes(m)) continue;
    out.push(m);
  }
  return out.slice(0, count);
}

function meaningOf(word: ClientWord): string {
  return (word.explanation || word.clue || "").trim();
}

function fourOptions(answer: string, wrong: string[], rng: Rng): string[] {
  return shuffle(rng, [answer, ...wrong.slice(0, 3)]);
}

/* ------------------------------------------------------------------ *
 * Sentence helpers
 * ------------------------------------------------------------------ */

const BLANK = "____";

function wordRegex(word: string): RegExp {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "i");
}

/** The word's own sentences that actually contain it. */
export function usableExamples(word: ClientWord): string[] {
  const re = wordRegex(word.word);
  return word.examples.map((s) => s.trim()).filter((s) => s.length > 0 && re.test(s));
}

function blankOut(sentence: string, word: string): string {
  return sentence.replace(wordRegex(word), BLANK);
}

/* ------------------------------------------------------------------ *
 * Item generators — every one returns null when the word lacks the data
 * ------------------------------------------------------------------ */

export type ItemPool = {
  /** Distractor source: the whole list, or the whole review pool. */
  words: ClientWord[];
  /** Stamped onto every item so a cross-list session can post per list. */
  listId?: string;
};

let counter = 0;
function itemId(kind: ItemKind, word: string): string {
  counter = (counter + 1) % 1_000_000;
  return `${kind}:${word || "x"}:${counter}`;
}

function baseFor(word: ClientWord, pool: ItemPool, skill: ItemSkill, kind: ItemKind) {
  return {
    id: itemId(kind, word.word),
    word: word.word,
    listId: pool.listId,
    skill,
    arabic: word.arabic || "",
    glossFaded: word.srs.interval >= 7,
  };
}

/** A short "word — meaning" line for the miss sheet. */
function meaningLine(word: ClientWord): string {
  const m = meaningOf(word);
  return m ? `${word.word} — ${m}` : `The word is "${word.word}".`;
}

export function makeLearnCard(word: ClientWord, pool: ItemPool): LearnCardItem {
  return {
    ...baseFor(word, pool, "recognize", "learn-card"),
    kind: "learn-card",
    word: word.word,
    prompt: "New word",
    feedback: "",
    explanation: meaningOf(word) || "A new word for today.",
    examples: word.examples.slice(0, 3),
    family: word.family.slice(0, 4),
  };
}

export function makeRecognize(
  word: ClientWord,
  pool: ItemPool,
  rng: Rng
): RecognizeItem | null {
  const clue = meaningOf(word);
  if (!clue) return null;
  return {
    ...baseFor(word, pool, "recognize", "recognize"),
    kind: "recognize",
    prompt: "Which word means this?",
    clue,
    options: fourOptions(word.word, wordDistractors(word.word, pool.words, rng), rng),
    answer: word.word,
    feedback: meaningLine(word),
  };
}

export function makeListen(
  word: ClientWord,
  pool: ItemPool,
  rng: Rng,
  hard = false
): ListenItem {
  const options = hard
    ? []
    : fourOptions(word.word, wordDistractors(word.word, pool.words, rng), rng);
  return {
    ...baseFor(word, pool, "listen", "listen"),
    kind: "listen",
    variant: hard ? "type" : "mcq",
    prompt: hard ? "Listen, then type the word." : "Listen, then pick the word.",
    audioText: word.word,
    options,
    answer: word.word,
    feedback: meaningLine(word),
  };
}

export function makeSpell(word: ClientWord, pool: ItemPool, rng: Rng): SpellItem {
  const letters = word.word.replace(/\s+/g, "").split("");
  return {
    ...baseFor(word, pool, "spell", "spell"),
    kind: "spell",
    prompt: "Build the word.",
    hint: meaningOf(word) || "Listen and build it.",
    audioText: word.word,
    tiles: shuffle(rng, letters),
    answer: word.word,
    feedback: `${word.word} = ${letters.join(" ")}`,
  };
}

/** Typed dictation. Streak 2 and 3 still see the meaning; after that, audio only. */
export function makeWrite(word: ClientWord, pool: ItemPool): WriteItem {
  const parts = latinPartsOf(word.word);
  const streak = word.skills.spell.streak;
  const feedback = parts.length
    ? `${word.word} = ${parts.join(" + ")}`
    : `Look again: ${word.word.split("").join(" ")}`;
  return {
    ...baseFor(word, pool, "spell", "write"),
    kind: "write",
    prompt: "Listen, then write the word.",
    audioText: word.word,
    meaning: meaningOf(word),
    showMeaning: streak < 4,
    parts,
    answer: word.word,
    feedback,
  };
}

export function makeCloze(word: ClientWord, pool: ItemPool, rng: Rng): ClozeItem | null {
  const examples = usableExamples(word);
  if (examples.length === 0) return null;
  const sentence = pick(rng, examples);
  return {
    ...baseFor(word, pool, "use", "use-cloze"),
    kind: "use-cloze",
    prompt: "Which word fits the blank?",
    sentence: blankOut(sentence, word.word),
    options: fourOptions(word.word, wordDistractors(word.word, pool.words, rng), rng),
    answer: word.word,
    feedback: sentence,
  };
}

export function makePickSentence(
  word: ClientWord,
  pool: ItemPool,
  rng: Rng
): PickSentenceItem | null {
  const mine = usableExamples(word);
  if (mine.length === 0) return null;
  // A wrong use = another word's sentence with our word dropped into its slot.
  const wrong: string[] = [];
  for (const other of shuffle(rng, otherWords(word.word, pool.words))) {
    if (wrong.length >= 3) break;
    const theirs = usableExamples(other);
    if (theirs.length === 0) continue;
    const swapped = theirs[0].replace(wordRegex(other.word), word.word);
    if (swapped !== theirs[0] && !wrong.includes(swapped)) wrong.push(swapped);
  }
  if (wrong.length < 3) return null;
  const answer = pick(rng, mine);
  return {
    ...baseFor(word, pool, "use", "use-pick-sentence"),
    kind: "use-pick-sentence",
    prompt: `Which sentence uses "${word.word}" the right way?`,
    options: fourOptions(answer, wrong, rng),
    answer,
    feedback: `${answer} ${meaningOf(word)}`.trim(),
  };
}

export function makeWordForm(
  word: ClientWord,
  pool: ItemPool,
  rng: Rng
): WordFormItem | null {
  const forms = word.family
    .map((f) => f.trim().toLowerCase())
    .filter((f) => f && f !== word.word.toLowerCase());
  if (forms.length < 2) return null;
  const examples = usableExamples(word);
  if (examples.length === 0) return null;
  const sentence = pick(rng, examples);
  return {
    ...baseFor(word, pool, "use", "use-word-form"),
    kind: "use-word-form",
    prompt: "Pick the right form of the word.",
    sentence: blankOut(sentence, word.word),
    options: fourOptions(word.word, shuffle(rng, forms), rng),
    answer: word.word,
    feedback: sentence,
  };
}

export function makeContextClue(
  word: ClientWord,
  pool: ItemPool,
  rng: Rng
): ContextClueItem | null {
  const meaning = meaningOf(word);
  const examples = usableExamples(word);
  if (!meaning || examples.length === 0) return null;
  const wrong = meaningDistractors(word, pool.words, rng);
  if (wrong.length < 3) return null;
  return {
    ...baseFor(word, pool, "use", "context-clue"),
    kind: "context-clue",
    prompt: `What does "${word.word}" mean here?`,
    sentence: pick(rng, examples),
    options: fourOptions(meaning, wrong, rng),
    answer: meaning,
    feedback: meaningLine(word),
  };
}

/** Prefix / base / suffix meaning. Prefers a part one of the list words uses. */
export function makeWordPartMeaning(
  pool: ItemPool,
  rng: Rng,
  preferWord?: ClientWord
): WordPartMeaningItem | null {
  const fromWord = preferWord ? partEntryFor(preferWord.word) : null;
  const entry = fromWord ?? pick(rng, LATIN_PARTS);
  const wrong = shuffle(rng, LATIN_PARTS.filter((p) => p.meaning !== entry.meaning))
    .slice(0, 3)
    .map((p) => p.meaning);
  if (wrong.length < 3) return null;
  return {
    id: itemId("word-part-meaning", entry.part),
    listId: pool.listId,
    word: fromWord && preferWord ? preferWord.word : undefined,
    skill: "recognize",
    kind: "word-part-meaning",
    prompt: "What does this word part mean?",
    part: entry.part,
    partKind: entry.kind,
    examples: entry.examples.slice(0, 3),
    options: fourOptions(entry.meaning, wrong, rng),
    answer: entry.meaning,
    feedback: `${entry.part} means ${entry.meaning}. Like ${entry.examples[0]}.`,
  };
}

function partEntryFor(word: string): (typeof LATIN_PARTS)[number] | null {
  const parts = latinPartsOf(word);
  if (parts.length !== 2) return null;
  const marker = parts[0].endsWith("-") ? parts[0] : parts[1];
  const bare = marker.replace(/-/g, "");
  return (
    LATIN_PARTS.find((p) => partVariants(p.part).includes(bare) && p.kind !== "base") ?? null
  );
}

/** Build a real word from a base + the part that carries the meaning. */
export function makeWordPartBuild(
  pool: ItemPool,
  rng: Rng
): WordPartBuildItem | null {
  const candidates = LATIN_PARTS.filter((p) => p.kind === "suffix" || p.kind === "prefix");
  for (const entry of shuffle(rng, candidates)) {
    for (const example of shuffle(rng, entry.examples)) {
      const split = latinPartsOf(example);
      if (split.length !== 2) continue;
      const isSuffix = split[1].startsWith("-");
      const base = isSuffix ? split[0] : split[1];
      const marker = isSuffix ? split[1] : split[0];
      const wrongParts = shuffle(
        rng,
        LATIN_PARTS.filter((p) => p.kind === entry.kind && p.part !== entry.part)
      )
        .slice(0, 2)
        .map((p) => (p.kind === "suffix" ? `-${partVariants(p.part)[0]}` : `${partVariants(p.part)[0]}-`));
      if (wrongParts.length < 2) continue;
      return {
        id: itemId("word-part-build", example),
        listId: pool.listId,
        skill: "spell",
        kind: "word-part-build",
        prompt: "Build the word.",
        lead: base,
        partMeaning: entry.meaning,
        tiles: shuffle(rng, [marker, ...wrongParts]),
        answer: marker,
        feedback: `${marker} means ${entry.meaning}. ${split.join(" + ")} = ${example}.`,
      };
    }
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * Sentence combining (4.L.14.S) — a small hand-written bank
 * ------------------------------------------------------------------ */

type CombineSeed = {
  first: string;
  second: string;
  joiner: string;
  answer: string;
  wrong: [string, string, string];
  why: string;
};

export const COMBINE_SEEDS: readonly CombineSeed[] = [
  {
    first: "We stayed inside.",
    second: "It rained all day.",
    joiner: "because",
    answer: "We stayed inside because it rained all day.",
    wrong: [
      "We stayed inside although it rained all day.",
      "It rained all day because we stayed inside.",
      "We stayed inside, it rained all day.",
    ],
    why: "because tells why. The rain is the reason.",
  },
  {
    first: "Sam finished his book.",
    second: "The bus was late.",
    joiner: "because",
    answer: "Sam finished his book because the bus was late.",
    wrong: [
      "The bus was late because Sam finished his book.",
      "Sam finished his book when the bus was late, although he read fast.",
      "Sam finished his book, the bus was late.",
    ],
    why: "because tells why. The late bus gave him time.",
  },
  {
    first: "The team kept playing.",
    second: "They were tired.",
    joiner: "although",
    answer: "The team kept playing although they were tired.",
    wrong: [
      "The team kept playing because they were tired.",
      "Although the team kept playing they were tired if they stopped.",
      "The team kept playing, they were tired.",
    ],
    why: "although shows a surprise. Tired players usually stop.",
  },
  {
    first: "Nour washed his hands.",
    second: "He ate dinner.",
    joiner: "before",
    answer: "Nour washed his hands before he ate dinner.",
    wrong: [
      "Nour washed his hands although he ate dinner.",
      "Nour ate dinner before he washed his hands.",
      "Nour washed his hands, he ate dinner.",
    ],
    why: "before puts the two things in order. Hands first, food after.",
  },
  {
    first: "The lights went out.",
    second: "The storm hit.",
    joiner: "when",
    answer: "The lights went out when the storm hit.",
    wrong: [
      "The lights went out although the storm hit.",
      "The storm hit when the lights went out.",
      "The lights went out, the storm hit.",
    ],
    why: "when joins two things that happen at the same time.",
  },
  {
    first: "You can borrow my pen.",
    second: "You give it back.",
    joiner: "if",
    answer: "You can borrow my pen if you give it back.",
    wrong: [
      "You can borrow my pen because you give it back.",
      "You give it back if you can borrow my pen.",
      "You can borrow my pen, you give it back.",
    ],
    why: "if sets the deal. Giving it back is the condition.",
  },
  {
    first: "Ali packed a coat.",
    second: "The morning was cold.",
    joiner: "since",
    answer: "Ali packed a coat since the morning was cold.",
    wrong: [
      "Ali packed a coat although the morning was cold.",
      "The morning was cold since Ali packed a coat.",
      "Ali packed a coat, the morning was cold.",
    ],
    why: "since works like because here. The cold is the reason.",
  },
  {
    first: "The plants grew fast.",
    second: "We watered them every day.",
    joiner: "because",
    answer: "The plants grew fast because we watered them every day.",
    wrong: [
      "The plants grew fast although we watered them every day.",
      "We watered them every day because the plants grew fast.",
      "The plants grew fast, we watered them every day.",
    ],
    why: "because tells why. Water made them grow.",
  },
];

export function makeSentenceCombine(pool: ItemPool, rng: Rng): SentenceCombineItem {
  const seed = pick(rng, COMBINE_SEEDS);
  return {
    id: itemId("sentence-combine", seed.joiner),
    listId: pool.listId,
    skill: "use",
    kind: "sentence-combine",
    prompt: "Join the two sentences.",
    first: seed.first,
    second: seed.second,
    options: fourOptions(seed.answer, [...seed.wrong], rng),
    answer: seed.answer,
    feedback: seed.why,
  };
}

/* ------------------------------------------------------------------ *
 * Skill → item, with fallbacks when the word data is thin
 * ------------------------------------------------------------------ */

/**
 * One item for one skill. `hard` asks for the harder rung (streak >= 2).
 * Falls back down the ladder when the word has no examples or no meaning yet,
 * so a half-filled list still produces a whole lesson.
 */
export function itemForSkill(
  word: ClientWord,
  skill: ItemSkill,
  pool: ItemPool,
  rng: Rng,
  hard = false
): LessonItem {
  if (skill === "listen") return makeListen(word, pool, rng, hard);
  if (skill === "spell") {
    return hard ? makeWrite(word, pool) : makeSpell(word, pool, rng);
  }
  if (skill === "recognize") {
    const item = hard
      ? makeCloze(word, pool, rng) ?? makeRecognize(word, pool, rng)
      : makeRecognize(word, pool, rng);
    return item ?? makeListen(word, pool, rng, false);
  }
  // use
  const chain = hard
    ? [makePickSentence, makeWordForm, makeContextClue, makeCloze]
    : [makeCloze, makeContextClue, makeWordForm, makePickSentence];
  for (const make of chain) {
    const item = make(word, pool, rng);
    if (item) return item;
  }
  return makeSpell(word, pool, rng);
}

/** Curriculum items that belong to no single word (word parts, sentences). */
export function schoolItem(pool: ItemPool, rng: Rng, word?: ClientWord): LessonItem {
  const roll = randInt(rng, 0, 2);
  if (roll === 0) {
    const item = makeWordPartMeaning(pool, rng, word);
    if (item) return item;
  }
  if (roll === 1) {
    const item = makeWordPartBuild(pool, rng);
    if (item) return item;
  }
  return makeSentenceCombine(pool, rng);
}
