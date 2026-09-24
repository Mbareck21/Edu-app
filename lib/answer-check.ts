// Free-text answer judging for reading-comprehension questions.
//
// The old isAcceptable() in lib/reading.ts demanded one string contain the
// other, so a spelling slip, a plural, or swapped word order marked him wrong
// even when he clearly understood the passage. This checker compares content
// words instead: the question tests comprehension, not spelling or typing, so
// every rule here forgives the writing and scores only the meaning.

export type AnswerVerdict = "correct" | "close" | "wrong";

export type AnswerJudgement = {
  verdict: AnswerVerdict;
  /** The acceptable answer his response matched best. "" when nothing matched. */
  matched: string;
  /** 0..1 share of the expected answer's content words he produced. */
  coverage: number;
};

/** At or above this share of the expected content words he clearly got it. */
export const CLOSE_COVERAGE = 0.6;

// Grammar glue carries no comprehension signal, so it is never scored.
// Articles are also stripped during normalisation, but they sit here too so
// the whole-string fallback and the content filter agree on what matters.
const STOPWORDS = new Set([
  "is", "are", "was", "were", "of", "to", "in", "on", "at", "it", "that",
  "this", "and", "his", "her", "their", "because", "so", "then", "there",
  "they", "he", "she", "i", "we", "you", "do", "does", "did", "a", "an",
  "the", "for", "with", "but", "as", "by", "from", "be", "been", "has",
  "have", "had", "will", "would", "can", "could",
]);

const ARTICLES = new Set(["a", "an", "the"]);

const NUMBER_WORDS: Record<string, string> = {
  zero: "0",
  one: "1",
  two: "2",
  three: "3",
  four: "4",
  five: "5",
  six: "6",
  seven: "7",
  eight: "8",
  nine: "9",
  ten: "10",
  eleven: "11",
  twelve: "12",
  thirteen: "13",
  fourteen: "14",
  fifteen: "15",
  sixteen: "16",
  seventeen: "17",
  eighteen: "18",
  nineteen: "19",
  twenty: "20",
  thirty: "30",
  forty: "40",
  fifty: "50",
  sixty: "60",
  seventy: "70",
  eighty: "80",
  ninety: "90",
};

const TENS = new Set(["20", "30", "40", "50", "60", "70", "80", "90"]);

/** "twenty one" is two written words but one number. Join them. */
function joinTens(words: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < words.length; i++) {
    const a = words[i];
    const b = words[i + 1];
    if (TENS.has(a) && b !== undefined && /^[1-9]$/.test(b)) {
      out.push(String(Number(a) + Number(b)));
      i++;
      continue;
    }
    out.push(a);
  }
  return out;
}

/** Contractions whose first half is not the verb as written. */
const NOT_BASE: Record<string, string> = { ca: "can", wo: "will", sha: "shall" };
const PLAIN_NOT = /^(do|does|did|is|was|are|were|has|have|had|could|would|should|can)nt$/;

/**
 * "didn't", "didnt" and "cannot" → the verb and "not", so "he didn't" and "he
 * did not" are the same words. Scored as one word, "doesn't" never matched the
 * "not" of an accepted "it does not fit" and a right answer was marked wrong.
 */
function splitNot(w: string): string[] {
  const m = /^([a-z]+)n't$/.exec(w) ?? PLAIN_NOT.exec(w);
  if (m) return [NOT_BASE[m[1]] ?? m[1], "not"];
  if (w === "cannot") return ["can", "not"];
  return [w];
}

/** Lower-case, punctuation-free words with articles dropped and number words
    unified with digits, so "The Five rocks!" and "5 rocks" tokenise alike. */
function tokens(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[^a-z0-9'\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.replace(/^'+|'+$/g, ""))
    .filter(Boolean)
    .flatMap(splitNot)
    .map((w) => NUMBER_WORDS[w] ?? w);
  return joinTens(words).filter((w) => !ARTICLES.has(w));
}

function contentWords(words: string[]): string[] {
  return words.filter((w) => !STOPWORDS.has(w));
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const rows = b.length + 1;
  let prev = Array.from({ length: rows }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j < rows; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    prev = cur;
  }
  return prev[b.length];
}

/** "rocks", "jumped", "boxes", "jumping" all share a stem with their base
    word. Crude on purpose — fuzzy matching catches what this misses. */
function stem(w: string): string {
  // "cried" and "cries" are "cry", which is also what "crying" comes down to.
  if (w.length > 4 && (w.endsWith("ied") || w.endsWith("ies"))) return `${w.slice(0, -3)}y`;
  if (w.length > 5 && w.endsWith("ing")) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith("es")) return w.slice(0, -2);
  if (w.length > 4 && w.endsWith("ed")) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}

/** Short words carry no room for a typo — "cat" vs "cap" is a different word,
    not a slip — so fuzzy matching only starts at four letters. A number has
    no typos either: "1000" is not "100", and "1775" is not "1776". */
function fuzzyEqual(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  if (len < 4) return false;
  if (/\d/.test(a) || /\d/.test(b)) return false;
  const allowed = len >= 7 ? 2 : 1;
  return levenshtein(a, b) <= allowed;
}

type MatchQuality = "exact" | "loose" | "none";

/** "no water" and "not any water" say the same thing. */
const SAME_NEGATION = new Set(["no", "not", "never"]);

/** Exact beats loose so a fully exact answer can be told apart from one that
    needed spelling forgiveness. A word that is itself in the passage is never
    a typo: "thursday" for "tuesday" is the other day the story named. */
function bestMatch(expected: string, given: string[], passage: ReadonlySet<string>): MatchQuality {
  if (given.includes(expected)) return "exact";
  if (SAME_NEGATION.has(expected) && given.some((w) => SAME_NEGATION.has(w))) return "exact";
  const s = stem(expected);
  if (given.some((w) => stem(w) === s || (!passage.has(w) && fuzzyEqual(expected, w)))) {
    return "loose";
  }
  return "none";
}

type Candidate = {
  verdict: AnswerVerdict;
  coverage: number;
};

const HELPING_VERB_START = /^\s*(is|are|was|were|do|does|did|can|could|will|would|should|has|have|had)\b/i;

/**
 * A question that asks for a yes or a no: its question part opens with a
 * helping verb. The writer often leads in with what the passage said ("The
 * writer said the soil was dry. Does the flood fit that?") or a short phrase
 * ("In the end, did he win?"), so the test runs on the last sentence, at the
 * start of its first or last clause. "What does ..." and "Why did ..." still
 * open with a question word, so they never count.
 */
function isYesNoQuestion(question: string): boolean {
  // "Why did she stay inside, do you think?" asks why, not yes or no.
  const asked = question.trim().replace(/[,;]?\s*do you think\s*\??$/i, "?");
  const sentences = asked.split(/(?<=[.!?])\s+/);
  const clauses = (sentences[sentences.length - 1] ?? "").split(/[,;:]/);
  return [clauses[0], clauses[clauses.length - 1]].some((c) =>
    HELPING_VERB_START.test(c ?? "")
  );
}

const POLARITY: Record<string, "yes" | "no"> = {
  yes: "yes", yeah: "yes", yep: "yes", yup: "yes",
  no: "no", nope: "no", nah: "no",
};

const NEGATIONS = new Set(["no", "not", "never", "nothing", "none", "nobody", "nowhere", "cannot"]);

/** "doesn't", and the same typed without its apostrophe, which he often does. */
const CONTRACTED_NOT = /n't$|^(do|does|did|is|was|are|were|has|have|had|could|would|should|ca|wo)nt$/;

/** True when the words say something is not so: "not happy", "it doesn't match". */
function hasNegation(words: string[]): boolean {
  return words.some((w) => NEGATIONS.has(w) || CONTRACTED_NOT.test(w));
}

/**
 * Whether his answer and an accepted one disagree about whether it is so.
 *
 * The accepted answer's leading yes or no is set aside: it answers a yes/no
 * question, which the polarity rule above has already dealt with, so "no, it
 * was dry" and "it was dry" say the same thing. His own leading "no" or "nope"
 * counts as saying no on any other kind of question.
 */
function contradicts(answer: string[], expected: string[], yesNo: boolean): boolean {
  const said = POLARITY[answer[0] ?? ""];
  const mine = hasNegation(said ? answer.slice(1) : answer) || (said === "no" && !yesNo);
  const theirs = hasNegation(yesNo && POLARITY[expected[0] ?? ""] ? expected.slice(1) : expected);
  return mine !== theirs;
}

const VERDICT_RANK: Record<AnswerVerdict, number> = { wrong: 0, close: 1, correct: 2 };

/** A leading yes or no. "No one would play" starts with no, but is not one. */
function leadingPolarity(words: string[]): "yes" | "no" | undefined {
  if (words[0] === "no" && (words[1] === "one" || words[1] === "1")) return undefined;
  return POLARITY[words[0] ?? ""];
}

/** True when the word, or a spelling slip of it, is one the question used. */
function inQuestion(w: string, question: readonly string[]): boolean {
  return question.some((q) => stem(q) === stem(w) || fuzzyEqual(q, w));
}

/**
 * The yes or no an answer gives by saying the question back: "he didn't give
 * up" to "Did Omar give up?" is a no, "it fits" to "Does it fit?" is a yes.
 * Only when every content word comes from the question; an answer that adds
 * something of its own is scored on what it adds.
 */
function restatedPolarity(words: string[], question: readonly string[]): "yes" | "no" | undefined {
  const content = contentWords(words).filter((w) => !NEGATIONS.has(w));
  if (content.length === 0 || !content.every((w) => inQuestion(w, question))) return undefined;
  return hasNegation(words) ? "no" : "yes";
}

function judgeAgainst(
  answerWords: string[],
  acceptable: string,
  question: string,
  passage: ReadonlySet<string>
): Candidate {
  const accepted = tokens(acceptable);
  const yesNo = isYesNoQuestion(question);
  const asked = tokens(question);
  const said = leadingPolarity(accepted);
  // On a yes/no question the accepted "no, it was dry" is a no plus what is so.
  // Scored whole, "it was dry" named half of it and was marked wrong.
  const expected = contentWords(yesNo && said && accepted.length > 1 ? accepted.slice(1) : accepted);
  const questionWords = new Set(asked.map(stem));

  // "Does the ending fit?" is answered by "yes". The writer phrases the
  // acceptable answers in full ("yes it fits"), and scoring content words
  // marked a plain "yes" half right, so wrong. On a yes/no question his first
  // word decides: the same yes or no is right, the opposite is wrong. Either
  // side can also say it by repeating the question: "it fits", "he didn't give up".
  const lead = yesNo ? (said ?? restatedPolarity(accepted, asked)) : undefined;
  if (lead) {
    const his = leadingPolarity(answerWords) ?? restatedPolarity(answerWords, asked);
    if (his === lead) return { verdict: "correct", coverage: 1 };
    if (his) return { verdict: "wrong", coverage: 0 };
  }

  // Content words score what he named, not whether he said it was so. "it
  // doesn't match" names "match" and would pass against "it matches", and
  // "not happy" would pass against "happy". An answer that says no where the
  // accepted one says yes, or the other way round, means the opposite.
  if (contradicts(answerWords, accepted, yesNo)) {
    return { verdict: "wrong", coverage: 0 };
  }

  // An answer like "he did" is nothing but stopwords, so content-word scoring
  // has nothing to score. Compare the whole normalised strings instead, still
  // forgiving spelling.
  if (expected.length === 0) {
    const a = answerWords.join(" ");
    const b = tokens(acceptable).join(" ");
    if (b.length === 0) return { verdict: "wrong", coverage: 0 };
    if (a === b) return { verdict: "correct", coverage: 1 };
    if (fuzzyEqual(a, b)) return { verdict: "close", coverage: 1 };
    return { verdict: "wrong", coverage: 0 };
  }

  const given = contentWords(answerWords);
  // Words the question already said are not the answer. "What did Layla plant
  // in the garden?" is not answered by "Layla planted in the garden", which
  // named three of the five words in "Layla planted tomato seeds in the garden".
  const focus = expected.filter((w) => !questionWords.has(stem(w)));
  const scored = focus.length > 0 ? focus : expected;
  let exact = 0;
  let loose = 0;
  for (const word of scored) {
    const q = bestMatch(word, given, passage);
    if (q === "exact") exact++;
    else if (q === "loose") loose++;
  }
  const coverage = (exact + loose) / scored.length;

  // Full coverage with every word spelled right is correct; full coverage
  // that leaned on stem or fuzzy matches means he understood but the writing
  // was rough — close, which the caller still accepts.
  if (coverage === 1) return { verdict: loose === 0 ? "correct" : "close", coverage };
  if (coverage >= CLOSE_COVERAGE) return { verdict: "close", coverage };

  // "a model" for "a small model": two content words where he named the thing
  // and left off the describing word. Half the words, so wrong by coverage,
  // but he found the answer. Not when the thing is already in the question
  // ("What color was the car?" is not answered by "car"), and not when the
  // first word flips the meaning ("not happy").
  if (
    scored.length === 2 &&
    !NEGATIONS.has(scored[0]) &&
    !questionWords.has(stem(scored[1])) &&
    bestMatch(scored[1], given, passage) !== "none"
  ) {
    return { verdict: "close", coverage };
  }
  return { verdict: "wrong", coverage };
}

/**
 * Judges a typed answer against every acceptable phrasing and reports the
 * best outcome. Order-blind and extra-word-blind: producing the expected
 * content words is what counts, however he arranged or padded them.
 */
export function judgeAnswer(
  answer: string,
  acceptable: readonly string[],
  /** The question asked. Lets a yes/no question take a plain yes. */
  question = "",
  /** The passage. A word from it is never forgiven as a typo of another. */
  passage = ""
): AnswerJudgement {
  const answerWords = tokens(answer);
  if (answerWords.length === 0) return { verdict: "wrong", matched: "", coverage: 0 };
  const passageWords = new Set(tokens(passage));

  let best: AnswerJudgement = { verdict: "wrong", matched: "", coverage: 0 };
  for (const acc of acceptable) {
    const c = judgeAgainst(answerWords, acc, question, passageWords);
    const better =
      VERDICT_RANK[c.verdict] > VERDICT_RANK[best.verdict] ||
      (VERDICT_RANK[c.verdict] === VERDICT_RANK[best.verdict] && c.coverage > best.coverage);
    if (better) {
      best = { verdict: c.verdict, matched: c.coverage > 0 ? acc : "", coverage: c.coverage };
    }
  }
  return best;
}
