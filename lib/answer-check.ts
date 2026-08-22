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
  if (w.length > 5 && w.endsWith("ing")) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith("es")) return w.slice(0, -2);
  if (w.length > 4 && w.endsWith("ed")) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}

/** Short words carry no room for a typo — "cat" vs "cap" is a different word,
    not a slip — so fuzzy matching only starts at four letters. */
function fuzzyEqual(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  if (len < 4) return false;
  const allowed = len >= 7 ? 2 : 1;
  return levenshtein(a, b) <= allowed;
}

type MatchQuality = "exact" | "loose" | "none";

/** Exact beats loose so a fully exact answer can be told apart from one that
    needed spelling forgiveness. */
function bestMatch(expected: string, given: string[]): MatchQuality {
  if (given.includes(expected)) return "exact";
  const s = stem(expected);
  if (given.some((w) => stem(w) === s || fuzzyEqual(expected, w))) return "loose";
  return "none";
}

type Candidate = {
  verdict: AnswerVerdict;
  coverage: number;
};

const VERDICT_RANK: Record<AnswerVerdict, number> = { wrong: 0, close: 1, correct: 2 };

function judgeAgainst(answerWords: string[], acceptable: string): Candidate {
  const expected = contentWords(tokens(acceptable));

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
  let exact = 0;
  let loose = 0;
  for (const word of expected) {
    const q = bestMatch(word, given);
    if (q === "exact") exact++;
    else if (q === "loose") loose++;
  }
  const coverage = (exact + loose) / expected.length;

  // Full coverage with every word spelled right is correct; full coverage
  // that leaned on stem or fuzzy matches means he understood but the writing
  // was rough — close, which the caller still accepts.
  if (coverage === 1) return { verdict: loose === 0 ? "correct" : "close", coverage };
  if (coverage >= CLOSE_COVERAGE) return { verdict: "close", coverage };
  return { verdict: "wrong", coverage };
}

/**
 * Judges a typed answer against every acceptable phrasing and reports the
 * best outcome. Order-blind and extra-word-blind: producing the expected
 * content words is what counts, however he arranged or padded them.
 */
export function judgeAnswer(answer: string, acceptable: readonly string[]): AnswerJudgement {
  const answerWords = tokens(answer);
  if (answerWords.length === 0) return { verdict: "wrong", matched: "", coverage: 0 };

  let best: AnswerJudgement = { verdict: "wrong", matched: "", coverage: 0 };
  for (const acc of acceptable) {
    const c = judgeAgainst(answerWords, acc);
    const better =
      VERDICT_RANK[c.verdict] > VERDICT_RANK[best.verdict] ||
      (VERDICT_RANK[c.verdict] === VERDICT_RANK[best.verdict] && c.coverage > best.coverage);
    if (better) {
      best = { verdict: c.verdict, matched: c.coverage > 0 ? acc : "", coverage: c.coverage };
    }
  }
  return best;
}
