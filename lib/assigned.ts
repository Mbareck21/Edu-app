/**
 * What a child may start right now, and nothing else: the beats of today's
 * quest he has not done, and the drill the Drill tab suggests. Everything else
 * that pays XP (a unit's steps, a chosen drill, a math skill picked off the
 * list, times tables, Words to fix, "Again" on a finished beat) is a single
 * item he could repeat for points, so it is closed to him (the parent's call,
 * 2026-10-04). A grown-up with the PIN can still open anything.
 *
 * Pure: the pages work out the quest and the suggestion, this says whether a
 * request is one of them.
 */

import { beatOfSession, doneToday } from "@/lib/daily-plan";
import type { ActivityEntry } from "@/lib/types";

export type Assigned = {
  /** Links of the quest beats not done today. */
  quest: readonly string[];
  /** The suggested drill's link, or null when there is nothing to suggest. */
  drill: string | null;
};

/** The quest beats he may still open: those not done today that have somewhere to go. */
export function questHrefs(beats: readonly { done: boolean; href: string | null }[]): string[] {
  return beats.filter((b) => !b.done && b.href !== null).map((b) => b.href as string);
}

/** A unit's reading step, whichever unit: /learn/<list>/read. */
const READ_STEP = /^\/learn\/[^/]+\/read$/;

/**
 * The parameters that pick the drill: not the seed, which only deals its
 * questions, nor the assignment mark (lib/ticket.ts).
 */
export function drillKey(params: URLSearchParams): string {
  return [...params.entries()]
    .filter(([k]) => k !== "seed" && k !== "a")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
}

/**
 * Whether the page at `path` with `search` is one he was handed. A quest beat
 * matches on its path (the beat pages add ?r or ?saved themselves). The
 * Reading beat is any unit's reading: when his unit has nothing to read, the
 * beat sends him to a passage on another list. The drill must match the
 * suggestion in everything but its seed.
 */
export function isAssigned(path: string, search: URLSearchParams, assigned: Assigned): boolean {
  for (const href of assigned.quest) {
    const beatPath = href.split("?")[0];
    if (beatPath === path) return true;
    if (READ_STEP.test(beatPath) && READ_STEP.test(path)) return true;
  }
  if (assigned.drill) {
    const [drillPath, query = ""] = assigned.drill.split("?");
    if (drillPath === path && drillKey(new URLSearchParams(query)) === drillKey(search)) return true;
  }
  return false;
}

/** Why a child's session pays no XP; see unpaidReason. Read out on his finish screen. */
export const UNPAID_NOT_HANDED = "Start from Today's quest or the Drill tab to earn XP.";
export const UNPAID_DONE_TODAY = "You did this one today already, so it is practice: no XP.";

/**
 * Why a session a child played pays no XP, checked when it is paid, not only
 * when the page opened (2026-10-04 audit): a page replayed from the phone, or
 * the same beat posted twice (two tabs, a send that timed out and was redone),
 * got past the page's check. Unlocked (a grown-up, or no ADULT_PIN), all pays.
 *
 * `ticketed`: the session id is a ticket minted with a page handed to him
 * (lib/ticket.ts). `activity` is his log before this session.
 */
export function unpaidReason(o: {
  locked: boolean;
  ticketed: boolean;
  activity: readonly Pick<ActivityEntry, "at" | "kind" | "ref">[];
  session: Pick<ActivityEntry, "kind" | "ref">;
  day: string;
}): string | undefined {
  if (!o.locked) return undefined;
  if (!o.ticketed) return UNPAID_NOT_HANDED;
  const beat = beatOfSession(o.session);
  if (beat && doneToday(o.activity, o.day)[beat]) return UNPAID_DONE_TODAY;
  return undefined;
}

/** How long a handed drill link stays good if he does not play it. */
export const DRILL_MARK_MS = 3 * 60 * 60 * 1000;

/**
 * Whether a drill link handed at `issuedAt` (lib/ticket.ts) still opens: not
 * older than DRILL_MARK_MS, and no drill played since. Played, it is used:
 * "Next drill" hands the next one.
 */
export function drillMarkValid(
  issuedAt: number,
  activity: readonly Pick<ActivityEntry, "at" | "ref">[],
  now: number
): boolean {
  if (issuedAt > now || now - issuedAt > DRILL_MARK_MS) return false;
  return !activity.some((a) => a.ref.startsWith("drill:") && new Date(a.at).getTime() >= issuedAt);
}
