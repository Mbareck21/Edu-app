import { FPS_QUARTERS } from "@/lib/curriculum";

import type { MathUnit } from "./types";

/**
 * Fayetteville Public Schools, Grade 4 Math Year-at-a-Glance 2026-27.
 *
 * The quarter windows are the district calendar's, read from FPS_QUARTERS in
 * lib/curriculum.ts — the one place they are written down. Units 1, 3, 4 and 6
 * end on a quarter boundary; units 2 and 5 are listed as spanning two quarters
 * with no exact dates, so they take the front of the quarter they share and
 * the mid-quarter hand-over below decides where that front ends.
 */
const Q = Object.fromEntries(FPS_QUARTERS.map((q) => [q.id, q])) as Record<
  (typeof FPS_QUARTERS)[number]["id"],
  (typeof FPS_QUARTERS)[number]
>;

/**
 * The two mid-quarter hand-overs. Not on the district calendar — the last
 * school day of the outgoing unit and the first of the next one, picked so
 * the units stay in school order with no overlap. Literals on purpose.
 */
const Q2_HANDOVER = { last: "2026-11-13", next: "2026-11-16" } as const;
const Q3_HANDOVER = { last: "2027-02-12", next: "2027-02-16" } as const;

export const MATH_UNITS: readonly MathUnit[] = [
  {
    id: 1,
    name: "Place Value: Add & Subtract",
    quarter: "Q1",
    start: Q.Q1.start,
    end: Q.Q1.end,
    standards: ["4.NPV.1", "4.NPV.2", "4.CAR.2"],
    skills: ["place-value", "add-sub-big"],
  },
  {
    id: 2,
    name: "Place Value: Multiply & Divide",
    quarter: "Q1-Q2",
    start: Q.Q2.start,
    end: Q2_HANDOVER.last,
    standards: ["4.CAR.3", "4.CAR.8"],
    skills: ["mul-facts", "mul-multi", "word-problems"],
  },
  {
    id: 3,
    name: "Multiply & Divide Multi-Digit",
    quarter: "Q2",
    start: Q2_HANDOVER.next,
    end: Q.Q2.end,
    standards: ["4.CAR.3", "4.CAR.4"],
    skills: ["division", "factors-multiples"],
  },
  {
    id: 4,
    name: "Fractions",
    quarter: "Q3",
    start: Q.Q3.start,
    end: Q3_HANDOVER.last,
    standards: ["4.NPV.7", "4.DA.1"],
    skills: ["fractions", "data"],
  },
  {
    id: 5,
    name: "Decimal Fractions",
    quarter: "Q3-Q4",
    start: Q3_HANDOVER.next,
    end: Q.Q3.end,
    standards: [],
    skills: ["decimals"],
  },
  {
    id: 6,
    name: "Angles & Plane Figures",
    quarter: "Q4",
    start: Q.Q4.start,
    end: Q.Q4.end,
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
