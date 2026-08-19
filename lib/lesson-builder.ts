// Lesson builder: which items, in which order.
//
// Pure. Same words + same seed = same lesson, so tests and the server agree
// with whatever the runner shows.
//
// The rules come from docs/pedagogy.md via the plan:
//   • due skills first, weakest streak first
//   • at most 3 NEW words, and each of them gets a blocked mini-set
//     (learn card + 3 items back to back) BEFORE any interleaved work
//   • every word in the lesson gets at least 2 items — never one and done
//   • the harder rung of a skill once its streak is 2 or more
//   • a wrong item comes back 2-4 places later (reEnqueue)

import { dueSkills, skillDue } from "@/lib/mastery";
import { shuffle } from "@/lib/math/rng";
import type { Rng } from "@/lib/math/types";
import { SKILL_IDS, type ClientWord, type SkillId } from "@/lib/models/WordList";
import {
  itemForSkill,
  makeLearnCard,
  makeWrite,
  schoolItem,
  type ItemPool,
  type ItemSkill,
  type LessonItem,
} from "@/lib/items";
import type { StepId } from "@/lib/types";

export const LESSON_SIZE = 12;
export const CHALLENGE_SIZE = 15;
export const REVIEW_CAP = 30;
export const PRODUCTION_SIZE = 6;
/** Items per new word, after its learn card. */
export const NEW_BLOCK_ITEMS = 3;
export const MAX_NEW_WORDS = 3;
/** Streak at which a skill moves to its harder rung. */
export const HARD_STREAK = 2;

/** The skill a path step drills. Challenge mixes all four. */
export function stepSkill(step: StepId): ItemSkill | "mixed" | null {
  switch (step) {
    case "match":
      return "recognize";
    case "listen":
      return "listen";
    case "spell":
      return "spell";
    case "use":
      return "use";
    case "challenge":
      return "mixed";
    default:
      return null;
  }
}

/** Never answered, never reviewed — today is day one for this word. */
export function isNewWord(word: ClientWord): boolean {
  if (word.srs.reviewCount > 0) return false;
  return SKILL_IDS.every((id) => word.skills[id].correct === 0 && word.skills[id].wrong === 0);
}

function isHard(word: ClientWord, skill: ItemSkill): boolean {
  return word.skills[skill].streak >= HARD_STREAK;
}

/** Weakest skill for a word, due ones first. */
function weakestSkill(word: ClientWord, now: Date, rng: Rng): ItemSkill {
  const due = dueSkills(word, now);
  if (due.length > 0) return due[0];
  return shuffle(rng, SKILL_IDS as readonly SkillId[]).sort(
    (a, b) => word.skills[a].streak - word.skills[b].streak
  )[0];
}

/**
 * Review order: words with this skill due come first, then the weakest
 * streak, then whatever is due soonest.
 */
function reviewOrder(
  words: ClientWord[],
  skill: ItemSkill | "mixed",
  now: Date,
  rng: Rng
): ClientWord[] {
  const keyed = shuffle(rng, words).map((word) => {
    const skills: ItemSkill[] = skill === "mixed" ? [...SKILL_IDS] : [skill];
    const due = skills.some((s) => skillDue(word.skills[s], now));
    const streak = Math.min(...skills.map((s) => word.skills[s].streak));
    const dueAt = Math.min(...skills.map((s) => new Date(word.skills[s].dueAt).getTime()));
    return { word, due, streak, dueAt };
  });
  keyed.sort((a, b) => {
    if (a.due !== b.due) return a.due ? -1 : 1;
    if (a.streak !== b.streak) return a.streak - b.streak;
    return a.dueAt - b.dueAt;
  });
  return keyed.map((k) => k.word);
}

/** learn card + 3 items on the same word, back to back. */
function blockedSet(
  word: ClientWord,
  pool: ItemPool,
  rng: Rng,
  skill: ItemSkill | "mixed"
): LessonItem[] {
  const third: ItemSkill =
    skill === "mixed" || skill === "recognize" || skill === "listen" ? "spell" : skill;
  return [
    makeLearnCard(word, pool),
    itemForSkill(word, "recognize", pool, rng, false),
    itemForSkill(word, "listen", pool, rng, false),
    itemForSkill(word, third, pool, rng, false),
  ];
}

/** Two items for one word: the plain rung, then the harder one when earned. */
function pairFor(
  word: ClientWord,
  pool: ItemPool,
  rng: Rng,
  skill: ItemSkill | "mixed",
  now: Date
): LessonItem[] {
  if (skill === "mixed") {
    const first = weakestSkill(word, now, rng);
    const second = SKILL_IDS.filter((s) => s !== first).sort(
      (a, b) => word.skills[a].streak - word.skills[b].streak
    )[0];
    return [
      itemForSkill(word, first, pool, rng, isHard(word, first)),
      itemForSkill(word, second, pool, rng, isHard(word, second)),
    ];
  }
  if (skill === "spell") {
    // Spelling has a hard ladder: tiles below streak 2, typed dictation at or
    // above it. Both items of the pair sit on the same rung.
    const hard = isHard(word, "spell");
    return [
      itemForSkill(word, "spell", pool, rng, hard),
      itemForSkill(word, "spell", pool, rng, hard),
    ];
  }
  return [
    itemForSkill(word, skill, pool, rng, false),
    itemForSkill(word, skill, pool, rng, isHard(word, skill)),
  ];
}

/** Spread the items so the same word never sits next to itself. */
function interleave(items: LessonItem[]): LessonItem[] {
  const left = items.slice();
  const out: LessonItem[] = [];
  while (left.length > 0) {
    const last = out[out.length - 1];
    let index = left.findIndex((i) => !last || !i.word || i.word !== last.word);
    if (index < 0) index = 0;
    out.push(left[index]);
    left.splice(index, 1);
  }
  return out;
}

export type BuildLessonArgs = {
  words: ClientWord[];
  step: StepId;
  now: Date;
  rng: Rng;
  /** New words allowed in one lesson. */
  maxNew?: number;
  listId?: string;
};

/**
 * One path-step lesson: 12 items (15 for the challenge).
 * New words are taught first in blocked mini-sets, then everything else is
 * interleaved.
 */
export function buildLesson({
  words,
  step,
  now,
  rng,
  maxNew = MAX_NEW_WORDS,
  listId,
}: BuildLessonArgs): LessonItem[] {
  const skill = stepSkill(step);
  if (!skill || words.length === 0) return [];
  const pool: ItemPool = { words, listId };
  const size = step === "challenge" ? CHALLENGE_SIZE : LESSON_SIZE;

  // The challenge is a speed round over words already started — no teaching.
  const fresh = step === "challenge" ? [] : words.filter(isNewWord);
  const newWords = fresh.slice(0, Math.max(0, maxNew));
  const blocked = newWords.flatMap((w) => blockedSet(w, pool, rng, skill));

  const taught = new Set(newWords.map((w) => w.word));
  let rest = words.filter((w) => !taught.has(w.word));
  if (step === "challenge") {
    const started = rest.filter((w) => SKILL_IDS.some((s) => w.skills[s].streak >= 1));
    if (started.length >= 2) rest = started;
  }

  // Word-part, context and sentence work rides on the "use" and challenge steps.
  const schoolCount = skill === "use" || skill === "mixed" ? 2 : 0;
  const budget = Math.max(0, size - blocked.length - schoolCount);

  const body: LessonItem[] = [];
  const used: ClientWord[] = [];
  const ordered = reviewOrder(rest, skill, now, rng);
  for (const word of ordered) {
    if (body.length + 2 > budget) break;
    body.push(...pairFor(word, pool, rng, skill, now));
    used.push(word);
  }
  // Leftover slots go to words already in the lesson, so nobody ends on one item.
  let guard = 0;
  while (body.length < budget && used.length > 0 && guard < budget + 4) {
    const word = used[guard % used.length];
    const s = skill === "mixed" ? weakestSkill(word, now, rng) : skill;
    body.push(itemForSkill(word, s, pool, rng, isHard(word, s)));
    guard++;
  }

  const school: LessonItem[] = [];
  for (let i = 0; i < schoolCount; i++) {
    school.push(schoolItem(pool, rng, ordered[i]));
  }

  return [...blocked, ...interleave([...body, ...school])];
}

export type ReviewList = {
  listId: string;
  words: ClientWord[];
};

export type BuildReviewArgs = {
  lists: ReviewList[];
  now: Date;
  rng: Rng;
  cap?: number;
};

/**
 * The Review beat: every due skill across every list, interleaved, weakest
 * first. When nothing is due it falls back to what is due soonest, so the beat
 * is never an empty screen.
 */
export function buildReviewSession({
  lists,
  now,
  rng,
  cap = REVIEW_CAP,
}: BuildReviewArgs): LessonItem[] {
  type Task = { word: ClientWord; skill: ItemSkill; pool: ItemPool; streak: number; dueAt: number };
  const due: Task[] = [];
  const soon: Task[] = [];

  for (const list of lists) {
    const pool: ItemPool = { words: list.words, listId: list.listId };
    for (const word of list.words) {
      if (isNewWord(word)) continue;
      for (const skill of SKILL_IDS) {
        const state = word.skills[skill];
        const task: Task = {
          word,
          skill,
          pool,
          streak: state.streak,
          dueAt: new Date(state.dueAt).getTime(),
        };
        if (skillDue(state, now)) due.push(task);
        else soon.push(task);
      }
    }
  }

  const chosen = due.length > 0 ? due : soon;
  const sorted = shuffle(rng, chosen).sort((a, b) => {
    if (a.streak !== b.streak) return a.streak - b.streak;
    return a.dueAt - b.dueAt;
  });
  const limit = due.length > 0 ? cap : Math.min(cap, 12);
  const items = sorted
    .slice(0, limit)
    .map((t) => itemForSkill(t.word, t.skill, t.pool, rng, isHard(t.word, t.skill)));
  return interleave(items);
}

export type BuildProductionArgs = {
  words: ClientWord[];
  now: Date;
  rng: Rng;
  listId?: string;
  size?: number;
};

/**
 * The Production beat: 6 items, spelling and using only — the two rungs that
 * make a word count as known.
 */
export function buildProductionSession({
  words,
  now,
  rng,
  listId,
  size = PRODUCTION_SIZE,
}: BuildProductionArgs): LessonItem[] {
  const pool: ItemPool = { words, listId };
  const usable = words.filter((w) => !isNewWord(w));
  const source = usable.length >= 2 ? usable : words;
  if (source.length === 0) return [];

  const ordered = reviewOrder(source, "spell", now, rng);
  const items: LessonItem[] = [];
  const used: ClientWord[] = [];
  for (const word of ordered) {
    if (items.length + 2 > size) break;
    items.push(
      word.skills.spell.streak >= HARD_STREAK
        ? makeWrite(word, pool)
        : itemForSkill(word, "spell", pool, rng, false)
    );
    items.push(itemForSkill(word, "use", pool, rng, isHard(word, "use")));
    used.push(word);
  }
  let guard = 0;
  while (items.length < size && used.length > 0 && guard < size + 4) {
    const word = used[guard % used.length];
    items.push(itemForSkill(word, "use", pool, rng, isHard(word, "use")));
    guard++;
  }
  return interleave(items);
}

/**
 * A miss comes back 2-4 places later — far enough that it is recall, close
 * enough that the kid still remembers being told.
 */
export function reEnqueue<T>(queue: T[], item: T, rng: Rng): T[] {
  if (queue.length === 0) return [item];
  const offset = 2 + Math.floor(rng() * 3); // 2, 3 or 4
  const at = Math.min(queue.length, offset);
  const next = queue.slice();
  next.splice(at, 0, item);
  return next;
}

/** How many items in the lesson belong to `word`. Used by the tests. */
export function countForWord(items: LessonItem[], word: string): number {
  return items.filter((i) => i.word === word).length;
}
