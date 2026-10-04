// Server side of lib/assigned.ts: what the signed-in child was handed today,
// read the way Home and the Drill tab read it, and the gate the pages call.

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { modesFor, sourceCounts } from "@/components/drill/picks";
import { suggestionFor, type Suggestion } from "@/components/drill/suggest";
import { ADULT_COOKIE, adultLockOn, isAdultToken } from "@/lib/adult";
import { drillMarkValid, isAssigned, questHrefs } from "@/lib/assigned";
import { currentLearner } from "@/lib/auth";
import { todayKey } from "@/lib/day";
import { db } from "@/lib/db";
import { levelsOf } from "@/lib/daily-plan-data";
import { planBeats } from "@/lib/daily-plan-beats";
import { getListSummaries } from "@/lib/lists";
import { toClientMathProgress } from "@/lib/models/MathProgress";
import { getProfile } from "@/lib/profile";
import { readDrillMark, signDrill } from "@/lib/ticket";
import { getPractice } from "@/lib/word-source";

/**
 * True when a child is using the app: the grown-ups PIN is set and has not
 * been entered. With no ADULT_PIN nothing is locked, as before.
 */
export async function kidLocked(): Promise<boolean> {
  if (!adultLockOn()) return false;
  return !(await isAdultToken((await cookies()).get(ADULT_COOKIE)?.value));
}

/** The Drill tab's suggestion now. /drill, /drill/next and the gate all read this one. */
export async function currentSuggestion(now: Date = new Date()): Promise<Suggestion | null> {
  const { MathProgress } = await db();
  const [practice, mathDocs, profile] = await Promise.all([getPractice(), MathProgress.find().lean(), getProfile()]);
  const lists = practice
    .filter((l) => l.words.length > 0)
    .map((l) => ({ listId: l._id, name: l.name, words: l.words }));
  const counts = sourceCounts(lists, now);
  return suggestionFor({
    weakWords: counts.weak,
    dueWords: counts.due,
    toGoWords: counts.all,
    wordModes: modesFor(counts.weakSkills),
    played: mathDocs.map((doc) => toClientMathProgress(doc)),
    activity: profile.activity,
    now,
  });
}

/** Links of today's quest beats not yet done. */
async function currentQuest(): Promise<string[]> {
  const { MathProgress } = await db();
  const [profile, lists, mathRows] = await Promise.all([
    getProfile(),
    getListSummaries(),
    MathProgress.find().select("skill level").lean(),
  ]);
  return questHrefs(planBeats({ activity: profile.activity, lists, mathLevels: levelsOf(mathRows), today: todayKey() }));
}

/**
 * The gate for a page that runs a quest beat. A child who opens anything
 * else (a beat already done, another unit's step, a skill off the list) goes
 * back to Home, where Start opens what is next.
 */
export async function requireQuestBeat(path: string): Promise<void> {
  if (!(await kidLocked())) return;
  if (isAssigned(path, new URLSearchParams(), { quest: await currentQuest(), drill: null })) return;
  redirect("/");
}

/** The suggestion's link, marked as handed to the signed-in child (lib/ticket.ts). */
export async function signedSuggestionHref(suggestion: Suggestion | null): Promise<string | null> {
  return suggestion ? signDrill(suggestion.href, await currentLearner()) : null;
}

/**
 * The gate for a drill page: the drill the Drill tab or "Next drill" handed
 * him (its link carries the mark, good until he plays a drill), else one that
 * is still the suggestion now; anything else goes back to the Drill tab.
 */
export async function requireSuggestedDrill(
  path: string,
  search: Record<string, string | string[] | undefined>
): Promise<void> {
  if (!(await kidLocked())) return;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(search)) if (typeof v === "string") params.set(k, v);
  const mark = readDrillMark(path, params, await currentLearner());
  if (mark && drillMarkValid(mark.issuedAt, (await getProfile()).activity, Date.now())) return;
  const drill = (await currentSuggestion())?.href ?? null;
  if (isAssigned(path, params, { quest: [], drill })) return;
  redirect("/drill");
}

/** The gate for a page with nothing a child is ever handed: times tables, a unit's path. */
export async function requireGrownUp(fallback: string): Promise<void> {
  if (await kidLocked()) redirect(fallback);
}
