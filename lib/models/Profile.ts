import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

import {
  DEFAULT_DAILY_GOAL,
  MAX_DAILY_GOAL,
  MIN_DAILY_GOAL,
  levelFor,
} from "@/lib/rewards";
import type {
  ActivityEntry,
  ClientProfile,
  ProfileState,
  ReadingLog,
  SessionKind,
} from "@/lib/types";

// Singleton document: one profile for the one kid using the app.
// Always read/written through `{ key: "default" }`.

const StreakSchema = new Schema(
  {
    current: { type: Number, default: 0 },
    best: { type: Number, default: 0 },
    lastActiveDay: { type: String, default: "" }, // YYYY-MM-DD, kid's timezone
  },
  { _id: false }
);

const TodaySchema = new Schema(
  {
    day: { type: String, default: "" },
    lessons: { type: Number, default: 0 },
  },
  { _id: false }
);

const EarnedBadgeSchema = new Schema(
  {
    id: { type: String, required: true },
    earnedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const StatsSchema = new Schema(
  {
    lessons: { type: Number, default: 0 },
    correct: { type: Number, default: 0 },
    answered: { type: Number, default: 0 },
    fastAnswers: { type: Number, default: 0 },
    mathSessions: { type: Number, default: 0 },
    perfectSessions: { type: Number, default: 0 },
  },
  { _id: false }
);

const ActivitySchema = new Schema(
  {
    at: { type: Date, default: Date.now },
    kind: { type: String, enum: ["vocab", "math", "reading"], default: "vocab" },
    ref: { type: String, default: "" },
    pct: { type: Number, default: 0 },
    xp: { type: Number, default: 0 },
    ms: { type: Number, default: 0 },
  },
  { _id: false }
);

// Reading ladder: one level for the whole app, moved by recent scores.
const ReadingLogSchema = new Schema(
  {
    at: { type: Date, default: Date.now },
    level: { type: Number, default: 1 },
    pct: { type: Number, default: 0 },
    wordsCount: { type: Number, default: 0 },
    wpm: { type: Number, default: undefined },
  },
  { _id: false }
);

const ReadingSchema = new Schema(
  {
    level: { type: Number, default: 1, min: 1, max: 10 },
    recent: { type: [ReadingLogSchema], default: [] }, // newest first, cap 20
  },
  { _id: false }
);

const ProfileSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, default: "default" },
    name: { type: String, trim: true, default: "Nour" },
    xp: { type: Number, default: 0 },
    streak: { type: StreakSchema, default: () => ({}) },
    dailyGoal: {
      type: Number,
      default: DEFAULT_DAILY_GOAL,
      min: MIN_DAILY_GOAL,
      max: MAX_DAILY_GOAL,
    },
    today: { type: TodaySchema, default: () => ({}) },
    badges: { type: [EarnedBadgeSchema], default: [] },
    stats: { type: StatsSchema, default: () => ({}) },
    activity: { type: [ActivitySchema], default: [] },
    reading: { type: ReadingSchema, default: () => ({}) },
    // Ids of sessions already applied, newest first, capped at RECENT_SESSION_IDS.
    // Server-only: never part of ClientProfile.
    recentSessionIds: { type: [String], default: [] },
  },
  { timestamps: true }
);

/** How many applied session ids we remember for de-duplication. */
export const RECENT_SESSION_IDS = 100;

export type ProfileDoc = InferSchemaType<typeof ProfileSchema> & { _id: unknown };

export const Profile: Model<ProfileDoc> =
  (models.Profile as Model<ProfileDoc>) ||
  model<ProfileDoc>("Profile", ProfileSchema);

export const PROFILE_KEY = "default";

// ── Normalising ───────────────────────────────────────────────────────────

const KINDS: readonly SessionKind[] = ["vocab", "math", "reading"];

function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function iso(v: unknown): string {
  if (!v) return new Date().toISOString();
  const d = new Date(v as string | number | Date);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function record(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

/** Raw (lean or hydrated) profile doc → the pure state rewards.ts works on. */
export function toProfileState(doc: unknown): ProfileState {
  const d = record(doc);
  const streak = record(d.streak);
  const today = record(d.today);
  const stats = record(d.stats);
  const reading = record(d.reading);
  return {
    name: String(d.name ?? "Nour") || "Nour",
    xp: num(d.xp),
    streak: {
      current: num(streak.current),
      best: num(streak.best),
      lastActiveDay: String(streak.lastActiveDay ?? ""),
    },
    dailyGoal: Math.min(
      MAX_DAILY_GOAL,
      Math.max(MIN_DAILY_GOAL, num(d.dailyGoal, DEFAULT_DAILY_GOAL) || DEFAULT_DAILY_GOAL)
    ),
    today: { day: String(today.day ?? ""), lessons: num(today.lessons) },
    badges: Array.isArray(d.badges)
      ? d.badges.map((b) => {
          const r = record(b);
          return { id: String(r.id ?? ""), earnedAt: iso(r.earnedAt) };
        })
      : [],
    stats: {
      lessons: num(stats.lessons),
      correct: num(stats.correct),
      answered: num(stats.answered),
      fastAnswers: num(stats.fastAnswers),
      mathSessions: num(stats.mathSessions),
      perfectSessions: num(stats.perfectSessions),
    },
    activity: Array.isArray(d.activity)
      ? d.activity.map((a): ActivityEntry => {
          const r = record(a);
          const kind = String(r.kind ?? "vocab");
          return {
            at: iso(r.at),
            kind: KINDS.includes(kind as SessionKind) ? (kind as SessionKind) : "vocab",
            ref: String(r.ref ?? ""),
            pct: num(r.pct),
            xp: num(r.xp),
            ms: num(r.ms),
          };
        })
      : [],
    reading: {
      level: Math.min(10, Math.max(1, num(reading.level, 1) || 1)),
      recent: Array.isArray(reading.recent)
        ? reading.recent.map((entry): ReadingLog => {
            const r = record(entry);
            return {
              at: iso(r.at),
              level: num(r.level, 1) || 1,
              pct: num(r.pct),
              wordsCount: num(r.wordsCount),
              ...(r.wpm === undefined || r.wpm === null ? {} : { wpm: num(r.wpm) }),
            };
          })
        : [],
    },
  };
}

/** Profile state → what the UI gets, with the level fields filled in. */
export function toClientProfile(state: ProfileState): ClientProfile {
  const { level, into, needed } = levelFor(state.xp);
  return { ...state, level, into, needed };
}
