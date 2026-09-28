import { quarterDay } from "@/lib/curriculum";

import type { MathUnit } from "./types";

/**
 * Fayetteville Public Schools, Grade 4 Math Year-at-a-Glance 2026-27.
 *
 * The district gives each unit a number of school days inside each quarter
 * (docs/curriculum-fps-grade4.md, section 2): Q1 is "What is a
 * Mathematician?" 4, Unit 1 28, Unit 2 10; Q2 is Unit 2 18, Unit 3 25; Q3 is
 * Unit 4 35, Unit 5 8; Q4 is Unit 5 8, Unit 6 22, then ATLAS review. The
 * windows below count those days out on the district calendar (quarterDay).
 * They used to run Unit 1 to the end of Q1 and start each shared unit at a
 * quarter, so from 25 September the Home card still said Unit 1, lesson 5,
 * while the class had moved on to multiplying and dividing.
 */
export const MATH_UNITS: readonly MathUnit[] = [
  {
    id: 1,
    name: "Place Value: Add & Subtract",
    quarter: "Q1",
    start: quarterDay("Q1", 5),
    end: quarterDay("Q1", 32),
    standards: ["4.NPV.1", "4.NPV.2", "4.CAR.2"],
    skills: ["place-value", "number-forms", "add-sub-big"],
  },
  {
    id: 2,
    name: "Place Value: Multiply & Divide",
    quarter: "Q1-Q2",
    start: quarterDay("Q1", 33),
    end: quarterDay("Q2", 18),
    standards: ["4.CAR.3", "4.CAR.8"],
    skills: ["mul-facts", "mul-multi", "word-problems"],
  },
  {
    id: 3,
    name: "Multiply & Divide Multi-Digit",
    quarter: "Q2",
    start: quarterDay("Q2", 19),
    end: quarterDay("Q2", 43),
    standards: ["4.CAR.3", "4.CAR.4"],
    skills: ["division", "factors-multiples"],
  },
  {
    id: 4,
    name: "Fractions",
    quarter: "Q3",
    start: quarterDay("Q3", 1),
    end: quarterDay("Q3", 35),
    standards: ["4.NPV.7", "4.DA.1"],
    skills: ["fractions", "data"],
  },
  {
    id: 5,
    name: "Decimal Fractions",
    quarter: "Q3-Q4",
    start: quarterDay("Q3", 36),
    end: quarterDay("Q4", 8),
    standards: [],
    skills: ["decimals"],
  },
  {
    id: 6,
    name: "Angles & Plane Figures",
    quarter: "Q4",
    start: quarterDay("Q4", 9),
    end: quarterDay("Q4", 30),
    standards: ["4.GM.3", "4.GM.5"],
    skills: ["geometry", "angles", "shapes"],
  },
];

/**
 * The unit school is in on `dateISO` ("YYYY-MM-DD"). On a break day it returns
 * the next unit, and after the last day of school the final unit.
 */
export function currentUnit(dateISO: string): MathUnit {
  const day = dateISO.slice(0, 10);
  const inside = MATH_UNITS.find((u) => day >= u.start && day <= u.end);
  if (inside) return inside;
  const upcoming = MATH_UNITS.find((u) => day < u.start);
  return upcoming ?? MATH_UNITS[MATH_UNITS.length - 1];
}

export function unitFor(id: number): MathUnit | undefined {
  return MATH_UNITS.find((u) => u.id === id);
}
