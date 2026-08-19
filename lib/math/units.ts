import type { MathUnit } from "./types";

/**
 * Fayetteville Public Schools, Grade 4 Math Year-at-a-Glance 2026-27.
 *
 * Dates given by the district are used as-is (units 1, 3, 4, 6). Units 2 and 5
 * are listed as spanning two quarters with no exact dates, so they take the
 * first half of the quarter they share, leaving the units in school order with
 * no overlap.
 */
export const MATH_UNITS: readonly MathUnit[] = [
  {
    id: 1,
    name: "Place Value: Add & Subtract",
    quarter: "Q1",
    start: "2026-08-11",
    end: "2026-10-08",
    standards: ["4.NPV.1", "4.NPV.2", "4.CAR.2"],
    skills: ["place-value", "add-sub-big"],
  },
  {
    id: 2,
    name: "Place Value: Multiply & Divide",
    quarter: "Q1-Q2",
    start: "2026-10-13",
    end: "2026-11-13",
    standards: ["4.CAR.3", "4.CAR.8"],
    skills: ["mul-facts", "mul-multi", "word-problems"],
  },
  {
    id: 3,
    name: "Multiply & Divide Multi-Digit",
    quarter: "Q2",
    start: "2026-11-16",
    end: "2026-12-18",
    standards: ["4.CAR.3", "4.CAR.4"],
    skills: ["division", "factors-multiples"],
  },
  {
    id: 4,
    name: "Fractions",
    quarter: "Q3",
    start: "2027-01-05",
    end: "2027-02-12",
    standards: ["4.NPV.7", "4.DA.1"],
    skills: ["fractions", "data"],
  },
  {
    id: 5,
    name: "Decimal Fractions",
    quarter: "Q3-Q4",
    start: "2027-02-16",
    end: "2027-03-11",
    standards: [],
    skills: ["decimals"],
  },
  {
    id: 6,
    name: "Angles & Plane Figures",
    quarter: "Q4",
    start: "2027-03-12",
    end: "2027-05-20",
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
