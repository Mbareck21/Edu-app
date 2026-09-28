/**
 * Which words a drill uses, and which items they turn into.
 *
 * Pure: same words + same seed = same drill. It reads `lib/mastery`, which
 * imports the Mongoose model for its SKILL_IDS value, so this module is
 * server-only — build the items in the page and pass them to the runner.
 */

import { todayKey } from "@/lib/day";
import { KNOWN_STREAK, STUCK_WINDOW_DAYS, dueSkills, skillDue } from "@/lib/mastery";
import type { Rng } from "@/lib/math/types";
import { orderByNeed } from "@/lib/practice-order";
import { SKILL_IDS, type ClientWord, type SkillId } from "@/lib/models/WordList";
import { itemForSkill, makeWrite, type ItemPool, type LessonItem } from "@/lib/items";

import type { DrillSource, VocabMode } from "@/components/drill/options";
import { SUGGESTED_WORD_MODES } from "@/components/drill/suggest";

/** Below this streak a skill still gets tile support. */
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

/**
 * A word he has been getting wrong: some skill whose last answer was a miss
 * in the last STUCK_WINDOW_DAYS, or a skill he has answered before that is
 * due again at streak 0. Words he never started are not weak, just new.
 *
 * It used to be any skill under streak 2, which is every word not yet known:
 * 181 of 182, so "Weak" was just "All" under another name.
 */
export function isWeak(word: SkillsOnly, now: Date): boolean {
  return weakSkills(word, now).length > 0;
}

/** The skills that make a word weak (see isWeak). */
export function weakSkills(word: SkillsOnly, now: Date): SkillId[] {
  return SKILL_IDS.filter((id) => {
    const s = word.skills[id];
    if (s.lastAt === null) return false;
    // Same reading as isStuckMiss: streak 0, or an early miss's dueAt === lastAt.
    const lastWasMiss = s.wrong > 0 && (s.streak === 0 || s.dueAt === s.lastAt);
    const recent = now.getTime() - new Date(s.lastAt).getTime() <= STUCK_WINDOW_DAYS * 86_400_000;
    return (lastWasMiss && recent) || (s.streak === 0 && skillDue(s, now));
  });
}

/**
 * The suggested word-drill types that can fix these weak skills. A word weak
 * on spelling is only fixed by a drill that asks for spelling: Match and
 * Listen on it answered other skills, so it stayed weak drill after drill.
 * Writing counts as spelling practice. None of them left: every type.
 */
export function modesFor(skills: readonly SkillId[]): VocabMode[] {
  const helps = SUGGESTED_WORD_MODES.filter((mode) => {
    const skill = mode === "flashcards" ? "spell" : modeSkill(mode);
    return skill !== null && skills.includes(skill);
  });
  return helps.length > 0 ? helps : [...SUGGESTED_WORD_MODES];
}

/** Any skill due for review right now. */
export function isDue(word: SkillsOnly, now: Date): boolean {
  return SKILL_IDS.some((id) => skillDue(word.skills[id], now));
}

export type SourceCounts = {
  /** Words still to do today, across every list. See isDoneForNow. */
  all: number;
  /** Every word, learned or not. */
  total: number;
  weak: number;
  /** Every skill that makes one of the weak words weak. */
  weakSkills: SkillId[];
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

/**
 * Nothing left to do on this word today: he got at least one of its skills
 * right today and has not missed it since, or it is settled and not due.
 *
 * The chips used to count words not yet settled. Settling takes right answers
 * a week apart, so a drill he had just finished moved nothing and the numbers
 * looked broken. This moves the moment he gets a word right, the way a times
 * table cell lights on the first right answer, and it comes back tomorrow
 * until the word is truly settled.
 */
export function isDoneForNow(word: SkillsOnly, now: Date): boolean {
  const today = todayKey(now);
  const rightToday = SKILL_IDS.some((id) => {
    const s = word.skills[id];
    // An early miss only halves the streak and stamps dueAt === lastAt: that
    // is a wrong answer today, not a right one.
    return s.streak >= 1 && s.lastAt !== null && s.dueAt !== s.lastAt && todayKey(new Date(s.lastAt)) === today;
  });
  return rightToday || (isSettled(word) && !isDue(word, now));
}

/** The numbers on the source chips. */
export function sourceCounts(lists: CountableList[], now: Date): SourceCounts {
  // The chips used to show plain totals, so a list he had mastered looked
  // exactly like one he had never opened. They report what is LEFT now.
  let all = 0;
  let total = 0;
  let weak = 0;
  let due = 0;
  const skills = new Set<SkillId>();
  const perList = lists.map((l) => {
    const toGo = l.words.filter((w) => !isDoneForNow(w, now)).length;
    all += toGo;
    total += l.words.length;
    for (const word of l.words) {
      const ws = weakSkills(word, now);
      if (ws.length > 0) weak++;
      for (const id of ws) skills.add(id);
      if (isDue(word, now)) due++;
    }
    return { listId: l.listId, name: l.name, total: l.words.length, toGo };
  });
  return {
    all,
    total,
    weak,
    weakSkills: SKILL_IDS.filter((id) => skills.has(id)),
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
      if (source.kind === "weak" && !isWeak(word, now)) continue;
      if (source.kind === "due" && !isDue(word, now)) continue;
      out.push({ word, pool });
    }
  }
  return out;
}

/**
 * Most times one word comes round in a single-skill drill: once, and once
 * more a whole round later, which is spaced practice. A third identical
 * question is repetition for its own sake (a 14-word list at 40 items asked
 * 65% of its listen and spell questions again). Mixed asks a different skill
 * each round, so it may go round once per skill.
 */
export const MAX_PER_WORD = 2;

/**
 * Two or three weak words in a 10-item drill came round four or five times
 * each, one of them back to back. Weak and due drills only. Past MAX_PER_WORD a turn, fill with other
 * words he is still learning: the ones due now first, then the lowest streak.
 */
export function withFill(
  picked: PickedWord[],
  lists: DrillList[],
  count: number,
  now: Date,
  rng: Rng
): PickedWord[] {
  // One copy of each word. A stuck word is in the pool and in its unit, and
  // both copies came round. The later one wins: getPractice puts the pool
  // first, and the unit copy is the one that counts toward Known.
  const one = new Map<string, PickedWord>();
  for (const p of picked) one.set(p.word.word, p);
  const unique = [...one.values()];
  const need = Math.ceil(count / MAX_PER_WORD);
  if (unique.length >= need) return unique;
  const have = new Set(one.keys());
  const rest = pickWords(lists, { kind: "all" }, now).filter((p) => {
    if (have.has(p.word.word) || isSettled(p.word)) return false;
    have.add(p.word.word); // a pool copy and its unit copy are one word
    return true;
  });
  return [...unique, ...orderWords(rest, now, rng).slice(0, need - unique.length)];
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
 * Up to `count` items, round-robin over the words so the same word never
 * lands twice in a row. A short list comes round again at most MAX_PER_WORD
 * times (once per skill in a mixed drill), so the drill ends early rather
 * than repeat the same question.
 */
export function buildDrillItems({ picked, mode, count, now, rng }: BuildDrillArgs): LessonItem[] {
  const ordered = orderWords(picked, now, rng);
  if (ordered.length === 0 || count <= 0) return [];

  const passes = mode === "mixed" ? SKILL_IDS.length : MAX_PER_WORD;
  const total = Math.min(count, ordered.length * passes);
  const items: LessonItem[] = [];
  for (let pass = 0; items.length < total; pass++) {
    for (const p of ordered) {
      if (items.length >= total) break;
      items.push(itemFor(p, mode, pass, now, rng));
    }
  }
  return items;
}
