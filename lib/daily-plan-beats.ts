// The day's beats with their links, from his lists, activity and math levels.
// Pure; used by Home and, through lib/daily-plan-data.ts, the beat pages.
// Not for client components: lesson-builder brings the word-list model along.

import { SCHOOL_YEAR_END } from "@/lib/curriculum";
import { doneToday, PLAN_ORDER, type BeatId, type PlanBeat } from "@/lib/daily-plan";
import { isNewWord } from "@/lib/lesson-builder";
import type { ListSummary, SummaryWord } from "@/lib/lists";
import { MATH_SKILLS, getSkill, type MathSkillId } from "@/lib/math";
import { currentLesson } from "@/lib/math/iready";
import type { ClientWord } from "@/lib/models/WordList";
import type { ActivityEntry } from "@/lib/types";

/**
 * A summary carries a word's skills but not its SRS state. The whole-word
 * helpers used here read only the skills plus reviewCount, and a word with no
 * skill answered has no review either, so 0 stands in for it.
 */
export function asWord(w: SummaryWord): ClientWord {
  return { ...w, srs: { reviewCount: 0 } } as unknown as ClientWord;
}

/**
 * The unit in play: the newest list that still has a word he has not met,
 * so the quest does not stall on a list he has finished. Never an empty list:
 * its beats would open "Add a word list first" every time.
 */
export function unitOf(lists: readonly ListSummary[]): ListSummary | null {
  return (
    lists.find((l) => l.words.some((w) => isNewWord(asWord(w)))) ??
    lists.find((l) => l.words.length > 0) ??
    null
  );
}

/**
 * The math lesson for the day. In the school year: the maths his class is on.
 * A lesson usually maps to more than one skill, and he has been grinding
 * place value for a week, so the date rotates through that lesson's skills —
 * deterministic, so the page stays pure. After the last school day: one of
 * his lowest-level skills, rotated the same way.
 */
export function mathSkillFor(today: string, levels: Readonly<Record<string, number>>): MathSkillId {
  const dayIndex = Number(today.slice(8, 10)) + Number(today.slice(5, 7)) * 31;
  if (today <= SCHOOL_YEAR_END) {
    const skills = currentLesson(today).skills;
    return skills[dayIndex % Math.max(1, skills.length)] ?? "place-value";
  }
  const levelOf = (id: string) => levels[id] ?? 1;
  const lowest = Math.min(...MATH_SKILLS.map((s) => levelOf(s.id)));
  const pool = MATH_SKILLS.filter((s) => levelOf(s.id) === lowest);
  return pool[dayIndex % pool.length]?.id ?? "place-value";
}

/** The day's beats, in plan order. A beat with no href needs a word list first. */
export function planBeats({
  activity,
  lists,
  mathLevels,
  today,
}: {
  activity: readonly Pick<ActivityEntry, "at" | "kind" | "ref">[];
  lists: readonly ListSummary[];
  mathLevels: Readonly<Record<string, number>>;
  today: string;
}): PlanBeat[] {
  const unit = unitOf(lists);
  // Review only takes words he has met. Before the first one it was empty,
  // and Start sent him back to it every time.
  const met = lists.some((l) => l.words.some((w) => !isNewWord(asWord(w))));
  // Every word met: the beat still practises, but it has no new words to promise.
  const anyNew = lists.some((l) => l.words.some((w) => isNewWord(asWord(w))));
  const done = doneToday(activity, today);
  const skill = getSkill(mathSkillFor(today, mathLevels));
  const beats: Record<BeatId, Omit<PlanBeat, "id" | "done">> = {
    review: {
      name: "Review",
      blurb: "Words that are due",
      icon: "clock",
      href: unit && met ? "/learn/today/review" : null,
      lockedBlurb: unit ? "After New words" : undefined,
    },
    read: {
      name: "Reading",
      blurb: "Read, then answer",
      icon: "book",
      href: unit ? `/learn/${unit._id}/read` : null,
    },
    // Straight into a lesson, not the math overview: Start means start.
    math: { name: "Math", blurb: skill.name, icon: "math", href: `/math/${skill.id}` },
    new: {
      name: "New words",
      blurb: anyNew ? "Three new words" : "Practise your words",
      icon: "sparkles",
      href: unit ? "/learn/today/new-words" : null,
    },
    structure: {
      name: "Text structure",
      blurb: "How is it built?",
      icon: "words",
      href: "/learn/structure",
    },
    production: {
      name: "Write and use",
      blurb: "Spell it, then use it",
      icon: "edit",
      href: unit ? "/learn/today/production" : null,
    },
  };
  return PLAN_ORDER.map((id) => ({ id, ...beats[id], done: done[id] }));
}
