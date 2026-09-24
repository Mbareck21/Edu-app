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
 * The question set for one passage, asked the way his school's reading tests
 * ask: mostly four-option multiple choice ("According to the passage…",
 * "What does the word … mean in this passage?", "How does … feel…?",
 * "Which sentence from the story shows…?") and one short written answer.
 * These replaced two open "what is the writer telling us" prompts that looked
 * nothing like what he is graded on. Tapping an option also spares a slow
 * speller from typing every answer.
 *
 * `quarter` is the school quarter today. Pass it so a standard his class has
 * started on shows up even when his reading level has not caught up yet.
 * The Read step asks each question after the part it is about (partPlan), so
 * the order here is only the order for the writer.
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
    level >= 5
      ? {
          type: "sequence",
          format: "mcq",
          options: 4,
          brief:
            'An order question in school-test wording: "What happens right after …?" or "What does … do first?". Four options, all events from the passage, one in the right place.',
        }
      : {
          type: "detail",
          format: "mcq",
          options: 4,
          brief:
            'A fact the passage states, in school-test wording: "According to the passage, …?". Four options: the right one and three that use words from the passage but are wrong.',
        },
    {
      type: "vocab",
      format: "mcq",
      options: 4,
      brief:
        `Word meaning in context, in school-test wording: "What does the word "X" mean in this passage?" X is one of the passage's hard words (a glossary or study word). Options: its meaning here in easy words, plus three a careless reader might pick (another meaning of the same word, the opposite, the meaning of a nearby word).`,
    },
    kind === "story"
      ? {
          type: "inference",
          format: "mcq",
          options: 4,
          brief:
            'A character question, in school-test wording: "How does [name] feel when …?", "Which word best describes [name]?" or "Why does [name] …?". The answer is shown by what the character says or does, not written out. Four plausible feelings, traits or reasons.',
        }
      : {
          type: "main_idea",
          format: "mcq",
          options: 4,
          brief:
            '"What is this passage mostly about?" Four options: the main idea, one single detail, one idea too big for the passage, one thing it does not say.',
        },
    {
      type: "cause_effect",
      format: "text",
      brief:
        `A short written answer, like the school's short response: "Why did …?". The reason is in the passage; he types it in a few words.`,
    },
  ];

  if (open("retell", 4)) {
    out.push({
      type: "retell",
      format: "mcq",
      options: 4,
      brief:
        '"Which sentence best tells what the passage is mostly about?" Four options: the right summary, one small detail, one about something else, one that gets the order or the ending wrong.',
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

  if (open("evidence", 5)) {
    out.push({
      type: "evidence",
      format: "mcq",
      options: 4,
      brief:
        kind === "story"
          ? `The school's "Part B": "Which sentence from the story best shows that [name] is [the trait or feeling from the character question]?". The four options must be four sentences copied word for word from the passage.`
          : 'Name a point the writer makes, then ask "Which sentence from the passage best supports this?". The four options must be four sentences copied word for word from the passage.',
    });
  }

  // One, not two: with the school-style set a science passage already asks
  // four or five questions, and more than that tires him out.
  if (science) {
    out.push({
      type: "science_fact",
      format: "mcq",
      options: 3,
      brief:
        '"Which fact does the passage tell?" Three options, one true to the passage. Keep the science simple.',
    });
  }

  return out;
}

// ── Story cast ────────────────────────────────────────────
//
// The generator used to leave the cast to the model, and the system prompt
// happened to name Sam first as an example. Ten cold generations on
// 2026-08-31 produced Sam ten times out of ten, three of them opening with the
// same six words (docs/probes/reading-variety.mjs). A model picks its mode and
// stays there; asking it for variety in prose does not move it.
//
// So the request now carries the cast. The sampler decides who this passage is
// about, where it happens and how it opens, and the prompt states those as
// facts to obey. Variety becomes a property of the code, not of the weather
// inside the model.

/** Names he meets in class, plus names from home. Both belong to him. */
export const STORY_NAMES = [
  "Amina", "Yusuf", "Layla", "Omar", "Nadia", "Karim", "Salma", "Idris",
  "Maya", "Diego", "Ruby", "Theo", "Jonah", "Nia", "Marcus", "Priya",
  "Ella", "Hana", "Leo", "Zainab", "Caleb", "Rosa", "Tariq", "June",
] as const;

/** A grown-up for the story to need. Titles keep them clearly adult. */
export const STORY_ADULTS = [
  "Mr. Diaz", "Ms. Okafor", "Mrs. Hassan", "Mr. Whitaker", "Ms. Bello",
  "Grandma Farah", "Uncle Sami", "Coach Reed", "Mr. Nguyen", "Ms. Alvarez",
] as const;

/** Places a Grade 4 reader in Arkansas can picture without being told. */
export const STORY_SETTINGS = [
  "a school library on a rainy afternoon",
  "the corner of a busy classroom before the bell",
  "a back garden with one stubborn tomato plant",
  "the bus stop at the end of a long street",
  "a kitchen the morning of a family visit",
  "a school car park where a bird has built a nest",
  "the shallow end of a swimming pool",
  "a farmers market stall with too much fruit left",
  "a shed full of tools nobody has sorted",
  "the bottom of a hill with a bicycle at the top",
  "a science lab bench with one broken scale",
  "a bedroom the night before a school trip",
  "the edge of a football pitch at half time",
  "a corner shop with a queue out the door",
] as const;

/**
 * How the first sentence moves. This is the part that broke: without it every
 * story opened by walking a character somewhere. Each move forbids that.
 */
export const OPENING_MOVES = [
  // "a line of dialogue" alone produced play-script format — "Maya: Look at
  // the garden" — in 1 of 10 cold generations. He is learning how narrative
  // prose is written, so the form has to be named.
  "Open with someone speaking: a line of dialogue in quotation marks with a said-tag, like \"Look at the sky,\" Ella said. Never a script line with a name and a colon.",
  "Open in the middle of the trouble, already happening.",
  "Open with a question the main character asks themselves.",
  "Open on a sound, and only then say who heard it.",
  "Open with a thing that is wrong — broken, missing, or late.",
  "Open with what the main character is holding.",
  "Open with the time and the place, then bring the character in.",
  "Open with something the main character has decided not to do.",
] as const;

/** What the story is about underneath. Keeps the plots from converging too. */
export const STORY_PROBLEMS = [
  "someone has to admit a mistake",
  "two people want the same thing",
  "a plan works, but not the way it was meant to",
  "something takes far longer than expected",
  "help arrives from the person least expected to give it",
  "a small kindness is repaid much later",
  "the easy way turns out to cost more",
  "someone keeps trying after failing twice",
] as const;

export type StoryCast = {
  child: string;
  other: string;
  adult: string;
  setting: string;
  opening: string;
  problem: string;
};

/**
 * Pick a cast. Two children so the story can have a relationship in it, and
 * `other` is never the same person as `child`.
 *
 * `avoid` holds the leads of the passages he has read recently. Drawing at
 * random alone still bunched up — one name came back three times in eight cold
 * draws — so the recent leads are removed from the pool rather than merely
 * discouraged. When avoiding everything would leave nothing, the full roster
 * comes back: a repeated name beats no story.
 *
 * `avoidAdults` is separate because the two rosters share no names. Filtering
 * STORY_ADULTS against the child leads was a no-op that read like a guarantee,
 * and Mr. Diaz duly turned up twice in eight passages.
 */
export function castFor(
  rng: () => number = Math.random,
  avoid: readonly string[] = [],
  avoidAdults: readonly string[] = []
): StoryCast {
  // Math.min guards an rng that can return exactly 1; Math.random cannot, but
  // a caller-supplied one might.
  const pick = <T,>(xs: readonly T[]): T =>
    xs[Math.min(xs.length - 1, Math.floor(rng() * xs.length))];
  const taken = new Set(avoid.map((n) => n.toLowerCase()));
  const takenAdults = new Set(avoidAdults.map((n) => n.toLowerCase()));
  const free = STORY_NAMES.filter((n) => !taken.has(n.toLowerCase()));
  const pool: readonly string[] = free.length >= 2 ? free : STORY_NAMES;

  const child = pick(pool);
  const others = pool.filter((n) => n !== child);
  const freeAdults = STORY_ADULTS.filter((a) => !takenAdults.has(a.toLowerCase()));
  return {
    child,
    other: pick(others.length > 0 ? others : STORY_NAMES.filter((n) => n !== child)),
    adult: pick(freeAdults.length > 0 ? freeAdults : STORY_ADULTS),
    setting: pick(STORY_SETTINGS),
    opening: pick(OPENING_MOVES),
    problem: pick(STORY_PROBLEMS),
  };
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

/**
 * An answer to show him, with the passage's names capitalised as the passage
 * has them. The writer returns answers in lower case, so the tidy phrasing he
 * was told to read back said "We would write it: coach reed".
 *
 * A name is a capitalised word that does not start a sentence, plus a
 * capitalised word right before one ("Coach Reed"). A word the passage also
 * uses in lower case ("rose") is left alone.
 */
export function withNames(answer: string, passage: string): string {
  const WORD = /[A-Za-z][A-Za-z'’-]*/g;
  const isCapital = (w: string) => w[0] !== w[0].toLowerCase();
  const names = new Map<string, string>();
  const lower = new Set<string>();
  const words = [...passage.matchAll(WORD)].map((m) => ({ text: m[0], at: m.index ?? 0 }));
  words.forEach(({ text, at }, i) => {
    if (!isCapital(text)) {
      lower.add(text.toLowerCase());
      return;
    }
    const before = passage.slice(0, at).replace(/["“”'‘’(\s]+$/, "");
    if (before === "" || /[.!?:]$/.test(before)) return;
    names.set(text.toLowerCase(), text);
    const prev = words[i - 1];
    const joined = prev && /^\s+$/.test(passage.slice(prev.at + prev.text.length, at));
    if (prev && joined && isCapital(prev.text)) names.set(prev.text.toLowerCase(), prev.text);
  });
  return answer.replace(WORD, (w) => {
    const name = names.get(w.toLowerCase());
    return name && !lower.has(w.toLowerCase()) ? name : w;
  });
}

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

/** A full stop after one of these ends a title, not a sentence. */
const ABBREVIATION_END = /(?:^|\s)(?:mr|mrs|ms|dr|st|jr|sr|prof|vs|etc|approx)\.$/i;

export function splitSentences(text: string): string[] {
  const parts = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  // "Mr. Lopez waved." must not reach echo mode as "Mr." and "Lopez waved." —
  // he would be asked to read one abbreviation out loud and marked wrong for it.
  const out: string[] = [];
  for (const part of parts) {
    const prev = out[out.length - 1];
    if (prev !== undefined && ABBREVIATION_END.test(prev)) out[out.length - 1] = `${prev} ${part}`;
    else out.push(part);
  }
  return out;
}

/**
 * The most paragraphs a passage may arrive in. Not a readability rule — the
 * level's own paragraph target is prompt guidance, and MORE breaks suit a
 * struggling reader, not fewer. This is only a runaway guard, kept at the
 * number the response schema used to reject at so nothing that worked before
 * is reshaped now.
 */
export const MAX_PASSAGE_PARAGRAPHS = 6;

/**
 * Squash a passage down to at most `max` paragraphs by folding the extras into
 * the last one.
 *
 * The writer sometimes breaks a passage into more, shorter paragraphs than the
 * level asked for. That used to fail the whole generation on a schema cap and
 * hand him an error instead of a story he could have read perfectly well
 * (server log, 2026-08-31: "bad paragraphs: Too big"). The words are fine; only
 * the shape is wrong, and the shape is fixable here.
 */
export function foldParagraphs(paragraphs: string[], max: number): string[] {
  const clean = paragraphs.map((p) => p.trim()).filter(Boolean);
  if (max < 1) return clean;
  if (clean.length <= max) return clean;
  const head = clean.slice(0, max - 1);
  return [...head, clean.slice(max - 1).join(" ")];
}

/** Longest sentence in the passage, in words. Used to police the level. */
export function longestSentenceWords(text: string): number {
  return splitSentences(text).reduce((max, s) => Math.max(max, countWords(s)), 0);
}

/** Highest wpm the server will store. Matches the zod max on the session route. */
export const MAX_WPM = 1000;

/**
 * Longest a timed read can run before it is treated as a timer he walked away
 * from rather than a reading.
 *
 * This was a rate floor first (under 20 wpm scored nothing), which was wrong:
 * a rate cannot tell a slow reader from an abandoned clock, and he is exactly
 * the reader who sounds words out. At 380 words — the level 10 target — even
 * 40 wpm finishes inside ten minutes, so fifteen clears any real read while
 * still catching a tab left open.
 */
export const MAX_READ_MS = 15 * 60_000;

/** Words per minute for a timed read. 0 when the timing is unusable. */
export function wordsPerMinute(wordsCount: number, ms: number): number {
  if (wordsCount <= 0 || ms < 2000 || ms > MAX_READ_MS) return 0;
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

// ── Multiple choice sanity ────────────────────────────────────────────────

export type McqCheck = {
  /** De-duplicated options, original order. */
  options: string[];
  /** Index of the answer within `options`, or -1 when this must not be an MCQ. */
  answerIndex: number;
};

/**
 * Keep an AI-written multiple choice only when exactly one option is right.
 *
 * Two ways a model hands over a question with two right answers: the same
 * option twice with different capitalisation, or a distractor that is also in
 * its own "acceptable" list. Either one marks a correct pick wrong. When that
 * happens the question falls back to open text, which is scored against the
 * whole acceptable list and so cannot punish a right answer.
 */
export function checkMcq(
  options: readonly string[],
  answerIndex: number,
  acceptable: readonly string[]
): McqCheck {
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  // Where each distinct option landed, so an answer index that points at a
  // duplicate still finds the copy that was kept.
  const at = new Map<string, number>();
  const kept: string[] = [];
  let answer = -1;
  options.forEach((o, i) => {
    const n = norm(o);
    if (!n) return;
    if (!at.has(n)) {
      at.set(n, kept.length);
      kept.push(o.trim());
    }
    if (i === answerIndex) answer = at.get(n) ?? -1;
  });
  if (answer < 0 || kept.length < 2) return { options: kept, answerIndex: -1 };
  const ok = new Set(acceptable.map(norm));
  const secondRight = kept.some((o, i) => i !== answer && ok.has(norm(o)));
  return { options: kept, answerIndex: secondRight ? -1 : answer };
}

/** Whole passages kept per list for the days the writer cannot be reached. */
export const ARCHIVE_MAX = 8;

export type GlossWord = { word: string; meaning: string; arabic: string };

/**
 * The highlighted words of a passage that are not in Words to fix yet, ready
 * to add. A word already on one of his lists brings that list's meaning and
 * Arabic instead of the gloss's: those are the ones his father checked (the
 * writer glossed "conclusion" as استنتاج; his list says خلاصة). Otherwise: lower case, once each, letters only (the word-list rule), and
 * the meaning with the word itself blanked out, because the meaning becomes
 * the clue for "which word means this?".
 */
export function readingWordsToAdd(
  glosses: readonly GlossWord[],
  known: ReadonlySet<string>,
  onLists: ReadonlyMap<string, { clue: string; arabic: string }> = new Map()
): { word: string; clue: string; arabic: string }[] {
  const out = new Map<string, { word: string; clue: string; arabic: string }>();
  for (const g of glosses) {
    const word = g.word.trim().toLowerCase();
    if (!/^[a-z][a-z\s-]*$/.test(word) || known.has(word) || out.has(word)) continue;
    // Letters, spaces and hyphens only, so the word is safe inside a pattern.
    const clue = g.meaning.replace(new RegExp(`\\b${word}\\w*`, "gi"), "___").trim();
    const listed = onLists.get(word);
    out.set(word, {
      word,
      clue: listed?.clue.trim() || clue,
      arabic: listed?.arabic.trim() || g.arabic.trim(),
    });
  }
  return [...out.values()];
}

/** An archived passage is only served again once it is at least this old. */
export const REUSE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * The oldest archived passage he has not seen for a week, or null. Used when
 * the writer cannot be reached: an old passage beats an error, but one from
 * yesterday would just be yesterday's again.
 */
export function pickArchived<T extends { generatedAt?: Date | string | null }>(
  archive: readonly T[],
  now: number
): T | null {
  const at = (a: T) => (a.generatedAt ? new Date(a.generatedAt).getTime() : 0);
  const ready = archive.filter((a) => at(a) <= now - REUSE_AFTER_MS);
  ready.sort((a, b) => at(a) - at(b));
  return ready[0] ?? null;
}

// ── Reading part by part ──────────────────────────────────────────────────

/** Sentences in one part. Short enough that a slow reader finishes it quickly. */
export const PART_SENTENCES = 3;

/**
 * A passage in parts of about three sentences, never across a paragraph and
 * never a one-sentence straggler when it can be avoided: seven sentences are
 * 3 + 2 + 2, not 3 + 3 + 1. Reading the whole passage before any question was
 * the most tiring shape there is for a slow reader.
 */
export function splitParts(text: string, per = PART_SENTENCES): string[] {
  const parts: string[] = [];
  for (const para of splitParagraphs(text)) {
    const sentences = splitSentences(para);
    const count = Math.max(1, Math.ceil(sentences.length / per));
    const base = Math.floor(sentences.length / count);
    const extra = sentences.length % count;
    let at = 0;
    for (let i = 0; i < count; i++) {
      const size = base + (i < extra ? 1 : 0);
      const chunk = sentences.slice(at, at + size);
      at += size;
      if (chunk.length > 0) parts.push(chunk.join(" "));
    }
  }
  return parts.length > 0 ? parts : [text.trim()];
}

const squash = (t: string) => t.toLowerCase().replace(/\s+/g, " ").trim();

/**
 * When each question is asked: right after the part its answer is in. A
 * question with no findable source ("What is the story mostly about?") waits
 * for the end, and the last question always does, so every part is read.
 * `order` lists question indexes in asking order; `partOf[i]` is the part
 * question i waits for.
 */
export function partPlan(
  parts: readonly string[],
  questions: readonly { source: string }[]
): { order: number[]; partOf: number[] } {
  const last = Math.max(0, parts.length - 1);
  const flat = parts.map(squash);
  const partOf = questions.map((q) => {
    const src = squash(q.source ?? "");
    if (!src) return last;
    const at = flat.findIndex((p) => p.includes(src) || p.includes(src.slice(0, 40)));
    return at >= 0 ? at : last;
  });
  const order = questions.map((_, i) => i).sort((a, b) => partOf[a] - partOf[b] || a - b);
  if (order.length > 0) partOf[order[order.length - 1]] = last;
  return { order, partOf };
}

/** Words taught before the passage. */
export const WORDS_FIRST = 3;

/**
 * The glossed words to meet before reading: the longest ones (the likeliest
 * to stop him), shown in the order the passage uses them.
 */
export function wordsFirst<T extends { word: string }>(
  glosses: readonly T[],
  text: string,
  n = WORDS_FIRST
): T[] {
  const lower = text.toLowerCase();
  const seen = new Set<string>();
  const unique = glosses.filter((g) => {
    const w = g.word.trim().toLowerCase();
    if (!w || seen.has(w)) return false;
    seen.add(w);
    return true;
  });
  const picked = [...unique].sort((a, b) => b.word.length - a.word.length).slice(0, n);
  const pos = (g: T) => {
    const at = lower.indexOf(g.word.toLowerCase());
    return at < 0 ? Number.MAX_SAFE_INTEGER : at;
  };
  return picked.sort((a, b) => pos(a) - pos(b));
}
