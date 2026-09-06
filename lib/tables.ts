/**
 * Times tables, 2 to 9, as a grid to fill in rather than a test to sit.
 *
 * The grid is the game. Eight rows (the tables) by ten columns (x1 to x10);
 * a cell lights when he knows that fact and turns gold when he knows it fast.
 * Mastering the tables means filling the grid. Nothing to unlock, nothing to
 * lose except honestly: a cell goes dark again if he forgets, which is what
 * "master them" has to mean.
 *
 * Two things make it smart rather than a flashcard pile:
 *   - 7x8 and 8x7 are ONE fact, shown either way round. Knowing one is
 *     knowing the other, and the grid lights both cells at once.
 *   - Every fact rides the same spacing ladder as the rest of the app. A
 *     round asks first for the facts that are due or weak, so his time goes
 *     where it counts, and a fact is only "known" after right answers on
 *     separate days.
 *
 * Pure: no clock, no storage, no React.
 */

import { KNOWN_STREAK, MS_PER_DAY, skillGapDays } from "@/lib/spacing";

/** The tables he is learning. His father asked for two to nine. */
export const TABLES: readonly number[] = [2, 3, 4, 5, 6, 7, 8, 9];
/** Each table runs x1 to x10. */
export const TABLE_UP_TO = 10;
/** Facts in one round: a whole table's worth. */
export const ROUND_SIZE = 10;
/** A right answer this quick is recall, not working out. Matches XP.fast. */
export const FAST_MS = 3000;

/** "7x8" for 7x8 and for 8x7. The smaller factor first, always. */
export function factKey(a: number, b: number): string {
  return a <= b ? `${a}x${b}` : `${b}x${a}`;
}

export type FactState = {
  key: string;
  /** Right in a row, counted only when the fact was due. */
  streak: number;
  correct: number;
  wrong: number;
  /** Right answers under FAST_MS. */
  fast: number;
  /** True when his most recent right answer was fast. Gold on the grid. */
  lastFast: boolean;
  dueAt: string | null;
  lastAt: string | null;
};

export function newFact(a: number, b: number): FactState {
  return {
    key: factKey(a, b),
    streak: 0,
    correct: 0,
    wrong: 0,
    fast: 0,
    lastFast: false,
    dueAt: null,
    lastAt: null,
  };
}

/** Build a state from a stored row, tolerating anything missing. */
export function factFromRow(
  key: string,
  row:
    | {
        streak?: unknown;
        correct?: unknown;
        wrong?: unknown;
        fast?: unknown;
        lastFast?: unknown;
        dueAt?: unknown;
        lastAt?: unknown;
      }
    | null
    | undefined
): FactState {
  const [a, b] = key.split("x").map(Number);
  if (!row) return newFact(a, b);
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0);
  const iso = (v: unknown) => {
    if (v instanceof Date) return v.toISOString();
    if (typeof v === "string" && v) return new Date(v).toISOString();
    return null;
  };
  return {
    key,
    streak: num(row.streak),
    correct: num(row.correct),
    wrong: num(row.wrong),
    fast: num(row.fast),
    lastFast: row.lastFast === true,
    dueAt: iso(row.dueAt),
    lastAt: iso(row.lastAt),
  };
}

export function isKnown(f: FactState): boolean {
  return f.streak >= KNOWN_STREAK;
}

export function isDue(f: FactState, nowIso: string): boolean {
  return f.dueAt === null || nowIso >= f.dueAt;
}

/**
 * Apply one answer. Same shape as scheduleSkill for words: a right answer
 * before the fact is due is practice, not progress; the streak holds and the
 * due date stays. A miss zeroes the streak and makes it due now.
 */
export function applyFactAnswer(
  f: FactState,
  correct: boolean,
  ms: number,
  nowIso: string
): FactState {
  if (!correct) {
    return { ...f, streak: 0, wrong: f.wrong + 1, lastFast: false, dueAt: nowIso, lastAt: nowIso };
  }
  const fast = ms >= 0 && ms < FAST_MS;
  const early = !isDue(f, nowIso);
  const streak = early ? f.streak : f.streak + 1;
  const days = skillGapDays(Math.max(1, streak));
  return {
    ...f,
    streak,
    correct: f.correct + 1,
    fast: f.fast + (fast ? 1 : 0),
    lastFast: fast,
    dueAt: early ? f.dueAt : new Date(new Date(nowIso).getTime() + days * MS_PER_DAY).toISOString(),
    lastAt: nowIso,
  };
}

/** Every fact key in the grid, once. */
export function allFactKeys(): string[] {
  const keys = new Set<string>();
  for (const t of TABLES) for (let b = 1; b <= TABLE_UP_TO; b++) keys.add(factKey(t, b));
  return [...keys];
}

export type TableProgress = {
  table: number;
  known: number;
  fast: number;
  total: number;
};

/** How far along one table is: its ten facts, how many known, how many fast. */
export function tableProgress(table: number, facts: Record<string, FactState>): TableProgress {
  let known = 0;
  let fast = 0;
  for (let b = 1; b <= TABLE_UP_TO; b++) {
    const f = facts[factKey(table, b)];
    if (f && isKnown(f)) {
      known++;
      if (f.lastFast) fast++;
    }
  }
  return { table, known, fast, total: TABLE_UP_TO };
}

export type Fact = { a: number; b: number; key: string };

type Ranked = Fact & { need: number; jitter: number };

/**
 * Due first, then the weakest streak; and a fact he has actually got wrong
 * outranks one he has simply never met, so a miss comes straight back before
 * the round wanders off to fresh ground. Jitter keeps ties from sitting still.
 */
function rank(table: number, b: number, f: FactState, nowIso: string, rng: () => number): Ranked {
  const flip = b !== table && rng() < 0.5;
  const missed = f.wrong > 0 && f.streak === 0 ? 50 : 0;
  return {
    a: flip ? b : table,
    b: flip ? table : b,
    key: f.key,
    need:
      (isDue(f, nowIso) ? 100 : 0) +
      missed +
      (KNOWN_STREAK - Math.min(KNOWN_STREAK, f.streak)) * 10,
    jitter: rng(),
  };
}

function order(ranked: Ranked[]): Fact[] {
  return ranked
    .sort((x, y) => y.need - x.need || y.jitter - x.jitter)
    .map(({ a, b, key }) => ({ a, b, key }));
}

/**
 * One round on a table: all ten facts, the due and weak ones first, each
 * shown either way round at random so 7x8 is met as 8x7 too. `rng` is 0..1.
 */
export function buildTableRound(
  table: number,
  facts: Record<string, FactState>,
  nowIso: string,
  rng: () => number
): Fact[] {
  const ranked: Ranked[] = [];
  for (let b = 1; b <= TABLE_UP_TO; b++) {
    const key = factKey(table, b);
    ranked.push(rank(table, b, facts[key] ?? newFact(table, b), nowIso, rng));
  }
  return order(ranked);
}

/**
 * A lightning round: the facts most in need across every table he has
 * started, so a strong table stops being asked and a weak one keeps coming
 * back. Empty until he has started something.
 */
export function buildLightningRound(
  facts: Record<string, FactState>,
  nowIso: string,
  rng: () => number,
  size = ROUND_SIZE
): Fact[] {
  const started = new Set<number>();
  for (const key of Object.keys(facts)) {
    const [a, b] = key.split("x").map(Number);
    if (TABLES.includes(a)) started.add(a);
    if (TABLES.includes(b)) started.add(b);
  }
  const seen = new Set<string>();
  const ranked: Ranked[] = [];
  for (const t of [...started].sort((x, y) => x - y)) {
    for (let b = 1; b <= TABLE_UP_TO; b++) {
      const key = factKey(t, b);
      if (seen.has(key)) continue;
      seen.add(key);
      ranked.push(rank(t, b, facts[key] ?? newFact(t, b), nowIso, rng));
    }
  }
  return order(ranked).slice(0, size);
}

/**
 * Stars for a round. One for every fact right; two for doing it inside a
 * minute; three for inside thirty seconds, which is three seconds a fact,
 * recall rather than counting up. Speed counts for nothing until the
 * answers do.
 */
export function roundStars(correct: number, total: number, ms: number): 0 | 1 | 2 | 3 {
  if (total === 0 || correct < total) return 0;
  if (ms <= 30_000) return 3;
  if (ms <= 60_000) return 2;
  return 1;
}
