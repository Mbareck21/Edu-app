// The school report card, and what practice does about it.
//
// A grown-up copies a child's quarterly standards-based report card into the
// app (Me > For the grown-ups > School report card): a 1, 2 or 3 for each
// standard each quarter (3 = proficient), the school's reading-speed checks,
// and the teacher's "work on" and "strengths" ticked from a fixed list. The
// card lives only in that child's own database, never in this (public) repo.
//
// focusFor() is the one place that decides what a card changes. It answers in
// each consumer's own words (math skills, extra lesson items, reading
// questions to open), so the quest, the lesson builder and the reading writer
// never learn what a report card is. No card, or nothing below 3, gives
// NO_FOCUS, and every empty value there is exactly the code path that ran
// before report cards existed (lib/__tests__/no-report-baseline.test.ts).
//
// Pure: safe to import from client components.

import { z } from "zod";

import {
  ELA_STANDARDS,
  SCHOOL_YEAR_END,
  SCHOOL_YEAR_START,
  SCIENCE_UNITS,
  type PartKind,
  type Quarter,
} from "@/lib/curriculum";
import type { SchoolItemKind } from "@/lib/items";
import { MATH_SKILLS, MATH_UNITS, type MathSkillId } from "@/lib/math";
import type { GatedQuestion } from "@/lib/reading";

export type QuarterId = Quarter["id"];
export const QUARTERS: readonly QuarterId[] = ["Q1", "Q2", "Q3", "Q4"];
export type Score = 1 | 2 | 3;
/** Met at 3. The only place the line is drawn. */
export const PROFICIENT: Score = 3;

/** "2026-27", from the calendar. Rolling curriculum.ts to a new year retires old cards. */
export const SCHOOL_YEAR_ID = `${SCHOOL_YEAR_START.slice(0, 4)}-${SCHOOL_YEAR_END.slice(2, 4)}`;

// ── What the card grades ──────────────────────────────────────────────────

export type Subject = "Reading" | "Writing" | "Math" | "Science";
export type ReportRow = { code: string; subject: Subject; label: string };

/** Short plain words for each row; the district's own wording is on the card. */
const LABELS: Record<string, string> = {
  "4.FR.6.F": "Reads aloud correctly, smoothly, at a good speed",
  "4.FR.1.PD": "Reads long words by their Latin parts",
  "4.FR.4.PE": "Spells long words with Latin parts",
  "4.V.2": "Works out new words from context clues",
  "4.RC.2.RF": "Answers questions using details from the text",
  "4.RC.9.RL": "Finds the theme of a story",
  "4.RC.3.RF": "Sums up a text with its key details",
  "4.RC.14.RI": "Explains how a writer backs up a point",
  "4.L.14.S": "Writes complex sentences (because, although...)",
  "4.W.4.P": "Writes clearly with details and good conventions",
  "4-LS1-1": "Plant and animal parts help them survive",
  "4-LS1-2": "How animals take in and use information",
  "4-ESS1-1": "Evidence of how the land changed over time",
  "4-ESS2-1": "Weathering and erosion",
  "4-ESS2-2": "Reading maps of Earth's features",
  "4-PS3-1": "Speed and energy",
  "4-PS3-2": "Energy moves and changes form",
  "4-ESS3-1": "Energy and fuels from natural resources",
  "4-PS4-1": "Waves: amplitude and wavelength",
  "4.NPV.1": "A digit is ten times what it is one place to the right",
  "4.NPV.2": "Read and write numbers to 1,000,000 in every form",
  "4.NPV.7": "Break fractions and mixed numbers into unit fractions",
  "4.CAR.2": "Add and subtract numbers up to 1,000,000",
  "4.CAR.3": "Multiply 4-digit by 1-digit and 2-digit by 2-digit",
  "4.CAR.4": "Divide 4-digit numbers by 1-digit, with remainders",
  "4.CAR.8": "Solve multi-step word problems",
  "4.GM.3": "Find unknown angles by adding and subtracting",
  "4.GM.5": "Sort shapes by parallel and perpendicular lines and angles",
  "4.DA.1": "Collect data; frequency tables and scaled bar graphs",
};

const WRITING = new Set(["4.L.14.S", "4.W.4.P"]);

/** A row label: the short words above, else the start of the plain words. */
function label(code: string, plain: string): string {
  if (LABELS[code]) return LABELS[code];
  return plain.length <= 80 ? plain : `${plain.slice(0, 77).trimEnd()}...`;
}

/**
 * The rows of the card, in its own order: reading and writing, math, science.
 * Built from the curriculum the app already files, so a code typed here can
 * only be one the app knows.
 */
export const REPORT_ROWS: readonly ReportRow[] = [
  ...ELA_STANDARDS.map((s) => ({
    code: s.code,
    subject: (WRITING.has(s.code) ? "Writing" : "Reading") as Subject,
    label: label(s.code, s.plain),
  })),
  ...[...new Set(MATH_UNITS.flatMap((u) => u.standards))]
    .sort((a, b) => a.localeCompare(b, "en", { numeric: true }))
    .map((code) => ({ code, subject: "Math" as Subject, label: LABELS[code] ?? code })),
  ...SCIENCE_UNITS.flatMap((u) => u.standards)
    .filter((s) => /^4-/.test(s.code))
    .map((s) => ({ code: s.code, subject: "Science" as Subject, label: label(s.code, s.plain) })),
];

const ROW_CODES = new Set(REPORT_ROWS.map((r) => r.code));

// ── The teacher's words ───────────────────────────────────────────────────

/**
 * What a teacher writes under "grows" and "glows", as a list to tick. Typed
 * words would be guessed at; a tick is exact. A topic's only lever is the
 * math skill it points at, or for word parts, the kind of part.
 */
export const TEACHER_TOPICS = [
  { id: "fluency", subject: "Reading", label: "Reading speed (fluency)" },
  { id: "comprehension", subject: "Reading", label: "Comprehension" },
  { id: "vocabulary", subject: "Reading", label: "Vocabulary" },
  { id: "prefixes", subject: "Reading", label: "Prefixes" },
  { id: "word-parts", subject: "Reading", label: "Roots and suffixes" },
  { id: "spelling", subject: "Reading", label: "Spelling" },
  { id: "ideas", subject: "Writing", label: "Ideas and content" },
  { id: "elaboration", subject: "Writing", label: "Elaboration and paragraphs" },
  { id: "sentences", subject: "Writing", label: "Strong sentences" },
  { id: "rounding", subject: "Math", label: "Rounding big numbers", skill: "rounding" },
  { id: "number-forms", subject: "Math", label: "Expanded, unit and word form", skill: "number-forms" },
  { id: "place-value", subject: "Math", label: "Place value", skill: "place-value" },
  { id: "add-sub", subject: "Math", label: "Adding and subtracting big numbers", skill: "add-sub-big" },
  { id: "mul-facts", subject: "Math", label: "Multiplication facts", skill: "mul-facts" },
  { id: "mul-multi", subject: "Math", label: "Multiplying bigger numbers", skill: "mul-multi" },
  { id: "word-problems", subject: "Math", label: "Multi-step word problems", skill: "word-problems" },
  { id: "division", subject: "Math", label: "Division", skill: "division" },
  { id: "fractions", subject: "Math", label: "Fractions", skill: "fractions" },
  { id: "decimals", subject: "Math", label: "Decimals and money", skill: "decimals" },
  { id: "geometry", subject: "Math", label: "Area and perimeter", skill: "geometry" },
  { id: "angles", subject: "Math", label: "Angles", skill: "angles" },
  { id: "shapes", subject: "Math", label: "Shapes", skill: "shapes" },
  { id: "data", subject: "Math", label: "Graphs and data", skill: "data" },
] as const satisfies readonly { id: string; subject: Subject; label: string; skill?: MathSkillId }[];

export type TopicId = (typeof TEACHER_TOPICS)[number]["id"];
const TOPIC_IDS = TEACHER_TOPICS.map((t) => t.id) as [TopicId, ...TopicId[]];

/**
 * Reading-speed goals on the Grade 4 conference sheet: words read correctly
 * per minute, out loud. School benchmarks, not anyone's score.
 */
export const SCHOOL_ORF_GOALS = [
  { by: "the start of the year", wpm: 87 },
  { by: "the middle of the year", wpm: 121 },
] as const;

// ── The card ──────────────────────────────────────────────────────────────

const scoreCell = z.union([z.literal(1), z.literal(2), z.literal(3), z.null()]);
const DAY = /^\d{4}-\d{2}-\d{2}$/;

const reportSchema = z
  .object({
    year: z.literal(SCHOOL_YEAR_ID),
    standards: z
      .array(
        z.object({
          code: z.string().refine((c) => ROW_CODES.has(c), "not a standard on the card"),
          /** Q1..Q4. null: not graded that quarter (yet). */
          scores: z.tuple([scoreCell, scoreCell, scoreCell, scoreCell]),
        })
      )
      .max(REPORT_ROWS.length),
    reading: z
      .array(z.object({ on: z.string().regex(DAY), wpm: z.number().int().min(1).max(300) }))
      .max(40),
    grows: z.array(z.enum(TOPIC_IDS)).max(TEACHER_TOPICS.length),
    glows: z.array(z.enum(TOPIC_IDS)).max(TEACHER_TOPICS.length),
    note: z.string().max(1000),
  })
  .superRefine((r, ctx) => {
    const codes = r.standards.map((s) => s.code);
    if (new Set(codes).size !== codes.length) ctx.addIssue({ code: "custom", message: "a standard is listed twice" });
    const both = r.grows.filter((t) => r.glows.includes(t));
    if (both.length > 0) ctx.addIssue({ code: "custom", message: `"${both[0]}" is both a strength and a thing to work on` });
  });

export type SchoolReport = z.infer<typeof reportSchema>;
export type ReadingCheck = SchoolReport["reading"][number];

export function emptyReport(): SchoolReport {
  return { year: SCHOOL_YEAR_ID, standards: [], reading: [], grows: [], glows: [], note: "" };
}

/**
 * The one way in, for a save and for a stored card alike. Blank rows are
 * dropped and checks sorted oldest first, so the same card always stores the
 * same way.
 */
export function parseReport(raw: unknown): { ok: true; report: SchoolReport } | { ok: false; error: string } {
  const parsed = reportSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: `${issue?.path.join(".") || "card"}: ${issue?.message ?? "not a report card"}` };
  }
  const r = parsed.data;
  return {
    ok: true,
    report: {
      ...r,
      standards: r.standards.filter((s) => s.scores.some((x) => x !== null)),
      reading: [...r.reading].sort((a, b) => a.on.localeCompare(b.on)),
      note: r.note.trim(),
    },
  };
}

/** Each standard's score from the latest quarter that graded it. */
export function latestScores(report: SchoolReport): Map<string, { score: Score; quarter: QuarterId }> {
  const out = new Map<string, { score: Score; quarter: QuarterId }>();
  for (const s of report.standards) {
    for (let q = QUARTERS.length - 1; q >= 0; q--) {
      const score = s.scores[q];
      if (score !== null) {
        out.set(s.code, { score, quarter: QUARTERS[q] });
        break;
      }
    }
  }
  return out;
}

// ── What it changes ───────────────────────────────────────────────────────

export type FluencyGoal = {
  /** Words a minute to aim for next. */
  goal: number;
  by: string;
  /** The latest school check, if any. */
  last: ReadingCheck | null;
};

/**
 * One field per consumer, in that consumer's own words. Each empty value is
 * the app as it was before report cards.
 */
export type SchoolFocus = {
  /** planBeats: skills the Math beat turns to every other day. */
  readonly mathCatchUp: readonly MathSkillId[];
  /** Quest New words: extra school items on top of the lesson. */
  readonly newWordsExtras: readonly SchoolItemKind[];
  /** Quest Write and use: extra school items on top of the round. */
  readonly productionExtras: readonly SchoolItemKind[];
  /** Word-part items draw only these kinds of part. Empty: any. */
  readonly partKinds: readonly PartKind[];
  /** questionPlan: gated questions to ask whatever the quarter and level. */
  readonly readingOpens: readonly GatedQuestion[];
  /** Display only: Me page and the grown-ups page. */
  readonly fluencyGoal: FluencyGoal | null;
  /** One plain line per change, for the grown-ups page. */
  readonly reasons: readonly string[];
};

export const NO_FOCUS: SchoolFocus = Object.freeze({
  mathCatchUp: Object.freeze([]) as readonly MathSkillId[],
  newWordsExtras: Object.freeze([]) as readonly SchoolItemKind[],
  productionExtras: Object.freeze([]) as readonly SchoolItemKind[],
  partKinds: Object.freeze([]) as readonly PartKind[],
  readingOpens: Object.freeze([]) as readonly GatedQuestion[],
  fluencyGoal: null,
  reasons: Object.freeze([]) as readonly string[],
});

/** Catch-up skills at most: more than three and each one comes round too rarely to stick. */
export const MAX_CATCH_UP = 3;

const SKILL_OF_TOPIC = new Map<string, MathSkillId>(
  TEACHER_TOPICS.flatMap((t) => ("skill" in t ? [[t.id, t.skill] as [string, MathSkillId]] : []))
);

function skillName(id: MathSkillId): string {
  return MATH_SKILLS.find((s) => s.id === id)?.name ?? id;
}

/** The next goal above the latest check; the last goal once he is past them all. */
export function fluencyGoalFor(reading: readonly ReadingCheck[]): FluencyGoal | null {
  if (reading.length === 0) return null;
  const last = reading[reading.length - 1];
  const next = SCHOOL_ORF_GOALS.find((g) => g.wpm > last.wpm) ?? SCHOOL_ORF_GOALS[SCHOOL_ORF_GOALS.length - 1];
  return { goal: next.wpm, by: next.by, last };
}

/**
 * What a card changes on `today` (YYYY-MM-DD). Rules, one per standard:
 *  - math: skills whose standards scored under 3, plus skills the teacher
 *    names to work on, minus skills she names only as strengths (her words
 *    beat a score). Her picks first, then the school order; at most three.
 *  - 4.FR.1.PD under 3 (reading long words by their Latin parts):
 *    two word-part meaning items in New words.
 *  - 4.FR.4.PE under 3 (spelling with Latin parts): a word-part building
 *    item in Write and use.
 *  - 4.L.14.S under 3 (complex sentences): an extra sentence-joining item in
 *    Write and use.
 *  - 4.RC.2.RF under 3 (answering with details from the text): the
 *    "which sentence shows..." evidence question, from now, not from Q3.
 *  - prefixes ticked as a strength: word-part items use roots and suffixes.
 * NO_FOCUS for no card, another year's card, or a day after the school year.
 */
export function focusFor(report: SchoolReport | null, today: string): SchoolFocus {
  if (!report || report.year !== SCHOOL_YEAR_ID || today.slice(0, 10) > SCHOOL_YEAR_END) return NO_FOCUS;
  const latest = latestScores(report);
  const low = (code: string) => {
    const s = latest.get(code);
    return s !== undefined && s.score < PROFICIENT;
  };
  const reasons: string[] = [];

  const named = report.grows.flatMap((t) => SKILL_OF_TOPIC.get(t) ?? []);
  const strengths = new Set(report.glows.flatMap((t) => SKILL_OF_TOPIC.get(t) ?? []));
  const fromScores = MATH_SKILLS.filter((s) => s.standards.some(low)).map((s) => s.id);
  const mathCatchUp = [...new Set([...named, ...fromScores.filter((id) => !strengths.has(id))])].slice(
    0,
    MAX_CATCH_UP
  );
  if (mathCatchUp.length > 0) {
    reasons.push(`Math: every other day, Today's Math is ${mathCatchUp.map(skillName).join(", ")} instead of the class lesson.`);
  }

  const newWordsExtras: SchoolItemKind[] = [];
  const productionExtras: SchoolItemKind[] = [];
  if (low("4.FR.1.PD")) {
    newWordsExtras.push("word-part-meaning", "word-part-meaning");
    reasons.push("Reading long words (4.FR.1.PD): New words adds two word-part questions.");
  }
  if (low("4.FR.4.PE")) {
    productionExtras.push("word-part-build");
    reasons.push("Spelling with word parts (4.FR.4.PE): Write and use adds a build-the-word question.");
  }
  if (low("4.L.14.S")) {
    productionExtras.push("sentence-combine");
    reasons.push("Complex sentences (4.L.14.S): Write and use adds a second sentence-joining question.");
  }
  const partKinds: PartKind[] = report.glows.includes("prefixes") ? ["base", "suffix"] : [];
  if (partKinds.length > 0 && newWordsExtras.length + productionExtras.length > 0) {
    reasons.push("Prefixes are a strength, so word-part questions use roots and suffixes.");
  }

  const readingOpens: GatedQuestion[] = low("4.RC.2.RF") ? ["evidence"] : [];
  if (readingOpens.length > 0) {
    reasons.push('Answering with details (4.RC.2.RF): every reading asks "which sentence shows...".');
  }

  const fluencyGoal = fluencyGoalFor(report.reading);
  if (fluencyGoal?.last) {
    reasons.push(
      `Reading speed: ${fluencyGoal.last.wpm} words a minute at school; next goal ${fluencyGoal.goal}. Shown on Me.`
    );
  }

  if (reasons.length === 0) return NO_FOCUS;
  return {
    mathCatchUp,
    newWordsExtras,
    productionExtras,
    partKinds: newWordsExtras.length + productionExtras.length > 0 ? partKinds : [],
    readingOpens,
    fluencyGoal,
    reasons,
  };
}
