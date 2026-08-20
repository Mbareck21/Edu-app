import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

import type { SkillStateLike } from "@/lib/types";

// ── Reading comprehension types ───────────────────────────────────────────

export const READING_QUESTION_TYPES = [
  "main_idea",
  "detail",
  "vocab",
  "inference",
  "cause_effect",
  "sequence",
  // Added with the reading engine rebuild. "author" = Questioning-the-Author
  // prompt, "retell" = pick the best summary, "theme" = the story's lesson,
  // "evidence" = which sentence backs the writer's point, "science_fact" =
  // did the passage actually say this.
  "author",
  "retell",
  "theme",
  "evidence",
  "science_fact",
] as const;
export type ReadingQuestionType = (typeof READING_QUESTION_TYPES)[number];

const ReadingQuestionSchema = new Schema(
  {
    q: { type: String, required: true },
    type: {
      type: String,
      enum: READING_QUESTION_TYPES as unknown as string[],
      default: "detail",
    },
    acceptable: { type: [String], default: [] },
    hints: { type: [String], default: [] },
    // MCQ questions carry options + the index of the right one. Free-text
    // questions leave options empty and answerIndex at -1.
    options: { type: [String], default: [] },
    answerIndex: { type: Number, default: -1 },
    // The sentence from the passage the answer comes from. Highlighted on reveal.
    source: { type: String, default: "" },
  },
  { _id: false }
);

const VocabGlossSchema = new Schema(
  {
    word: { type: String, default: "" },
    arabic: { type: String, default: "" },
    // Grade-3 English meaning. Shown first; the Arabic sits behind a chip.
    meaning: { type: String, default: "" },
  },
  { _id: false }
);

const CurrentReadingSchema = new Schema(
  {
    title: { type: String, default: "" },
    paragraph: { type: String, default: "" },
    questions: { type: [ReadingQuestionSchema], default: [] },
    vocabGlosses: { type: [VocabGlossSchema], default: [] },
    level: { type: Number, default: 1 },
    // "story" (narrative) or "info" (informational). Old docs read as "story".
    passageKind: { type: String, default: "story" },
    // What the passage is about — the science unit or reading theme title.
    topic: { type: String, default: "" },
    generatedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

// Rolling memory of recent readings so the AI doesn't repeat itself.
// Kept server-side only; not exposed to the client.
const ReadingHistoryEntrySchema = new Schema(
  {
    title: { type: String, default: "" },
    opening: { type: String, default: "" },
    kind: { type: String, default: "story" },
    topic: { type: String, default: "" },
    generatedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const TypeBucketSchema = new Schema(
  {
    asked: { type: Number, default: 0 },
    firstTryCorrect: { type: Number, default: 0 },
  },
  { _id: false }
);

const ByTypeSchema = new Schema(
  {
    main_idea: { type: TypeBucketSchema, default: () => ({}) },
    detail: { type: TypeBucketSchema, default: () => ({}) },
    vocab: { type: TypeBucketSchema, default: () => ({}) },
    inference: { type: TypeBucketSchema, default: () => ({}) },
    cause_effect: { type: TypeBucketSchema, default: () => ({}) },
    sequence: { type: TypeBucketSchema, default: () => ({}) },
    author: { type: TypeBucketSchema, default: () => ({}) },
    retell: { type: TypeBucketSchema, default: () => ({}) },
    theme: { type: TypeBucketSchema, default: () => ({}) },
    evidence: { type: TypeBucketSchema, default: () => ({}) },
    science_fact: { type: TypeBucketSchema, default: () => ({}) },
  },
  { _id: false }
);

const RecentSessionSchema = new Schema(
  {
    completedAt: { type: Date, default: Date.now },
    level: { type: Number, default: 1 },
    scorePct: { type: Number, default: 0 },
    questionsCount: { type: Number, default: 0 },
    hintsUsed: { type: Number, default: 0 },
    perfect: { type: Boolean, default: false },
  },
  { _id: false }
);

const ReadingStatsSchema = new Schema(
  {
    totalSessions: { type: Number, default: 0 },
    totalQuestions: { type: Number, default: 0 },
    totalFirstTryCorrect: { type: Number, default: 0 },
    totalHintsUsed: { type: Number, default: 0 },
    byType: { type: ByTypeSchema, default: () => ({}) },
    recentSessions: { type: [RecentSessionSchema], default: [] },
  },
  { _id: false }
);

// ── Word + WordList ────────────────────────────────────────────────────────

// SRS (spaced-repetition) state for the flashcards feature. New cards have
// interval=0 and dueAt=now so they show up immediately on first visit.
const SrsStateSchema = new Schema(
  {
    interval: { type: Number, default: 0 }, // days
    dueAt: { type: Date, default: () => new Date() },
    lastReviewed: { type: Date, default: null },
    reviewCount: { type: Number, default: 0 },
    easyCount: { type: Number, default: 0 },
    hardCount: { type: Number, default: 0 },
  },
  { _id: false }
);

// Per-skill mastery state. A word is only "known" once every skill sticks.
//   recognize = meaning → word (MCQ)
//   listen    = audio → word
//   spell     = produce the spelling
//   use       = cloze / sentence usage
export const SKILL_IDS = ["recognize", "listen", "spell", "use"] as const;
export type SkillId = (typeof SKILL_IDS)[number];

const SkillStateSchema = new Schema(
  {
    correct: { type: Number, default: 0 },
    wrong: { type: Number, default: 0 },
    streak: { type: Number, default: 0 },
    lastAt: { type: Date, default: null },
    dueAt: { type: Date, default: () => new Date() },
  },
  { _id: false }
);

const WordSkillsSchema = new Schema(
  {
    recognize: { type: SkillStateSchema, default: () => ({}) },
    listen: { type: SkillStateSchema, default: () => ({}) },
    spell: { type: SkillStateSchema, default: () => ({}) },
    use: { type: SkillStateSchema, default: () => ({}) },
  },
  { _id: false }
);

const WordSchema = new Schema(
  {
    word: { type: String, required: true, trim: true, lowercase: true },
    clue: { type: String, trim: true, default: "" },
    arabic: { type: String, trim: true, default: "" },
    explanation: { type: String, trim: true, default: "" },
    // Three short sentences showing the most common uses. Filled by the AI.
    examples: { type: [String], default: [] },
    // Word family: related forms (brave / bravely / bravery). Filled by the AI.
    family: { type: [String], default: [] },
    srs: { type: SrsStateSchema, default: () => ({}) },
    skills: { type: WordSkillsSchema, default: () => ({}) },
  },
  { _id: false }
);

// Unit path progress, keyed by step id ("flashcards" | "match" | ...).
// One entry per step the kid has played at least once.
const PathStepSchema = new Schema(
  {
    completedAt: { type: Date, default: null },
    bestPct: { type: Number, default: 0 },
    plays: { type: Number, default: 0 },
  },
  { _id: false }
);

const WordListSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    hiddenMessage: { type: String, trim: true, default: "" },
    words: { type: [WordSchema], default: [] },
    readingLevel: { type: Number, default: 1, min: 1, max: 10 },
    currentReading: { type: CurrentReadingSchema, default: null },
    readingHistory: { type: [ReadingHistoryEntrySchema], default: [] },
    readingStats: { type: ReadingStatsSchema, default: () => ({}) },
    pathProgress: { type: Map, of: PathStepSchema, default: () => ({}) },
  },
  { timestamps: true }
);

export type WordListDoc = InferSchemaType<typeof WordListSchema> & { _id: unknown };

export const WordList: Model<WordListDoc> =
  (models.WordList as Model<WordListDoc>) ||
  model<WordListDoc>("WordList", WordListSchema);

// ── Client types ──────────────────────────────────────────────────────────

export type SrsState = {
  interval: number;
  dueAt: string; // ISO
  lastReviewed: string | null; // ISO
  reviewCount: number;
  easyCount: number;
  hardCount: number;
};

export type SkillState = {
  correct: number;
  wrong: number;
  streak: number;
  lastAt: string | null; // ISO
  dueAt: string; // ISO
};

export type WordSkills = Record<SkillId, SkillState>;

export type ClientWord = {
  word: string;
  clue: string;
  arabic: string;
  explanation: string;
  examples: string[];
  family: string[];
  srs: SrsState;
  skills: WordSkills;
};

export type ReadingQuestion = {
  q: string;
  type: ReadingQuestionType;
  acceptable: string[];
  hints: string[];
  /** Empty for free-text questions. */
  options: string[];
  /** -1 for free-text questions. */
  answerIndex: number;
  /** Sentence from the passage the answer comes from; "" when unknown. */
  source: string;
};

export type VocabGloss = { word: string; arabic: string; meaning: string };

export type PassageKind = "story" | "info";

export type CurrentReading = {
  title: string;
  paragraph: string;
  questions: ReadingQuestion[];
  vocabGlosses: VocabGloss[];
  level: number;
  passageKind: PassageKind;
  topic: string;
  generatedAt: string; // ISO
};

export type ReadingTypeStats = { asked: number; firstTryCorrect: number };

export type ReadingByType = Record<ReadingQuestionType, ReadingTypeStats>;

export type ReadingSessionLog = {
  completedAt: string;
  level: number;
  scorePct: number;
  questionsCount: number;
  hintsUsed: number;
  perfect: boolean;
};

export type ReadingStats = {
  totalSessions: number;
  totalQuestions: number;
  totalFirstTryCorrect: number;
  totalHintsUsed: number;
  byType: ReadingByType;
  recentSessions: ReadingSessionLog[];
};

export type PathStep = {
  /** ISO date, or null when the step was played but not passed yet. */
  completedAt: string | null;
  bestPct: number;
  plays: number;
};

/** Keyed by StepId; a step with no entry has never been played. */
export type PathProgress = Record<string, PathStep>;

export type ClientWordList = {
  _id: string;
  name: string;
  hiddenMessage: string;
  words: ClientWord[];
  readingLevel: number;
  currentReading: CurrentReading | null;
  readingStats: ReadingStats;
  pathProgress: PathProgress;
  createdAt: string;
  updatedAt: string;
};

// Defaults for old documents that pre-date the reading schema.
function emptyByType(): ReadingByType {
  return {
    main_idea: { asked: 0, firstTryCorrect: 0 },
    detail: { asked: 0, firstTryCorrect: 0 },
    vocab: { asked: 0, firstTryCorrect: 0 },
    inference: { asked: 0, firstTryCorrect: 0 },
    cause_effect: { asked: 0, firstTryCorrect: 0 },
    sequence: { asked: 0, firstTryCorrect: 0 },
    author: { asked: 0, firstTryCorrect: 0 },
    retell: { asked: 0, firstTryCorrect: 0 },
    theme: { asked: 0, firstTryCorrect: 0 },
    evidence: { asked: 0, firstTryCorrect: 0 },
    science_fact: { asked: 0, firstTryCorrect: 0 },
  };
}

function emptyStats(): ReadingStats {
  return {
    totalSessions: 0,
    totalQuestions: 0,
    totalFirstTryCorrect: 0,
    totalHintsUsed: 0,
    byType: emptyByType(),
    recentSessions: [],
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeByType(raw: any): ReadingByType {
  const fallback = emptyByType();
  if (!raw || typeof raw !== "object") return fallback;
  for (const t of READING_QUESTION_TYPES) {
    const bucket = raw[t];
    if (bucket && typeof bucket === "object") {
      fallback[t] = {
        asked: Number(bucket.asked) || 0,
        firstTryCorrect: Number(bucket.firstTryCorrect) || 0,
      };
    }
  }
  return fallback;
}

/**
 * One raw skill sub-document → its client shape. The single normaliser: the
 * session route feeds it into the scheduler, toClientWord renders it.
 * A missing dueAt means "due now" — an untouched skill belongs in the next
 * session, not parked in 1970.
 */
export function toSkillState(
  raw: SkillStateLike | null | undefined,
  now: Date = new Date()
): SkillState {
  const s = raw ?? {};
  return {
    correct: Number(s.correct) || 0,
    wrong: Number(s.wrong) || 0,
    streak: Number(s.streak) || 0,
    lastAt: s.lastAt ? new Date(s.lastAt).toISOString() : null,
    dueAt: s.dueAt ? new Date(s.dueAt).toISOString() : now.toISOString(),
  };
}

// Map one raw word subdoc to its client shape, filling in defaults so old
// documents that pre-date arabic/srs render as empty translation + new SRS.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toClientWord(w: any): ClientWord {
  const srs = w?.srs ?? {};
  const rawSkills = w?.skills ?? {};
  const skills = {} as WordSkills;
  for (const id of SKILL_IDS) {
    skills[id] = toSkillState(rawSkills?.[id]);
  }
  return {
    word: String(w?.word ?? ""),
    clue: String(w?.clue ?? ""),
    arabic: String(w?.arabic ?? ""),
    explanation: String(w?.explanation ?? ""),
    examples: Array.isArray(w?.examples) ? w.examples.map(String) : [],
    family: Array.isArray(w?.family) ? w.family.map(String) : [],
    skills,
    srs: {
      interval: Number(srs.interval ?? 0),
      dueAt: srs.dueAt
        ? new Date(srs.dueAt).toISOString()
        : new Date().toISOString(),
      lastReviewed: srs.lastReviewed
        ? new Date(srs.lastReviewed).toISOString()
        : null,
      reviewCount: Number(srs.reviewCount ?? 0),
      easyCount: Number(srs.easyCount ?? 0),
      hardCount: Number(srs.hardCount ?? 0),
    },
  };
}

// pathProgress comes back as a plain object from .lean() and as a Map from a
// hydrated doc — normalise both.
export function normalizePathProgress(raw: unknown): PathProgress {
  const out: PathProgress = {};
  if (!raw) return out;
  const entries: [string, unknown][] =
    raw instanceof Map
      ? Array.from(raw.entries())
      : typeof raw === "object"
        ? Object.entries(raw as Record<string, unknown>)
        : [];
  for (const [key, value] of entries) {
    if (!value || typeof value !== "object") continue;
    const v = value as { completedAt?: unknown; bestPct?: unknown; plays?: unknown };
    out[key] = {
      completedAt: v.completedAt ? new Date(v.completedAt as string).toISOString() : null,
      bestPct: Number(v.bestPct) || 0,
      plays: Number(v.plays) || 0,
    };
  }
  return out;
}

export function toClient(doc: {
  _id: unknown;
  name: string;
  hiddenMessage?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  words: any[];
  readingLevel?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  currentReading?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readingStats?: any;
  pathProgress?: unknown;
  createdAt: Date;
  updatedAt: Date;
}): ClientWordList {
  const stats = doc.readingStats
    ? {
        totalSessions: Number(doc.readingStats.totalSessions) || 0,
        totalQuestions: Number(doc.readingStats.totalQuestions) || 0,
        totalFirstTryCorrect: Number(doc.readingStats.totalFirstTryCorrect) || 0,
        totalHintsUsed: Number(doc.readingStats.totalHintsUsed) || 0,
        byType: normalizeByType(doc.readingStats.byType),
        recentSessions: Array.isArray(doc.readingStats.recentSessions)
          ? doc.readingStats.recentSessions.map(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (s: any): ReadingSessionLog => ({
                completedAt: s.completedAt
                  ? new Date(s.completedAt).toISOString()
                  : new Date().toISOString(),
                level: Number(s.level) || 1,
                scorePct: Number(s.scorePct) || 0,
                questionsCount: Number(s.questionsCount) || 0,
                hintsUsed: Number(s.hintsUsed) || 0,
                perfect: !!s.perfect,
              })
            )
          : [],
      }
    : emptyStats();

  const reading = doc.currentReading
    ? ({
        title: String(doc.currentReading.title ?? ""),
        paragraph: String(doc.currentReading.paragraph ?? ""),
        questions: Array.isArray(doc.currentReading.questions)
          ? doc.currentReading.questions.map(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (q: any): ReadingQuestion => ({
                q: String(q.q ?? ""),
                type: (READING_QUESTION_TYPES as readonly string[]).includes(q.type)
                  ? (q.type as ReadingQuestionType)
                  : "detail",
                acceptable: Array.isArray(q.acceptable) ? q.acceptable.map(String) : [],
                hints: Array.isArray(q.hints) ? q.hints.map(String) : [],
                options: Array.isArray(q.options) ? q.options.map(String) : [],
                answerIndex: Number.isFinite(Number(q.answerIndex))
                  ? Number(q.answerIndex)
                  : -1,
                source: String(q.source ?? ""),
              })
            )
          : [],
        vocabGlosses: Array.isArray(doc.currentReading.vocabGlosses)
          ? doc.currentReading.vocabGlosses.map(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (g: any): VocabGloss => ({
                word: String(g?.word ?? ""),
                arabic: String(g?.arabic ?? ""),
                meaning: String(g?.meaning ?? ""),
              })
            )
          : [],
        level: Number(doc.currentReading.level) || 1,
        passageKind: doc.currentReading.passageKind === "info" ? "info" : "story",
        topic: String(doc.currentReading.topic ?? ""),
        generatedAt: doc.currentReading.generatedAt
          ? new Date(doc.currentReading.generatedAt).toISOString()
          : new Date().toISOString(),
      } satisfies CurrentReading)
    : null;

  return {
    _id: String(doc._id),
    name: doc.name,
    hiddenMessage: doc.hiddenMessage || "",
    words: doc.words.map((w) => toClientWord(w)),
    readingLevel: Math.max(1, Math.min(10, Number(doc.readingLevel) || 1)),
    currentReading: reading,
    readingStats: stats,
    pathProgress: normalizePathProgress(doc.pathProgress),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}
