/**
 * Which words a drill uses, and which items they turn into.
 *
 * Pure: same words + same seed = same drill. It reads `lib/mastery`, which
 * imports the Mongoose model for its SKILL_IDS value, so this module is
 * server-only — build the items in the page and pass them to the runner.
 */

import { dueSkills, skillDue } from "@/lib/mastery";
import { shuffle } from "@/lib/math/rng";
import type { Rng } from "@/lib/math/types";
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

export type PickedWord = {
  word: ClientWord;
  pool: ItemPool;
};

/** Any skill still under streak 2. */
export function isWeak(word: ClientWord): boolean {
  return SKILL_IDS.some((id) => word.skills[id].streak < WEAK_STREAK);
}

/** Any skill due for review right now. */
export function isDue(word: ClientWord, now: Date): boolean {
  return SKILL_IDS.some((id) => skillDue(word.skills[id], now));
}

export type SourceCounts = {
  all: number;
  weak: number;
  due: number;
  lists: { listId: string; name: string; count: number }[];
};

/** The numbers on the source chips. */
export function sourceCounts(lists: DrillList[], now: Date): SourceCounts {
  let all = 0;
  let weak = 0;
  let due = 0;
  for (const list of lists) {
    all += list.words.length;
    for (const word of list.words) {
      if (isWeak(word)) weak++;
      if (isDue(word, now)) due++;
    }
  }
  return {
    all,
    weak,
    due,
    lists: lists.map((l) => ({ listId: l.listId, name: l.name, count: l.words.length })),
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
  const keyed = shuffle(rng, picked).map((p) => {
    const streak = Math.min(...SKILL_IDS.map((id) => p.word.skills[id].streak));
    const dueAt = Math.min(...SKILL_IDS.map((id) => new Date(p.word.skills[id].dueAt).getTime()));
    return { p, due: isDue(p.word, now), streak, dueAt };
  });
  keyed.sort((a, b) => {
    if (a.due !== b.due) return a.due ? -1 : 1;
    if (a.streak !== b.streak) return a.streak - b.streak;
    return a.dueAt - b.dueAt;
  });
  return keyed.map((k) => k.p);
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
