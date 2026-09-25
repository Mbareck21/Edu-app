// Catches a comprehension question that answers itself. Pure; no React, no Mongo.
//
// The case that started it (a parent's screenshot, 2026-09): the passage said
// "Strong stems protect buds from pressure." and the writer asked "Why do strong
// stems protect buds from pressure?", answer "they keep buds safe". The passage
// gives no reason at all; the question is the sentence turned into a "why", and
// the answer is the question said again in other words.

/** Words that carry no content of their own in a question or an answer. */
const STOPWORDS = new Set(
  (
    "a an the and or but if of in on at to for from by with about into onto over under up down out off " +
    "is are was were be been being am do does did done has have had can could will would should may might must " +
    "i me my we us our you your he him his she her it its they them their this that these those there here " +
    "what why how who whom whose which when where " +
    "not no yes very really just also too so because since then than as " +
    "according passage story text sentence writer author word mean means"
  ).split(" ")
);

/**
 * Words an answer can use without saying anything: "they keep buds safe" is
 * "protect buds" again, and "keep" and "safe" are what made it look new. Only
 * counted against an answer when the marked sentence adds nothing either.
 */
const EMPTY_ANSWER_WORDS = new Set(
  "keep safe help make good well better get thing way able important lot more".split(" ")
);

/** Crude stem so "stems"/"stem", "protected"/"protect", "keeps"/"keep" match. */
function stem(word: string): string {
  let w = word.replace(/['’]s$/, "");
  for (const end of ["ing", "ed", "es", "s"]) {
    if (w.length > end.length + 2 && w.endsWith(end)) {
      w = w.slice(0, -end.length);
      break;
    }
  }
  return w;
}

/** Content-word stems of a piece of text, stopwords removed. */
export function contentWords(text: string): string[] {
  return (text.toLowerCase().match(/[a-z][a-z'’]*/g) ?? [])
    .filter((w) => !STOPWORDS.has(w))
    .map(stem)
    .filter((w) => !STOPWORDS.has(w));
}

/**
 * A reason stated in words: "because", "so", "to <verb>", "which helps"...
 * "to" only counts when a verb could follow it — "to the park" is a place.
 */
const CAUSAL =
  /\b(because|so|since|therefore|in order to|so that|as a result|result|cause[sd]?|causing|due to|thanks to|which|helps?|helping|lets?|allows?|makes?|keeps?|needs?|if|when)\b|\bto (?!the\b|a\b|an\b|his\b|her\b|their\b|its\b|my\b|our\b|your\b|school\b|bed\b|them\b|him\b|me\b|us\b)[a-z]+/i;

export function hasCausalMarker(sentence: string): boolean {
  return CAUSAL.test(sentence);
}

export type QuestionForCheck = {
  q: string;
  type: string;
  /** The answer he is shown: the right option, or acceptable[0] for typing. */
  answer: string;
  /** The marked sentence, "" when there is none. */
  source: string;
};

/** Share of `words` found in `pool`. 0 for an empty list. */
function covered(words: string[], pool: Set<string>): number {
  if (words.length === 0) return 0;
  return words.filter((w) => pool.has(w)).length / words.length;
}

/** At this share of the answer's content words, the answer is the question again. */
export const RESTATE_SHARE = 0.7;

/**
 * Why a question is circular, as a line the writer can act on, or null when
 * it is fine. Three checks, all needing the question's own words to be the
 * answer:
 *
 *  1. The answer's content words are mostly the question's own
 *     ("Why do stems protect buds?" → "stems protect buds").
 *  2. The answer adds nothing beyond the question and a few empty words
 *     ("keep", "safe", "help"), AND the marked sentence adds nothing beyond the
 *     question either — so nothing in the passage backs it.
 *  3. A "why" question whose marked sentence states no reason: either it adds
 *     no word beyond the question, or it has no causal wording. Character
 *     questions (type "inference") are left out of the causal-wording check,
 *     since there the reason is shown by what someone does, not written out.
 */
export function circularReason(item: QuestionForCheck): string | null {
  const qWords = new Set(contentWords(item.q));
  const answer = contentWords(item.answer);
  const source = item.source.trim();
  const sourceWords = contentWords(source);
  // "Which is bigger, the sun or the moon?" names its answer on purpose.
  const choice = /\bor\b/i.test(item.q);

  if (!choice && answer.length > 0 && covered(answer, qWords) >= RESTATE_SHARE) {
    return `the answer "${item.answer}" only repeats the question's own words`;
  }

  const sourceAddsNothing = source !== "" && sourceWords.every((w) => qWords.has(w));
  const answerIsEmpty =
    answer.length > 0 &&
    answer.every((w) => qWords.has(w) || EMPTY_ANSWER_WORDS.has(w));
  if (!choice && answerIsEmpty && (sourceAddsNothing || source === "")) {
    return `the answer "${item.answer}" is the question said again in other words, and the passage gives no more`;
  }

  if (/\bwhy\b/i.test(item.q) && source) {
    if (sourceAddsNothing) {
      return `the marked sentence "${source}" is just the question turned around; it gives no reason`;
    }
    if (item.type !== "inference" && !hasCausalMarker(source)) {
      return `the marked sentence "${source}" states no reason (no "because", "so", "to …", "which helps" …)`;
    }
  }
  return null;
}

/** The answer a stored or generated question shows him on the reveal. */
export function shownAnswer(q: {
  options?: readonly string[];
  answerIndex?: number;
  acceptable?: readonly string[];
}): string {
  const opt = q.options && q.answerIndex !== undefined && q.answerIndex >= 0 ? q.options[q.answerIndex] : undefined;
  return opt ?? q.acceptable?.[0] ?? "";
}
