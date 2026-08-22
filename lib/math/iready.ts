// The lesson-by-lesson sequence of the math program Nour's class actually
// runs: i-Ready Classroom Mathematics, Grade 4 (2024 edition, Curriculum
// Associates). 5 units, 34 lessons, in order.
//
// Only the *sequence* lives here — lesson numbers, titles and the standards
// each one covers. That is the publisher's table of contents, not their
// teaching material: none of their text, artwork or problems are reproduced.
// The app keeps generating its own questions; this file just tells it which
// lesson school is on so the questions match.
//
// Source: the published Grade 4 alignment for i-Ready Classroom Mathematics
// (2024), cross-checked against the CCSS scope and sequence.
//
// The FPS Year-at-a-Glance groups the same content into six units (see
// lib/math/units.ts). `fpsUnit` is that mapping, and it is what drives pacing:
// lessons are spread evenly across their FPS unit's dates, because the
// district calendar is the one we actually have dates for.

import { MATH_UNITS, unitFor } from "./units";
import type { MathSkillId } from "./types";

export type IreadyLesson = {
  /** 1..34, the number printed in his book. */
  lesson: number;
  title: string;
  /** i-Ready's own unit, 1..5. */
  ireadyUnit: number;
  /** The FPS unit this falls in, 1..6 — the one with real dates. */
  fpsUnit: number;
  /** Common Core codes the lesson covers. */
  standards: readonly string[];
  /** App skills that drill this lesson. Empty when nothing covers it yet. */
  skills: readonly MathSkillId[];
};

export const IREADY_UNITS: readonly { id: number; name: string }[] = [
  { id: 1, name: "Whole Numbers: Place Value, Comparison, Addition, and Subtraction" },
  { id: 2, name: "Operations: Multiplication, Division, and Algebraic Thinking" },
  {
    id: 3,
    name: "Multi-Digit Operations and Measurement: Multiplication, Division, Perimeter, and Area",
  },
  {
    id: 4,
    name: "Fractions, Decimals, and Measurement: Addition, Subtraction, and Multiplication",
  },
  { id: 5, name: "Geometry and Measurement: Figures, Classification, and Symmetry" },
];

export const IREADY_LESSONS: readonly IreadyLesson[] = [
  // Unit 1 — FPS Unit 1 "Place Value: Add & Subtract"
  { lesson: 1, title: "Understand Place Value", ireadyUnit: 1, fpsUnit: 1, standards: ["4.NBT.A.1", "4.NBT.A.2"], skills: ["place-value"] },
  { lesson: 2, title: "Compare Whole Numbers", ireadyUnit: 1, fpsUnit: 1, standards: ["4.NBT.A.2"], skills: ["place-value"] },
  { lesson: 3, title: "Round Whole Numbers", ireadyUnit: 1, fpsUnit: 1, standards: ["4.NBT.A.3"], skills: ["place-value"] },
  { lesson: 4, title: "Add Whole Numbers", ireadyUnit: 1, fpsUnit: 1, standards: ["4.NBT.B.4"], skills: ["add-sub-big"] },
  { lesson: 5, title: "Subtract Whole Numbers", ireadyUnit: 1, fpsUnit: 1, standards: ["4.NBT.B.4"], skills: ["add-sub-big"] },

  // Unit 2 — FPS Unit 2 "Place Value: Multiply & Divide"
  { lesson: 6, title: "Understand Multiplication as a Comparison", ireadyUnit: 2, fpsUnit: 2, standards: ["4.OA.A.1"], skills: ["mul-facts"] },
  { lesson: 7, title: "Multiplication and Division in Word Problems", ireadyUnit: 2, fpsUnit: 2, standards: ["4.OA.A.2"], skills: ["word-problems"] },
  { lesson: 8, title: "Multiples and Factors", ireadyUnit: 2, fpsUnit: 2, standards: ["4.OA.B.4"], skills: ["factors-multiples"] },
  { lesson: 9, title: "Number and Shape Patterns", ireadyUnit: 2, fpsUnit: 2, standards: ["4.OA.C.5"], skills: ["factors-multiples"] },
  { lesson: 10, title: "Model and Solve Multi-Step Problems", ireadyUnit: 2, fpsUnit: 2, standards: ["4.OA.A.3"], skills: ["word-problems"] },

  // Unit 3 — FPS Unit 3 "Multiply & Divide Multi-Digit"
  { lesson: 11, title: "Multiply by One-Digit Numbers", ireadyUnit: 3, fpsUnit: 3, standards: ["4.NBT.B.5"], skills: ["mul-multi"] },
  { lesson: 12, title: "Multiply by Two-Digit Numbers", ireadyUnit: 3, fpsUnit: 3, standards: ["4.NBT.B.5"], skills: ["mul-multi"] },
  { lesson: 13, title: "Use Multiplication to Convert Measurements", ireadyUnit: 3, fpsUnit: 3, standards: ["4.MD.A.1", "4.MD.A.2"], skills: ["word-problems"] },
  { lesson: 14, title: "Divide Three-Digit Numbers", ireadyUnit: 3, fpsUnit: 3, standards: ["4.NBT.B.6"], skills: ["division"] },
  { lesson: 15, title: "Divide Four-Digit Numbers", ireadyUnit: 3, fpsUnit: 3, standards: ["4.NBT.B.6"], skills: ["division"] },
  { lesson: 16, title: "Find Perimeter and Area", ireadyUnit: 3, fpsUnit: 3, standards: ["4.MD.A.3"], skills: ["geometry"] },

  // Unit 4, first half — FPS Unit 4 "Fractions"
  { lesson: 17, title: "Understand Equivalent Fractions", ireadyUnit: 4, fpsUnit: 4, standards: ["4.NF.A.1"], skills: ["fractions"] },
  { lesson: 18, title: "Compare Fractions", ireadyUnit: 4, fpsUnit: 4, standards: ["4.NF.A.2"], skills: ["fractions"] },
  { lesson: 19, title: "Understand Fraction Addition and Subtraction", ireadyUnit: 4, fpsUnit: 4, standards: ["4.NF.B.3.A"], skills: ["fractions"] },
  { lesson: 20, title: "Add and Subtract Fractions", ireadyUnit: 4, fpsUnit: 4, standards: ["4.NF.B.3.B", "4.NF.B.3.D"], skills: ["fractions"] },
  { lesson: 21, title: "Add and Subtract Mixed Numbers", ireadyUnit: 4, fpsUnit: 4, standards: ["4.NF.B.3.C"], skills: ["fractions"] },
  { lesson: 22, title: "Add and Subtract Fractions in Line Plots", ireadyUnit: 4, fpsUnit: 4, standards: ["4.MD.B.4"], skills: ["data"] },
  { lesson: 23, title: "Understand Fraction Multiplication", ireadyUnit: 4, fpsUnit: 4, standards: ["4.NF.B.4.A"], skills: ["fractions"] },
  { lesson: 24, title: "Multiply Fractions by Whole Numbers", ireadyUnit: 4, fpsUnit: 4, standards: ["4.NF.B.4.B", "4.NF.B.4.C"], skills: ["fractions"] },

  // Unit 4, second half — FPS Unit 5 "Decimal Fractions"
  { lesson: 25, title: "Fractions as Tenths and Hundredths", ireadyUnit: 4, fpsUnit: 5, standards: ["4.NF.C.5"], skills: ["decimals"] },
  { lesson: 26, title: "Relate Decimals and Fractions", ireadyUnit: 4, fpsUnit: 5, standards: ["4.NF.C.6"], skills: ["decimals"] },
  { lesson: 27, title: "Compare Decimals", ireadyUnit: 4, fpsUnit: 5, standards: ["4.NF.C.7"], skills: ["decimals"] },
  { lesson: 28, title: "Problems About Time and Money", ireadyUnit: 4, fpsUnit: 5, standards: ["4.MD.A.2"], skills: ["decimals", "word-problems"] },
  { lesson: 29, title: "Problems About Length, Liquid Volume, Mass, and Weight", ireadyUnit: 4, fpsUnit: 5, standards: ["4.MD.A.1", "4.MD.A.2"], skills: ["word-problems"] },

  // Unit 5 — FPS Unit 6 "Angles & Plane Figures"
  { lesson: 30, title: "Points, Lines, Rays, and Angles", ireadyUnit: 5, fpsUnit: 6, standards: ["4.G.A.1"], skills: ["geometry", "shapes"] },
  { lesson: 31, title: "Angles", ireadyUnit: 5, fpsUnit: 6, standards: ["4.MD.C.5", "4.MD.C.6"], skills: ["angles"] },
  { lesson: 32, title: "Add and Subtract with Angles", ireadyUnit: 5, fpsUnit: 6, standards: ["4.MD.C.7"], skills: ["angles"] },
  { lesson: 33, title: "Classify Two-Dimensional Figures", ireadyUnit: 5, fpsUnit: 6, standards: ["4.G.A.2"], skills: ["shapes"] },
  { lesson: 34, title: "Symmetry", ireadyUnit: 5, fpsUnit: 6, standards: ["4.G.A.3"], skills: ["shapes"] },
];

export function lessonsForFpsUnit(unitId: number): readonly IreadyLesson[] {
  return IREADY_LESSONS.filter((l) => l.fpsUnit === unitId);
}

export function lessonByNumber(n: number): IreadyLesson | undefined {
  return IREADY_LESSONS.find((l) => l.lesson === n);
}

function daysBetween(fromISO: string, toISO: string): number {
  const a = Date.parse(`${fromISO.slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${toISO.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

/**
 * The lesson school is most likely on for `dateISO`.
 *
 * The district publishes unit dates, not lesson dates, so the lessons in a
 * unit are spread evenly across that unit's window. Before the year starts
 * this is lesson 1; after it ends, lesson 34. Being a lesson out either way is
 * expected and harmless — it only picks which skill gets drilled.
 */
export function currentLesson(dateISO: string): IreadyLesson {
  const day = dateISO.slice(0, 10);
  const unit =
    MATH_UNITS.find((u) => day >= u.start && day <= u.end) ??
    MATH_UNITS.find((u) => day < u.start);
  if (!unit) return IREADY_LESSONS[IREADY_LESSONS.length - 1];

  const lessons = lessonsForFpsUnit(unit.id);
  if (lessons.length === 0) return IREADY_LESSONS[0];
  if (day < unit.start) return lessons[0];

  const span = Math.max(1, daysBetween(unit.start, unit.end) + 1);
  const elapsed = Math.max(0, daysBetween(unit.start, day));
  const slot = Math.floor((elapsed / span) * lessons.length);
  return lessons[Math.min(lessons.length - 1, slot)];
}

/** "Unit 1 · Lesson 4: Add Whole Numbers" — the line shown to a parent. */
export function lessonLabel(l: IreadyLesson): string {
  const unit = unitFor(l.fpsUnit);
  return unit
    ? `${unit.name} · Lesson ${l.lesson}: ${l.title}`
    : `Lesson ${l.lesson}: ${l.title}`;
}
