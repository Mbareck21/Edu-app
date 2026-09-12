// Echo reading: score what he said out loud against the sentence he heard.
//
// Echo reading (reader says a sentence, child repeats it) is the standard
// fluency + prosody drill for a second-language reader — see docs/pedagogy.md.
// Scoring has to be forgiving in two directions at once:
//
//   1. Whisper mishears a 9-year-old with an Arabic accent all the time, so a
//      near-miss spelling must still count.
//   2. He may add "um", repeat a word, or drop "the" — which should not push
//      every later word out of alignment.
//
// So: fuzzy token equality, then a longest-common-subsequence alignment that
// tolerates insertions and omissions.

import { toWords } from "@/lib/number-words";

/** Share of the sentence's words he has to land for the turn to pass. */
export const ECHO_PASS = 0.75;
/** At or above this it is celebrated rather than merely accepted. */
export const ECHO_GREAT = 0.9;

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

/**
 * Lower-case, punctuation-free words, with every number broken into the words
 * it is spoken as and each of those written as a digit: "25", "twenty-five"
 * and "twenty five" all become ["20", "5"]. The screen shows "twenty five" as
 * two words and Whisper writes "25", so a number has to line up one spoken
 * word at a time. Digits, not words, so a number never fuzzy-matches a
 * look-alike ("five" and "fire").
 */
export function echoTokens(text: string): string[] {
  return (
    text
      .toLowerCase()
      .replace(/[‘’]/g, "'")
      // Whisper writes "1,000"; without this it reads as a 1 and a 0.
      .replace(/(\d),(?=\d{3}\b)/g, "$1")
      .replace(/\d+/g, (digits) => toWords(Number(digits)) || digits)
      .replace(/[^a-z0-9'\s]/g, " ")
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w.replace(/^'+|'+$/g, ""))
      .filter(Boolean)
      .map((w) => NUMBER_WORDS[w] ?? w)
  );
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

/** Close enough for a spoken repeat: exact, or one typo per four letters. */
export function echoWordMatch(target: string, heard: string): boolean {
  if (target === heard) return true;
  const len = Math.max(target.length, heard.length);
  if (len < 4) return false;
  const allowed = len >= 7 ? 2 : 1;
  return levenshtein(target, heard) <= allowed;
}

export type EchoToken = {
  /** The word as it is written in the sentence, punctuation and all. */
  word: string;
  said: boolean;
  /** False for a token with nothing to say — a lone dash. Never marked wrong. */
  scored: boolean;
};

export type EchoScore = {
  tokens: EchoToken[];
  matched: number;
  total: number;
  /** 0..1 share of the sentence's words he said. */
  pct: number;
  pass: boolean;
  great: boolean;
  /** True when the mic returned nothing at all. */
  silent: boolean;
};

/**
 * Aligns the heard words to the sentence's words with an LCS so a dropped or
 * doubled word costs one word, not the rest of the line.
 */
export function compareEcho(sentence: string, heard: string): EchoScore {
  // Display words keep their punctuation; scoring words do not. Most display
  // words hold one scoring word, but "25" and "twenty-five" hold two, so each
  // scoring word remembers which display word it came from.
  const display = sentence.split(/\s+/).filter(Boolean);
  const target: string[] = [];
  const owner: number[] = [];
  display.forEach((w, d) => {
    for (const t of echoTokens(w)) {
      target.push(t);
      owner.push(d);
    }
  });
  const said = echoTokens(heard);

  const n = target.length;
  const m = said.length;
  const empty = said.length === 0;

  // dp[i][j] = LCS length of target[i..] and said[j..]
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = echoWordMatch(target[i], said[j])
        ? dp[i + 1][j + 1] + 1
        : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  // A display word counts as said once every scoring word in it was heard.
  const missing = display.map(() => 0);
  for (const d of owner) missing[d]++;
  const scored = missing.map((count) => count > 0);
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (echoWordMatch(target[i], said[j])) {
      missing[owner[i]]--;
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      i++;
    } else {
      j++;
    }
  }

  const tokens: EchoToken[] = display.map((word, d) => ({
    word,
    said: scored[d] && missing[d] === 0,
    scored: scored[d],
  }));

  // Words with no letters or digits at all (a lone dash) can never be said, so
  // they are not counted against him.
  const matched = tokens.filter((t) => t.said).length;
  const total = scored.filter(Boolean).length;
  const pct = total === 0 ? 0 : matched / total;
  return {
    tokens,
    matched,
    total,
    pct,
    pass: !empty && pct >= ECHO_PASS,
    great: !empty && pct >= ECHO_GREAT,
    silent: empty,
  };
}
