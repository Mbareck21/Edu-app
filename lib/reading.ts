// Reading engine: pure helpers shared by the generator route and the runner.
// No React, no Mongo — safe to import anywhere.

import type { ReadingQuestionType } from "@/lib/models/WordList";

/** The profile's reading ladder runs 1..10 (see lib/rewards.ts). */
export const MAX_READING_LEVEL = 10;

/**
 * Hu & Nation 98% coverage: the most words a passage may carry that he will
 * not know. The single source — the prompt is handed this number, and the
 * generator validates the glossary against it.
 */
export const MAX_UNKNOWN_BUDGET = 6;

/** Glossary cap the generator accepts: the budget plus slack for a model that
    glosses a word or two more than it was asked to. */
export const MAX_GLOSSARY_ENTRIES = MAX_UNKNOWN_BUDGET + 2;

/** Story = narrative, info = informational (science / social studies). */
export type PassageKind = "story" | "info";

// ── Level parameters (plan §"Research-driven adjustments" item 8) ──────────

export type ReadingParams = {
  level: number;
  /** Words the passage should land on: 110 at L1 → 380 at L10. */
  targetWords: number;
  minWords: number;
  maxWords: number;
  /** Longest sentence allowed: 9 words at L1 → 18 at L10. */
  maxSentenceWords: number;
  /** Hu & Nation 98% coverage: at most this many words he will not know. */
  unknownBudget: number;
  /** Paragraph count that keeps the passage scannable at this length. */
  paragraphs: number;
};

export function clampLevel(level: number): number {
  if (!Number.isFinite(level)) return 1;
  return Math.max(1, Math.min(MAX_READING_LEVEL, Math.round(level)));
}

export function readingParams(rawLevel: number): ReadingParams {
  const level = clampLevel(rawLevel);
  const targetWords = 110 + 30 * (level - 1);
  return {
    level,
    targetWords,
    minWords: Math.round(targetWords * 0.85),
    maxWords: Math.round(targetWords * 1.25),
    maxSentenceWords: 8 + level,
    unknownBudget: MAX_UNKNOWN_BUDGET,
    paragraphs: level <= 2 ? 2 : level <= 5 ? 3 : 4,
  };
}

// ── Question plan ─────────────────────────────────────────────────────────

export type QuestionFormat = "text" | "mcq";

export type QuestionSpec = {
  type: ReadingQuestionType;
  format: QuestionFormat;
  /** How many options an MCQ must carry. */
  options?: number;
  /** What the writer has to produce for this slot. Goes into the prompt. */
  brief: string;
};

/**
 * The question set for one passage. Order here is the order he answers in:
 * the two "author" prompts come first because they are what he should be
 * asking himself while reading (McKeown, Beck & Blake — Questioning the Author).
 */
export function questionPlan(
  rawLevel: number,
  kind: PassageKind,
  science: boolean
): QuestionSpec[] {
  const level = clampLevel(rawLevel);
  const out: QuestionSpec[] = [
    {
      type: "author",
      format: "text",
      brief:
        "What is the writer telling us in the first part? Ask it about THIS passage, naming a person, place or thing from it.",
    },
    {
      type: "author",
      format: "text",
      brief:
        "Does the later part fit what the writer said before? Ask him to connect two parts of the passage.",
    },
    {
      type: level >= 5 ? "sequence" : "detail",
      format: "text",
      brief:
        level >= 5
          ? "One order question: what happened before or after something named in the passage."
          : "One fact question. The answer is written straight out in the passage.",
    },
  ];

  if (level >= 3) {
    out.push({
      type: "inference",
      format: "text",
      brief:
        "One question whose answer is NOT written down. He has to work it out from what the passage shows.",
    });
  }

  if (level >= 4) {
    out.push({
      type: "retell",
      format: "mcq",
      options: 3,
      brief:
        "Pick the best one-sentence summary of the whole passage. Three options: one right, one that is only a small detail, one that is about something else.",
    });
  }

  if (kind === "story" && level >= 4) {
    out.push({
      type: "theme",
      format: "mcq",
      options: 4,
      brief:
        "Pick the lesson of the story. Four options: one theme, one plot retelling, one single detail, one theme that fits a different story.",
    });
  }

  if (kind === "info" && level >= 5) {
    out.push({
      type: "evidence",
      format: "mcq",
      options: 4,
      brief:
        "Name a point the writer makes, then ask which sentence is his evidence for it. The four options must be four sentences copied word for word from the passage.",
    });
  }

  if (science) {
    for (let i = 0; i < 2; i++) {
      out.push({
        type: "science_fact",
        format: "mcq",
        options: 3,
        brief:
          "A fact check: did the passage actually say this? Three options, one true to the passage. Keep the science simple.",
      });
    }
  }

  return out;
}

// ── Free-text answer acceptance (ported from InteractiveReading) ───────────

function stripArticle(s: string): string {
  return s.replace(/^(a|an|the)\s+/, "");
}

/**
 * Loose match: articles ignored, either side may contain the other. Generous
 * on purpose — typing is not the skill being tested here.
 */
export function isAcceptable(answer: string, acceptable: readonly string[]): boolean {
  const raw = answer.trim().toLowerCase();
  if (!raw) return false;
  const a = stripArticle(raw);
  return acceptable.some((acc) => {
    const bRaw = acc.trim().toLowerCase();
    if (!bRaw) return false;
    const b = stripArticle(bRaw);
    if (a === b) return true;
    if (a.length >= 2 && b.includes(a)) return true;
    if (b.length >= 2 && a.includes(b)) return true;
    return false;
  });
}

// ── Text helpers ──────────────────────────────────────────────────────────

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** Blank-line separated blocks, falling back to the whole text. */
export function splitParagraphs(text: string): string[] {
  const parts = text
    .split(/\n\s*\n|\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : [text.trim()];
}

export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Longest sentence in the passage, in words. Used to police the level. */
export function longestSentenceWords(text: string): number {
  return splitSentences(text).reduce((max, s) => Math.max(max, countWords(s)), 0);
}

/** Highest wpm the server will store. Matches the zod max on the session route. */
export const MAX_WPM = 1000;

/** Words per minute for a timed read. 0 when the timing is unusable. */
export function wordsPerMinute(wordsCount: number, ms: number): number {
  if (wordsCount <= 0 || ms < 2000) return 0;
  const wpm = Math.round(wordsCount / (ms / 60000));
  return Math.min(MAX_WPM, Math.max(0, wpm));
}

/**
 * Hasbrouck & Tindal 2017, Grade 4 50th percentile, by term.
 * Only used to give the parent a "this is where he should be" number.
 */
export const WPM_NORMS_GRADE4 = { fall: 94, winter: 120, spring: 133 } as const;

export function wpmNormForDate(date: Date = new Date()): number {
  const m = date.getMonth(); // 0-11
  if (m >= 7 && m <= 10) return WPM_NORMS_GRADE4.fall; // Aug-Nov
  if (m === 11 || m <= 1) return WPM_NORMS_GRADE4.winter; // Dec-Feb
  return WPM_NORMS_GRADE4.spring;
}
