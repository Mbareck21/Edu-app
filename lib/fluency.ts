// Read-aloud fluency: he reads one part of the passage out loud, and the
// score is words read correctly per minute (WCPM) — the measure teachers use
// for oral reading fluency. What he said is lined up against the text with
// the same forgiving matcher as echo reading (lib/echo.ts), so an accent or a
// dropped "the" costs one word, not the rest of the line.
//
// Reading is already hard work for him, so the result is framed around his
// own record, and the words he missed come back as words to practise.
//
// Pure: safe to import from client components.

import { compareEcho } from "@/lib/echo";
import { MAX_WPM, countWords, splitParagraphs } from "@/lib/reading";

/** Short enough to stay fun: about a minute of reading at most. */
export const FLUENCY_MIN_WORDS = 40;
export const FLUENCY_MAX_WORDS = 120;
/** Under this share of the words heard, the mic did not really catch him. */
export const FLUENCY_HEARD_ENOUGH = 0.3;
/** Shortest read that is scored; anything quicker was a mis-tap. */
const MIN_READ_MS = 8_000;
/** Words to practise shown after a read. A list of ten is a telling-off. */
const MAX_TRICKY = 5;
/**
 * Little words the mic drops far more often than he does. Showing "and" as a
 * word to practise would be wrong, and a bit insulting.
 */
const NOT_TRICKY = new Set([
  "a", "an", "and", "the", "to", "of", "in", "on", "at", "is", "it", "was", "for", "but",
  "he", "she", "we", "they", "you", "his", "her", "its", "as", "or", "so", "up", "by",
]);

/**
 * The part to read: the first paragraph, plus the next ones while it is still
 * short, stopping before it gets long.
 */
export function fluencyPart(passage: string): string {
  const paragraphs = splitParagraphs(passage);
  let part = paragraphs[0] ?? "";
  for (const next of paragraphs.slice(1)) {
    if (countWords(part) >= FLUENCY_MIN_WORDS) break;
    if (countWords(part) + countWords(next) > FLUENCY_MAX_WORDS) break;
    part = `${part}\n\n${next}`;
  }
  return part;
}

export type FluencyResult = {
  /** Words read correctly per minute; 0 when the read could not be scored. */
  wcpm: number;
  /**
   * Words he read correctly, out of the words he reached. Words after the last
   * one he read are "not reached", not wrong, as in a teacher's running record.
   */
  correct: number;
  total: number;
  /** 0..1 */
  accuracy: number;
  /** Missed words, as written but without punctuation; first few only. */
  tricky: string[];
  /** False when the mic heard too little to score (quiet, far, or silent). */
  heardEnough: boolean;
};

export function scoreFluency(part: string, heard: string, ms: number): FluencyResult {
  const echo = compareEcho(part, heard);
  let lastRead = -1;
  echo.tokens.forEach((t, i) => {
    if (t.said) lastRead = i;
  });
  const reached = echo.tokens.slice(0, lastRead + 1);
  const total = reached.filter((t) => t.scored).length;
  const accuracy = total === 0 ? 0 : echo.matched / total;
  const heardEnough = !echo.silent && echo.pct >= FLUENCY_HEARD_ENOUGH && ms >= MIN_READ_MS;
  const seen = new Set<string>();
  const tricky: string[] = [];
  for (const t of reached) {
    if (!t.scored || t.said) continue;
    const clean = t.word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
    const key = clean.toLowerCase();
    if (!clean || NOT_TRICKY.has(key) || seen.has(key)) continue;
    seen.add(key);
    tricky.push(clean);
    if (tricky.length === MAX_TRICKY) break;
  }
  const wcpm = heardEnough ? Math.min(MAX_WPM, Math.round(echo.matched / (ms / 60_000))) : 0;
  return {
    wcpm,
    correct: echo.matched,
    total,
    accuracy,
    tricky,
    heardEnough,
  };
}

/** The headline for a scored read: his record first, never the norm. */
export function fluencyHeadline(wcpm: number, best: number | null): "first" | "record" | "close" | "good" {
  if (best === null || best <= 0) return "first";
  if (wcpm > best) return "record";
  if (wcpm >= best * 0.9) return "close";
  return "good";
}
