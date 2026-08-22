// Reading engine: pure helpers shared by the generator route and the runner.
// No React, no Mongo — safe to import anywhere.

import type { Quarter } from "@/lib/curriculum";
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

// ── Text difficulty, in Lexiles ───────────────────────────────────────────
//
// The ladder needs an outside anchor, or "level 7" means only what this app
// decides it means. Two published numbers give it one:
//
//   * The Common Core grade band for Grades 4-5 is 740L-1010L, and the Grade 4
//     end-of-year target sits at the bottom of it.
//   * The Grade 4 texts in Benchmark Advance — the program his class reads —
//     run 760L to 1030L, clustering near 850L-900L.
//
// So level 10 lands at 940L: inside his class's range and past the 740L floor.
// Level 1 starts at 450L, mid-Grade-2, which is where a Grade 3 reader can
// succeed without help. The ladder climbs evenly between the two.

/** Common Core Grades 4-5 stretch band. GRADE4_LEXILE.min is the pass mark. */
export const GRADE4_LEXILE = { min: 740, max: 1010 } as const;

/** Observed range of the Grade 4 texts in his class's reading program. */
export const CLASS_TEXT_LEXILE = { min: 760, max: 1030 } as const;

export const LEXILE_LADDER = { start: 450, end: 940 } as const;

/** Lexile target for a rung of the ladder. Level 1 = 450L, level 10 = 940L. */
export function lexileForLevel(rawLevel: number): number {
  const level = clampLevel(rawLevel);
  const step = (LEXILE_LADDER.end - LEXILE_LADDER.start) / (MAX_READING_LEVEL - 1);
  return Math.round((LEXILE_LADDER.start + step * (level - 1)) / 10) * 10;
}

/** True once the level's texts are inside the Grade 4 band. */
export function atGradeLevel(rawLevel: number): boolean {
  return lexileForLevel(rawLevel) >= GRADE4_LEXILE.min;
}

/** The rung he has to reach for his reading to count as Grade 4. */
export function levelAtGrade(): number {
  for (let l = 1; l <= MAX_READING_LEVEL; l++) {
    if (atGradeLevel(l)) return l;
  }
  return MAX_READING_LEVEL;
}

// ── Level parameters (plan §"Research-driven adjustments" item 8) ──────────

export type ReadingParams = {
  level: number;
  /** Text difficulty in Lexiles. See LEXILE_LADDER. */
  lexile: number;
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
    lexile: lexileForLevel(level),
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
 * The quarter each FPS essential standard starts being assessed in. Taken from
 * the district Year-at-a-Glance (docs/curriculum-fps-grade4.md §1).
 *
 * These gate question types alongside the reading level, because school grades
 * him on the standard whatever level his texts are at. Waiting for the ladder
 * to reach level 5 would mean never practising the Q3 standards.
 */
const STANDARD_OPENS: Record<"retell" | "theme" | "evidence", Quarter["id"]> = {
  theme: "Q2", // 4.RC.9.RL
  retell: "Q3", // 4.RC.3.RF
  evidence: "Q3", // 4.RC.14.RI
};

const QUARTER_ORDER: Quarter["id"][] = ["Q1", "Q2", "Q3", "Q4"];

/** True once school has reached the quarter that standard is assessed in. */
function quarterReached(
  now: Quarter["id"] | "summer" | undefined,
  opens: Quarter["id"]
): boolean {
  if (!now || now === "summer") return false;
  return QUARTER_ORDER.indexOf(now) >= QUARTER_ORDER.indexOf(opens);
}

/**
 * The question set for one passage. Order here is the order he answers in:
 * the two "author" prompts come first because they are what he should be
 * asking himself while reading (McKeown, Beck & Blake — Questioning the Author).
 *
 * `quarter` is the school quarter today. Pass it so a standard his class has
 * started on shows up even when his reading level has not caught up yet.
 */
export function questionPlan(
  rawLevel: number,
  kind: PassageKind,
  science: boolean,
  quarter?: Quarter["id"] | "summer"
): QuestionSpec[] {
  const level = clampLevel(rawLevel);
  const open = (id: keyof typeof STANDARD_OPENS, minLevel: number) =>
    level >= minLevel || quarterReached(quarter, STANDARD_OPENS[id]);
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

  if (open("retell", 4)) {
    out.push({
      type: "retell",
      format: "mcq",
      options: 3,
      brief:
        "Pick the best one-sentence summary of the whole passage. Three options: one right, one that is only a small detail, one that is about something else.",
    });
  }

  if (kind === "story" && open("theme", 4)) {
    out.push({
      type: "theme",
      format: "mcq",
      options: 4,
      brief:
        "Pick the lesson of the story. Four options: one theme, one plot retelling, one single detail, one theme that fits a different story.",
    });
  }

  if (kind === "info" && open("evidence", 5)) {
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

// ── Scaffolding ───────────────────────────────────────────────────────────
//
// A comprehension question has two jobs in it: find where the answer lives,
// then say it. For a reader working a grade below his own, the finding is what
// defeats him, and failing at it teaches him nothing about comprehension. So
// early on the app marks the sentence the answer comes from before he answers,
// and takes that help away as he stops needing it.
//
// The fade is driven by his own record, not the calendar. At roughly a reading
// a day the thresholds below come out near a month — but a child who is still
// struggling keeps the help, and one who is flying loses it sooner.

export type Scaffold =
  /** The source sentence is marked before he answers, with the first hint. */
  | "full"
  /** It is marked as soon as he gets one wrong. */
  | "light"
  /** Marked only on the reveal. */
  | "none";

/** Readings before the marked sentence stops being shown up front. */
export const SCAFFOLD_FULL_SESSIONS = 6;
/** Readings before help disappears altogether. */
export const SCAFFOLD_LIGHT_SESSIONS = 14;
/** First-try accuracy he has to be holding to lose a level of help. */
export const SCAFFOLD_STEADY_PCT = 70;
/** How many recent readings count toward "holding". */
const SCAFFOLD_WINDOW = 5;

function steady(recent: readonly { pct: number }[]): boolean {
  const window = recent.slice(0, SCAFFOLD_WINDOW);
  if (window.length === 0) return false;
  const mean = window.reduce((sum, r) => sum + r.pct, 0) / window.length;
  return mean >= SCAFFOLD_STEADY_PCT;
}

/**
 * How much help this reading gets. `recent` is the profile's reading log,
 * newest first.
 */
export function scaffoldFor(recent: readonly { pct: number }[]): Scaffold {
  const sessions = recent.length;
  if (sessions < SCAFFOLD_FULL_SESSIONS) return "full";
  if (!steady(recent)) return sessions < SCAFFOLD_LIGHT_SESSIONS ? "full" : "light";
  return sessions < SCAFFOLD_LIGHT_SESSIONS ? "light" : "none";
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
