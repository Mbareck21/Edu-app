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
import { fromWords } from "@/lib/number-words";

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

/**
 * Which still-unfound word the "write what you remember" box should take.
 * While he is typing, a match waits if a longer unfound word starts the same
 * way: otherwise "twenty-one" is taken as "twenty" at the sixth letter and he
 * gets credit for the wrong word. Pressing Enter (`submitted`) takes the match.
 */
export function recalledWord(
  typed: string,
  unfound: readonly string[],
  submitted: boolean
): string | null {
  const text = normalizeAnswer(typed);
  if (!text) return null;
  const hit = unfound.find((w) => normalizeAnswer(w) === text);
  if (!hit || submitted) return hit ?? null;
  const longer = unfound.some((w) => {
    const key = normalizeAnswer(w);
    return key !== text && key.startsWith(text);
  });
  return longer ? null : hit;
}

/**
 * Punctuation a nine-year-old adds out of habit, not because he thinks it is
 * part of the word. Apostrophes are NOT here: "dont" is not "don't".
 */
const IGNORED_PUNCT = /[.,!?;:"“”…]/g;

/**
 * Spelling answers ignore spaces entirely: the tiles for "rock layer" carry no
 * space, so a built answer never has one. Typed answers accept either.
 *
 * They also ignore sentence punctuation and hyphens. He is drilled at school to
 * end a line with a full stop, and typing "sun." used to be marked wrong — a
 * three-letter word gets no "almost", so it cost him the item outright. A
 * hyphen is the same story: spaces already vanish here, so "well known" has to
 * match "well-known" or the fix is only half done.
 */
export function spellingKey(text: string): string {
  return normalizeAnswer(text)
    .replace(IGNORED_PUNCT, "")
    .replace(/[-–—]/g, "")
    .replace(/\s+/g, "");
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
  const a = spellingKey(answer);
  const g = spellingKey(given);
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
  if (item.kind === "spell") {
    // Tiles for a two-word answer carry no space, so grade without one.
    return spellingKey(item.answer) === spellingKey(given) ? "correct" : "wrong";
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
 * only splits when it is a published example of the part.
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

  // Nothing curated says this word has parts, so it gets none. Guessing from
  // length invents morphology: "mother" is not moth + -er.
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
/** Words that carry no meaning for telling two clues apart. */
const CLUE_STOP = new Set([
  "a", "an", "the", "to", "of", "in", "on", "or", "and", "is", "it", "its", "as",
  "by", "for", "with", "that", "this", "you", "your", "we", "he", "she", "they",
  "like", "one", "each", "way", "when", "where", "what", "how", "so", "up", "at",
  "from", "into", "than", "then", "some", "more", "very", "not", "no", "all",
  "something", "someone", "number", "numbers", "word", "words", "thing", "things",
]);

/** "plants" and "plant" are one idea; strip the plural before comparing. */
function stem(t: string): string {
  if (t.length > 4 && t.endsWith("es")) return t.slice(0, -2);
  if (t.length > 3 && t.endsWith("s")) return t.slice(0, -1);
  return t;
}

function clueTokens(clue: string): Set<string> {
  return new Set(
    clue
      .toLowerCase()
      .replace(/[^a-z\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2 && !CLUE_STOP.has(t))
      .map(stem)
  );
}

/** Content words two clues share. */
const CLUE_OVERLAP = 3;

/**
 * Would this word be a SECOND right answer to the target's clue?
 *
 * The one he remembers: "Which word means this?" with the clue for "value",
 * and "place value" sitting among the options — a perfectly good answer that
 * was marked wrong. Two cheap tests catch the real cases:
 *   - one word's tokens sit inside the other's (value / place value);
 *   - the two clues share several content words (compost / fertilizer both
 *     talk about food and soil and plants);
 *   - one word's clue names the other word ("fair test: An experiment that
 *     treats every part the same" offered beside "experiment" for "The ____
 *     uses three cups of water", where both fit).
 * A distractor is meant to be wrong. If it might be right, it is not one.
 */
export function tooClose(target: ClientWord, candidate: ClientWord): boolean {
  const a = target.word.toLowerCase().split(/\s+/);
  const b = candidate.word.toLowerCase().split(/\s+/);
  const contained = a.every((t) => b.includes(t)) || b.every((t) => a.includes(t));
  if (contained) return true;
  const ta = clueTokens(target.clue || "");
  const tb = clueTokens(candidate.clue || "");
  const names = (clue: Set<string>, words: string[]) => words.every((w) => clue.has(stem(w)));
  if (names(tb, a) || names(ta, b)) return true;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  return shared >= CLUE_OVERLAP;
}

export function wordDistractors(
  target: string,
  pool: ClientWord[],
  rng: Rng,
  count = 3
): string[] {
  const t = target.toLowerCase();
  // Never offer a word that could also be right. See tooClose. A review pool
  // holds the same word from several lists with different clues, so a word
  // is out if any of its entries is too close to any entry of the target.
  const targets = pool.filter((w) => w.word.toLowerCase() === t);
  const close = new Set(
    otherWords(target, pool)
      .filter((w) => targets.some((tw) => tooClose(tw, w)))
      .map((w) => w.word.toLowerCase())
  );
  const others = otherWords(target, pool)
    .map((w) => w.word.toLowerCase())
    .filter((w) => !close.has(w));
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

/**
 * A number word fits any sentence that counts something. "We need ____ more
 * minutes to finish" takes seventy, twenty and thirty alike, so a list of
 * number words turned every blank into a question with three right answers
 * and marked two of them wrong. The blank for a number word therefore shows
 * its numeral, which is also exactly what the Number Words list practises:
 * the word form of a number he can already read.
 */
function numeralOf(word: string): string | null {
  const n = fromWords(word);
  return n === null ? null : n.toLocaleString("en-US");
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
  // A shuffle can land on the word itself: "odd" came out already built a
  // third of the time, "sum" one time in six. Shuffle again until it is not,
  // unless every letter is the same and no other order exists.
  let tiles = shuffle(rng, letters);
  const canMove = new Set(letters).size > 1;
  while (canMove && tiles.join("") === letters.join("")) tiles = shuffle(rng, letters);
  return {
    ...baseFor(word, pool, "spell", "spell"),
    kind: "spell",
    prompt: "Build the word.",
    hint: meaningOf(word) || "Listen and build it.",
    audioText: word.word,
    tiles,
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
    sentence: numeralOf(word.word)
      ? blankOut(sentence, word.word).replace(BLANK, `${BLANK} (${numeralOf(word.word)})`)
      : blankOut(sentence, word.word),
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
  const isNumber = numeralOf(word.word) !== null;
  for (const other of shuffle(rng, otherWords(word.word, pool.words))) {
    if (wrong.length >= 3) break;
    // Another number's sentence with this number dropped in is still a right
    // sentence ("I have seventy cats"), so it cannot be the wrong one.
    if (isNumber && numeralOf(other.word) !== null) continue;
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
  // Blank whichever form a sentence really uses, not always the list word.
  // The list word is the base (help) and the rest of the family is longer
  // (helps, helped, helpful), so when the base was always the answer, "pick
  // the shortest" won without reading the sentence. The sentences are written
  // with a mix of forms, so each form that has one gets an equal chance.
  const all = [word.word, ...forms];
  const usable = all
    .map((form) => ({
      form,
      sentences: word.examples.map((s) => s.trim()).filter((s) => s && wordRegex(form).test(s)),
    }))
    .filter((u) => u.sentences.length > 0);
  if (usable.length === 0) return null;
  const { form, sentences } = pick(rng, usable);
  const sentence = pick(rng, sentences);
  return {
    ...baseFor(word, pool, "use", "use-word-form"),
    kind: "use-word-form",
    prompt: "Pick the right form of the word.",
    sentence: blankOut(sentence, form),
    options: fourOptions(form, shuffle(rng, all.filter((f) => f !== form)), rng),
    answer: form,
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
 * Sentence combining (4.L.14.S) — a hand-written bank
 * ------------------------------------------------------------------ */

// The bank has to be read to be answered. The first eight items all had one
// shape: a wrong joiner, the two halves swapped, and a comma splice. The
// swapped one and the splice could be thrown out unread, and "never pick
// although" finished six of the eight. So now:
//   - the right answer often comes in swapped order (or opens with the
//     joiner), so throwing out the swapped options can throw out the answer;
//   - a comma splice is in only some items, and many right answers have a
//     comma too (", but", "Although ..., ...");
//   - every joiner is right in some items and wrong in others.
// Every option keeps both sentences word for word, which is what lets the
// tests check all of that (lib/__tests__/distractors.test.ts).

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
      "It rained all day because we stayed inside.",
      "Because we stayed inside, it rained all day.",
      "It rained all day, or we stayed inside.",
    ],
    why: "because tells why. The rain is the reason.",
  },
  {
    first: "Mia put on her coat.",
    second: "It was cold outside.",
    joiner: "because",
    answer: "Because it was cold outside, Mia put on her coat.",
    wrong: [
      "Because Mia put on her coat, it was cold outside.",
      "Mia put on her coat although it was cold outside.",
      "Mia put on her coat, it was cold outside.",
    ],
    why: "because tells why. The cold is the reason for the coat.",
  },
  {
    first: "The sun was very hot.",
    second: "The ice cream melted.",
    joiner: "because",
    answer: "The ice cream melted because the sun was very hot.",
    wrong: [
      "The sun was very hot because the ice cream melted.",
      "The ice cream melted before the sun was very hot.",
      "The sun was very hot, but the ice cream melted.",
    ],
    why: "because tells why. The hot sun made it melt.",
  },
  {
    first: "Sara wanted to play outside.",
    second: "It was raining.",
    joiner: "but",
    answer: "Sara wanted to play outside, but it was raining.",
    wrong: [
      "Sara wanted to play outside because it was raining.",
      "It was raining, so Sara wanted to play outside.",
      "It was raining, Sara wanted to play outside.",
    ],
    why: "but shows a problem. She wanted to go out, and the rain got in the way.",
  },
  {
    first: "The test was hard.",
    second: "Ben got every answer right.",
    joiner: "but",
    answer: "The test was hard, but Ben got every answer right.",
    wrong: [
      "The test was hard, so Ben got every answer right.",
      "Ben got every answer right because the test was hard.",
      "Because the test was hard, but Ben got every answer right.",
    ],
    why: "but shows a surprise. The test was hard, and he still got them all.",
  },
  {
    first: "The puppy is small.",
    second: "It has a very loud bark.",
    joiner: "but",
    answer: "The puppy is small, but it has a very loud bark.",
    wrong: [
      "The puppy is small since it has a very loud bark.",
      "It has a very loud bark unless the puppy is small.",
      "The puppy is small, it has a very loud bark.",
    ],
    why: "but joins two things that do not match. A small dog with a big bark.",
  },
  {
    first: "The water was too cold.",
    second: "We did not swim.",
    joiner: "so",
    answer: "The water was too cold, so we did not swim.",
    wrong: [
      "We did not swim, so the water was too cold.",
      "The water was too cold, we did not swim.",
      "The water was too cold, but we did not swim.",
    ],
    why: "so tells what happened because of it. The cold water kept us out.",
  },
  {
    first: "Ali packed a snack.",
    second: "The trip was long.",
    joiner: "so",
    answer: "The trip was long, so Ali packed a snack.",
    wrong: [
      "Ali packed a snack, so the trip was long.",
      "Ali packed a snack although the trip was long.",
      "Ali packed a snack while the trip was long.",
    ],
    why: "so shows a result. The long trip is why he packed food.",
  },
  {
    first: "Cars drove slowly.",
    second: "The road was covered in snow.",
    joiner: "so",
    answer: "The road was covered in snow, so cars drove slowly.",
    wrong: [
      "Cars drove slowly, so the road was covered in snow.",
      "The road was covered in snow, cars drove slowly.",
      "Cars drove slowly unless the road was covered in snow.",
    ],
    why: "so shows a result. Snow on the road made the cars slow down.",
  },
  {
    first: "The team kept playing.",
    second: "They were tired.",
    joiner: "although",
    answer: "The team kept playing although they were tired.",
    wrong: [
      "The team kept playing because they were tired.",
      "They were tired, so the team kept playing.",
      "Although they were tired, but the team kept playing.",
    ],
    why: "although shows a surprise. Tired players usually stop.",
  },
  {
    first: "Hana finished the race.",
    second: "Her shoe came off.",
    joiner: "although",
    answer: "Although her shoe came off, Hana finished the race.",
    wrong: [
      "Because her shoe came off, Hana finished the race.",
      "Hana finished the race because her shoe came off.",
      "Hana finished the race, her shoe came off.",
    ],
    why: "although shows a surprise. Losing a shoe could have stopped her.",
  },
  {
    first: "It was very hot.",
    second: "We went for a long run.",
    joiner: "although",
    answer: "We went for a long run although it was very hot.",
    wrong: [
      "It was very hot although we went for a long run.",
      "It was very hot, so we went for a long run.",
      "We went for a long run, it was very hot.",
    ],
    why: "although shows a surprise. Most people do not run far on a very hot day.",
  },
  {
    first: "The book was long.",
    second: "Zara read all of it in one day.",
    joiner: "although",
    answer: "Although the book was long, Zara read all of it in one day.",
    wrong: [
      "Because the book was long, Zara read all of it in one day.",
      "The book was long, so Zara read all of it in one day.",
      "The book was long, Zara read all of it in one day.",
    ],
    why: "although shows a surprise. A long book usually takes more than a day.",
  },
  {
    first: "Mom cooked dinner.",
    second: "Dad washed the car.",
    joiner: "while",
    answer: "Mom cooked dinner while Dad washed the car.",
    wrong: [
      "Mom cooked dinner if Dad washed the car.",
      "Dad washed the car, so Mom cooked dinner.",
      "Dad washed the car unless Mom cooked dinner.",
    ],
    why: "while joins two things that happen at the same time.",
  },
  {
    first: "Rami read a book.",
    second: "His sister drew a picture.",
    joiner: "while",
    answer: "Rami read a book while his sister drew a picture.",
    wrong: [
      "Rami read a book, so his sister drew a picture.",
      "Rami read a book, his sister drew a picture.",
      "Rami read a book unless his sister drew a picture.",
    ],
    why: "while shows two things at the same time. Both of them were busy.",
  },
  {
    first: "The storm hit.",
    second: "The lights went out.",
    joiner: "when",
    answer: "The lights went out when the storm hit.",
    wrong: [
      "The lights went out, so the storm hit.",
      "The lights went out before the storm hit.",
      "The storm hit, the lights went out.",
    ],
    why: "when tells the time. The storm came, and right then the lights went out.",
  },
  {
    first: "Grandpa smiles.",
    second: "We visit him.",
    joiner: "when",
    answer: "Grandpa smiles when we visit him.",
    wrong: [
      "Grandpa smiles unless we visit him.",
      "We visit him, or Grandpa smiles.",
      "Grandpa smiles although we visit him.",
    ],
    why: "when tells the time. Each time we visit, he smiles.",
  },
  {
    first: "The class goes to lunch.",
    second: "The bell rings.",
    joiner: "when",
    answer: "When the bell rings, the class goes to lunch.",
    wrong: [
      "The class goes to lunch although the bell rings.",
      "The bell rings, the class goes to lunch.",
      "The class goes to lunch unless the bell rings.",
    ],
    why: "when tells the time. The bell rings, and then it is lunch.",
  },
  {
    first: "The library was closed.",
    second: "We read at home.",
    joiner: "since",
    answer: "We read at home since the library was closed.",
    wrong: [
      "The library was closed since we read at home.",
      "We read at home unless the library was closed.",
      "Since the library was closed, so we read at home.",
    ],
    why: "since works like because here. The closed library is the reason.",
  },
  {
    first: "Nadia wore a hat.",
    second: "The sun was strong.",
    joiner: "since",
    answer: "Nadia wore a hat since the sun was strong.",
    wrong: [
      "The sun was strong since Nadia wore a hat.",
      "Nadia wore a hat although the sun was strong.",
      "The sun was strong, Nadia wore a hat.",
    ],
    why: "since tells why, like because. The strong sun is the reason for the hat.",
  },
  {
    first: "You will miss the bus.",
    second: "You hurry.",
    joiner: "unless",
    answer: "You will miss the bus unless you hurry.",
    wrong: [
      "You will miss the bus if you hurry.",
      "You hurry unless you will miss the bus.",
      "You hurry, and you will miss the bus.",
    ],
    why: "unless means if not. If you do not hurry, you will miss it.",
  },
  {
    first: "The plant will dry up.",
    second: "You water it.",
    joiner: "unless",
    answer: "Unless you water it, the plant will dry up.",
    wrong: [
      "Because you water it, the plant will dry up.",
      "The plant will dry up when you water it.",
      "The plant will dry up, you water it.",
    ],
    why: "unless means if not. With no water, the plant dries up.",
  },
  {
    first: "Lina fed the cat.",
    second: "Omar walked the dog.",
    joiner: "and",
    answer: "Lina fed the cat, and Omar walked the dog.",
    wrong: [
      "Lina fed the cat unless Omar walked the dog.",
      "Omar walked the dog because Lina fed the cat.",
      "Omar walked the dog, Lina fed the cat.",
    ],
    why: "and joins two jobs that go together. One did not cause the other.",
  },
  {
    first: "We made sandwiches.",
    second: "We ate them in the park.",
    joiner: "and",
    answer: "We made sandwiches, and we ate them in the park.",
    wrong: [
      "We made sandwiches, or we ate them in the park.",
      "We made sandwiches although we ate them in the park.",
      "We made sandwiches, we ate them in the park.",
    ],
    why: "and adds the next thing that happened. First the sandwiches, then the park.",
  },
  {
    first: "We can play outside.",
    second: "We can read inside.",
    joiner: "or",
    answer: "We can play outside, or we can read inside.",
    wrong: [
      "We can play outside because we can read inside.",
      "We can read inside, so we can play outside.",
      "Although we can read inside, but we can play outside.",
    ],
    why: "or gives a choice. We pick one: outside or inside.",
  },
  {
    first: "You can have juice.",
    second: "You can have milk.",
    joiner: "or",
    answer: "You can have juice, or you can have milk.",
    wrong: [
      "You can have juice since you can have milk.",
      "You can have juice when you can have milk.",
      "You can have milk, you can have juice.",
    ],
    why: "or gives a choice. Juice or milk, not both.",
  },
  {
    first: "We brushed our teeth.",
    second: "We went to bed.",
    joiner: "before",
    answer: "We brushed our teeth before we went to bed.",
    wrong: [
      "We went to bed before we brushed our teeth.",
      "We brushed our teeth, we went to bed.",
      "We brushed our teeth unless we went to bed.",
    ],
    why: "before puts things in order. Teeth first, then bed.",
  },
  {
    first: "The cake baked in the oven.",
    second: "Mom mixed the batter.",
    joiner: "before",
    answer: "Mom mixed the batter before the cake baked in the oven.",
    wrong: [
      "The cake baked in the oven before Mom mixed the batter.",
      "Mom mixed the batter, the cake baked in the oven.",
      "Mom mixed the batter while the cake baked in the oven.",
    ],
    why: "before puts things in order. The batter is mixed first, then it bakes.",
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
    first: "We will go to the beach.",
    second: "The weather is nice.",
    joiner: "if",
    answer: "If the weather is nice, we will go to the beach.",
    wrong: [
      "If we will go to the beach, the weather is nice.",
      "We will go to the beach although the weather is nice.",
      "The weather is nice, but we will go to the beach.",
    ],
    why: "if sets the condition. Nice weather first, then the beach.",
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
    const item =
      (hard
        ? makeCloze(word, pool, rng) ?? makeRecognize(word, pool, rng)
        : makeRecognize(word, pool, rng)) ?? makeListen(word, pool, rng, false);
    // The stand-ins (the harder cloze, the listen fallback) are tagged "use" and
    // "listen" by their makers. Asked for "recognize", the answer has to feed
    // "recognize", or that skill stops at streak 2 and stays due forever.
    return { ...item, skill: "recognize" };
  }
  // use
  const chain = hard
    ? [makePickSentence, makeWordForm, makeContextClue, makeCloze]
    : [makeCloze, makeContextClue, makeWordForm, makePickSentence];
  for (const make of chain) {
    const item = make(word, pool, rng);
    if (item) return item;
  }
  // No sentence holds the word itself, so every use item is out. The stand-in
  // must still feed "use", like the recognize stand-ins above: tagged "spell",
  // "use" was never answered and the word could never become known.
  return { ...makeSpell(word, pool, rng), skill: "use" };
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
