/**
 * Which words a drill uses, and which items they turn into.
 *
 * Pure: same words + same seed = same drill. It reads `lib/mastery`, which
 * imports the Mongoose model for its SKILL_IDS value, so this module is
 * server-only — build the items in the page and pass them to the runner.
 */

import { KNOWN_STREAK, dueSkills, skillDue } from "@/lib/mastery";
import type { Rng } from "@/lib/math/types";
import { orderByNeed } from "@/lib/practice-order";
import { SKILL_IDS, type ClientWord, type SkillId } from "@/lib/models/WordList";
import { itemForSkill, makeWrite, type ItemPool, type LessonItem } from "@/lib/items";

import type { DrillSource, VocabMode } from "@/components/drill/options";

/** Below this streak a skill still counts as weak. */
export const WEAK_STREAK = 2;

export type DrillList = {
  listId: string;
  name: string;
  words: ClientWord[];
};

/** The slice of a word the counters need — full ClientWords satisfy it too. */
export type SkillsOnly = Pick<ClientWord, "skills">;
export type CountableList = { listId: string; name: string; words: SkillsOnly[] };

export type PickedWord = {
  word: ClientWord;
  pool: ItemPool;
};

/** Any skill still under streak 2. */
export function isWeak(word: SkillsOnly): boolean {
  return SKILL_IDS.some((id) => word.skills[id].streak < WEAK_STREAK);
}

/** Any skill due for review right now. */
export function isDue(word: SkillsOnly, now: Date): boolean {
  return SKILL_IDS.some((id) => skillDue(word.skills[id], now));
}

export type SourceCounts = {
  /** Words still to learn, across every list. */
  all: number;
  /** Every word, learned or not. */
  total: number;
  weak: number;
  due: number;
  /** Sorted so the lists with the most left come first and finished ones sink. */
  lists: { listId: string; name: string; total: number; toGo: number }[];
};

/**
 * A word he has actually got: produced it at least once and holds a streak of
 * KNOWN_STREAK on every skill. Mirrors the "known" rule in lib/mastery.ts's
 * wordKnowledge, on the skills alone, which is all a drill list carries.
 */
export function isSettled(word: SkillsOnly): boolean {
  const produced = word.skills.spell.correct >= 1 || word.skills.use.correct >= 1;
  return produced && SKILL_IDS.every((id) => word.skills[id].streak >= KNOWN_STREAK);
}

/** The numbers on the source chips. */
export function sourceCounts(lists: CountableList[], now: Date): SourceCounts {
  // The chips used to show plain totals, so a list he had mastered looked
  // exactly like one he had never opened. They report what is LEFT now.
  let all = 0;
  let total = 0;
  let weak = 0;
  let due = 0;
  const perList = lists.map((l) => {
    const toGo = l.words.filter((w) => !isSettled(w)).length;
    all += toGo;
    total += l.words.length;
    for (const word of l.words) {
      if (isWeak(word)) weak++;
      if (isDue(word, now)) due++;
    }
    return { listId: l.listId, name: l.name, total: l.words.length, toGo };
  });
  return {
    all,
    total,
    weak,
    due,
    lists: perList.sort((a, b) => b.toGo - a.toGo),
  };
}

/**
 * Every word the source allows, each stamped with its own list as the
 * distractor pool.
 */
export function pickWords(lists: DrillList[], source: DrillSource, now: Date): PickedWord[] {
  const chosen = source.kind === "list" ? lists.filter((l) => l.listId === source.listId) : lists;
  const out: PickedWord[] = [];
  for (const list of chosen) {
    const pool: ItemPool = { words: list.words, listId: list.listId };
    for (const word of list.words) {
      if (source.kind === "weak" && !isWeak(word)) continue;
      if (source.kind === "due" && !isDue(word, now)) continue;
      out.push({ word, pool });
    }
  }
  return out;
}

/** The skill a single-skill mode drills. `null` = the mode mixes them. */
export function modeSkill(mode: VocabMode): SkillId | null {
  switch (mode) {
    case "match":
      return "recognize";
    case "listen":
      return "listen";
    case "spell":
    case "write":
      return "spell";
    case "use":
      return "use";
    default:
      return null;
  }
}

/** Due skills first, then the weakest, then whatever is due soonest. */
export function orderWords(picked: PickedWord[], now: Date, rng: Rng): PickedWord[] {
  return orderByNeed(picked, rng, (p) => ({
    due: isDue(p.word, now),
    streak: Math.min(...SKILL_IDS.map((id) => p.word.skills[id].streak)),
  }));
}

/** Weakest skills first for a mixed drill: due ones, then the shortest streak. */
function skillOrder(word: ClientWord, now: Date): SkillId[] {
  const due = dueSkills(word, now);
  const rest = SKILL_IDS.filter((id) => !due.includes(id)).sort(
    (a, b) => word.skills[a].streak - word.skills[b].streak
  );
  return [...due, ...rest];
}

function itemFor(
  picked: PickedWord,
  mode: VocabMode,
  pass: number,
  now: Date,
  rng: Rng
): LessonItem {
  const { word, pool } = picked;
  // The spelling test is dictation, always — no tiles, whatever the streak is.
  if (mode === "write") return makeWrite(word, pool);
  const skill = modeSkill(mode) ?? skillOrder(word, now)[pass % SKILL_IDS.length];
  return itemForSkill(word, skill, pool, rng, word.skills[skill].streak >= WEAK_STREAK);
}

export type BuildDrillArgs = {
  picked: PickedWord[];
  mode: VocabMode;
  /** 10, 20 or 40. */
  count: number;
  now: Date;
  rng: Rng;
};

/**
 * `count` items, round-robin over the words so the same word never lands twice
 * in a row. A short list simply comes round again.
 */
export function buildDrillItems({ picked, mode, count, now, rng }: BuildDrillArgs): LessonItem[] {
  const ordered = orderWords(picked, now, rng);
  if (ordered.length === 0 || count <= 0) return [];

  const items: LessonItem[] = [];
  for (let pass = 0; items.length < count; pass++) {
    for (const p of ordered) {
      if (items.length >= count) break;
      items.push(itemFor(p, mode, pass, now, rng));
    }
  }
  return items;
}
