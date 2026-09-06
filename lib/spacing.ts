/**
 * The spacing ladder, on its own.
 *
 * lib/mastery.ts owns the per-skill scheduling, but it value-imports SKILL_IDS
 * from the Mongoose model, so anything that imports mastery at runtime drags
 * Mongoose into the browser bundle — which is exactly what happened when the
 * spelling chain reached for the ladder from a client component. The ladder
 * is pure data. Two pure modules share it from here, and the model stays on
 * the server where it belongs.
 */

/**
 * Days until the next review after N right answers in a row. Roughly the
 * classic 1-3-7 shape, stretched so a word settled six times is only checked
 * every three months.
 */
export const SKILL_LADDER_DAYS = [1, 3, 7, 16, 35, 90] as const;

export const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Gap in days after `streak` right answers in a row. */
export function skillGapDays(streak: number): number {
  const i = Math.max(1, Math.floor(streak)) - 1;
  return SKILL_LADDER_DAYS[Math.min(i, SKILL_LADDER_DAYS.length - 1)];
}
