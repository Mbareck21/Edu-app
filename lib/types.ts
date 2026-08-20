// Shared, framework-free types for the Quest rebuild.
// Pure data only — no React, no Mongoose. Safe to import anywhere.

import type { IconName } from "@/components/ui/Icon";

// ── Unit path steps ───────────────────────────────────────────────────────

export const STEP_IDS = [
  "flashcards",
  "match",
  "listen",
  "spell",
  "use",
  "read",
  "challenge",
] as const;

export type StepId = (typeof STEP_IDS)[number];

export type Step = {
  id: StepId;
  name: string;
  blurb: string;
  icon: IconName;
  /** Scored steps need STEP_PASS_PCT to complete; unscored ones complete on play. */
  scored: boolean;
  /** Runner accent color and the completion-screen title. */
  accent: "green" | "blue" | "purple" | "gold";
  doneTitle: string;
  /** Challenge extras: visible timer and the unit treasure chest. */
  timed: boolean;
  chest: boolean;
};

/** Ordered path. Step N unlocks when step N-1 has a `completedAt`. */
const step = (
  id: StepId,
  name: string,
  blurb: string,
  icon: IconName,
  extra?: Partial<Pick<Step, "scored" | "accent" | "doneTitle" | "timed" | "chest">>
): Step => ({
  id,
  name,
  blurb,
  icon,
  scored: true,
  accent: "green",
  doneTitle: `${name} done!`,
  timed: false,
  chest: false,
  ...extra,
});

export const STEPS: readonly Step[] = [
  step("flashcards", "Learn", "See the words.", "book", { scored: false, accent: "blue", doneTitle: "Words learned!" }),
  step("match", "Match", "Pick the right word.", "check", { doneTitle: "Match done!" }),
  step("listen", "Listen", "Hear it, then pick.", "volume", { doneTitle: "Good ears!" }),
  step("spell", "Spell", "Build the word.", "words", { doneTitle: "Spelled it!" }),
  step("use", "Use It", "Put it in a sentence.", "sparkles", { doneTitle: "You used them!" }),
  step("read", "Read", "Read and answer.", "chat", { scored: false, accent: "purple", doneTitle: "Reading done!" }),
  step("challenge", "Challenge", "Go fast. Win the chest.", "bolt", { accent: "gold", doneTitle: "Challenge done!", timed: true, chest: true }),
] as const;

export function stepById(id: StepId): Step {
  const found = STEPS.find((s) => s.id === id);
  if (!found) throw new Error(`unknown step: ${id}`);
  return found;
}

export function isStepId(v: string): v is StepId {
  return (STEP_IDS as readonly string[]).includes(v);
}

// ── Session result (client → POST /api/sessions/complete) ─────────────────

export type SessionKind = "vocab" | "math" | "reading";

export type SessionResult = {
  /** Client-minted id. Lets the server ignore a retry of a session it already applied. */
  sessionId?: string;
  kind: SessionKind;
  /** listId:step, or the math skill id. Used for the activity log. */
  ref: string;
  answered: number;
  correct: number;
  /** Answers given in under 3s. */
  fastCount: number;
  /** Time on task, ms. */
  ms: number;
  perfect: boolean;
  /** When both present the server also writes WordList.pathProgress[step]. */
  listId?: string;
  step?: StepId;
  /** When present the server also updates MathProgress for this skill. */
  mathSkill?: string;
  /** Per-word, per-skill answers. Applied to the list's words when listId is set. */
  wordResults?: WordResult[];
  /** A finished reading — moves the profile's reading level. */
  reading?: ReadingResult;
};

// ── Profile (pure state the rewards engine works on) ──────────────────────

export type Streak = { current: number; best: number; lastActiveDay: string };

export type ProfileStats = {
  lessons: number;
  correct: number;
  answered: number;
  fastAnswers: number;
  mathSessions: number;
  perfectSessions: number;
};

export type EarnedBadge = { id: string; earnedAt: string };

export type ActivityEntry = {
  at: string;
  kind: SessionKind;
  ref: string;
  pct: number;
  xp: number;
  ms: number;
};

export type ReadingLog = {
  at: string;
  level: number;
  pct: number;
  wordsCount: number;
  /** Words per minute, when the runner timed the read. */
  wpm?: number;
};

/** One reading ladder for the whole app, 1..10. */
export type ReadingState = { level: number; recent: ReadingLog[] };

/** Plain, serialisable profile. What rewards.ts reads and returns. */
export type ProfileState = {
  name: string;
  xp: number;
  streak: Streak;
  dailyGoal: number;
  today: { day: string; lessons: number };
  badges: EarnedBadge[];
  stats: ProfileStats;
  activity: ActivityEntry[];
  reading: ReadingState;
};

/** One finished reading, posted with the session result. */
export type ReadingResult = {
  level: number;
  pct: number;
  wordsCount: number;
  wpm?: number;
};

/** One answer for one word + skill, posted with the session result. */
export type WordResult = {
  word: string;
  skill: "recognize" | "listen" | "spell" | "use";
  correct: boolean;
  /** The list this word belongs to; defaults to the session's listId. */
  listId?: string;
};

/** A skill sub-document as it comes back from Mongo, before normalising. */
export type SkillStateLike = {
  correct?: number;
  wrong?: number;
  streak?: number;
  lastAt?: Date | string | null;
  dueAt?: Date | string | null;
};

/** ProfileState + derived level info. What the API and pages hand to the UI. */
export type ClientProfile = ProfileState & {
  level: number;
  into: number;
  needed: number;
};
