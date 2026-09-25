// Which school grade the children are in. Both are in Grade 4 for 2026-27 and
// move up to Grade 5 the day after the last day of school. Grade 5 is as far
// as the app's content goes.
//
// Pure: safe to import from client components.

import { SCHOOL_YEAR_END } from "@/lib/curriculum";

export type Grade = 4 | 5;

/** The grade on a YYYY-MM-DD day. */
export function gradeOn(dayKey: string): Grade {
  return dayKey.slice(0, 10) > SCHOOL_YEAR_END ? 5 : 4;
}
