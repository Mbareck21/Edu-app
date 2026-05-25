import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

// ── Reading comprehension types ───────────────────────────────────────────

export const READING_QUESTION_TYPES = [
  "main_idea",
  "detail",
  "vocab",
  "inference",
  "cause_effect",
  "sequence",
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
  },
  { _id: false }
);

const CurrentReadingSchema = new Schema(
  {
    title: { type: String, default: "" },
    paragraph: { type: String, default: "" },
    questions: { type: [ReadingQuestionSchema], default: [] },
    level: { type: Number, default: 1 },
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

const WordSchema = new Schema(
  {
    word: { type: String, required: true, trim: true, lowercase: true },
    clue: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const WordListSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    hiddenMessage: { type: String, trim: true, default: "" },
    words: { type: [WordSchema], default: [] },
    readingLevel: { type: Number, default: 1, min: 1, max: 5 },
    currentReading: { type: CurrentReadingSchema, default: null },
    readingStats: { type: ReadingStatsSchema, default: () => ({}) },
  },
  { timestamps: true }
);

export type WordListDoc = InferSchemaType<typeof WordListSchema> & { _id: unknown };

export const WordList: Model<WordListDoc> =
  (models.WordList as Model<WordListDoc>) ||
  model<WordListDoc>("WordList", WordListSchema);

// ── Client types ──────────────────────────────────────────────────────────

export type ClientWord = { word: string; clue: string };

export type ReadingQuestion = {
  q: string;
  type: ReadingQuestionType;
  acceptable: string[];
  hints: string[];
};

export type CurrentReading = {
  title: string;
  paragraph: string;
  questions: ReadingQuestion[];
  level: number;
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

export type ClientWordList = {
  _id: string;
  name: string;
  hiddenMessage: string;
  words: ClientWord[];
  readingLevel: number;
  currentReading: CurrentReading | null;
  readingStats: ReadingStats;
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

export function toClient(doc: {
  _id: unknown;
  name: string;
  hiddenMessage?: string;
  words: { word: string; clue?: string }[];
  readingLevel?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  currentReading?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readingStats?: any;
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
              })
            )
          : [],
        level: Number(doc.currentReading.level) || 1,
        generatedAt: doc.currentReading.generatedAt
          ? new Date(doc.currentReading.generatedAt).toISOString()
          : new Date().toISOString(),
      } satisfies CurrentReading)
    : null;

  return {
    _id: String(doc._id),
    name: doc.name,
    hiddenMessage: doc.hiddenMessage || "",
    words: doc.words.map((w) => ({ word: w.word, clue: w.clue || "" })),
    readingLevel: Math.max(1, Math.min(5, Number(doc.readingLevel) || 1)),
    currentReading: reading,
    readingStats: stats,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}
