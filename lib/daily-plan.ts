/**
 * Today's plan: the six beats of a day, in the order the app walks him
 * through them. Subjects alternate so no two word beats sit side by side.
 * Home's Start button opens the next unfinished beat, and each beat's finish
 * screen sends him on to the one after. Drills stay free choice, outside it.
 *
 * Home and the beat pages build the beats with the same function
 * (lib/daily-plan-beats.ts), so "done" means the same thing on both. Safe for
 * client components; pure apart from the cheer-once stamp at the bottom,
 * which is browser storage.
 */

import type { IconName } from "@/components/ui/Icon";
import { todayKey } from "@/lib/day";
import { learnerFromCookie } from "@/lib/learners";
import { isMathLesson } from "@/lib/math";
import type { ActivityEntry } from "@/lib/types";

export const PLAN_ORDER = ["review", "read", "math", "new", "structure", "production"] as const;
export type BeatId = (typeof PLAN_ORDER)[number];

export type PlanBeat = {
  id: BeatId;
  name: string;
  blurb: string;
  icon: IconName;
  href: string | null;
  /** Shown instead of the blurb while there is no href. Default: "Add words first". */
  lockedBlurb?: string;
  done: boolean;
};

/** What a beat's finish screen shows: the plan with this beat ticked, and where next. */
export type PlanProgress = {
  day: string;
  beats: { id: BeatId; icon: IconName; done: boolean; current: boolean }[];
  done: number;
  total: number;
  next: { id: BeatId | null; label: string; href: string };
};

/** Which beats are done on `today`, from the activity log. */
export function doneToday(
  activity: readonly Pick<ActivityEntry, "at" | "kind" | "ref">[],
  today: string
): Record<BeatId, boolean> {
  const day = activity.filter((a) => todayKey(new Date(a.at)) === today);
  const did = (ref: string) => day.some((a) => a.ref === ref);
  return {
    review: did("quest:review"),
    read: day.some(
      (a) => (a.kind === "reading" && a.ref !== "read:structure") || a.ref.endsWith(":read")
    ),
    // A whole math lesson (any skill), not a quick drill or a tables round:
    // two answers in a drill used to tick the beat.
    math: day.some((a) => a.kind === "math" && isMathLesson(a.ref)),
    new: did("quest:new"),
    structure: did("read:structure"),
    production: did("quest:production"),
  };
}

/** The first beat in plan order not done yet and open to him, skipping `current`. */
export function nextBeat(beats: readonly PlanBeat[], current?: BeatId): PlanBeat | null {
  return beats.find((b) => !b.done && b.href !== null && b.id !== current) ?? null;
}

/** The plan as the finish screen of `current` sees it: that beat counts as done. */
export function planProgress(beats: readonly PlanBeat[], current: BeatId, day: string): PlanProgress {
  const ticked = beats.map((b) => ({
    id: b.id,
    icon: b.icon,
    done: b.done || b.id === current,
    current: b.id === current,
  }));
  const done = ticked.filter((b) => b.done).length;
  const next = nextBeat(beats, current);
  return {
    day,
    beats: ticked,
    done,
    total: beats.length,
    next: next?.href
      ? { id: next.id, label: `Next: ${next.name}`, href: next.href }
      : {
          id: null,
          label: done === beats.length ? "All done — back to Learn" : "Back to Learn",
          href: "/",
        },
  };
}

/** A short cheer for how far through the plan he is. */
export function planCheer(done: number, total: number): string {
  if (done >= total) return "All done today! Amazing work!";
  if (total - done === 1) return `${done} of ${total} done — one to go!`;
  return `${done} of ${total} done — keep going!`;
}

const CHEER_KEY = "quest:plan-cheered";

/**
 * True the first time it is asked on `day`, on this device, for this child:
 * the big all-done celebration is once a day, not every visit to Home. Keyed
 * by child, or the first boy to finish on a shared phone took the second's.
 */
export function claimCheer(day: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const who = typeof document === "undefined" ? null : learnerFromCookie(document.cookie);
    const key = who ? `${CHEER_KEY}:${who}` : CHEER_KEY;
    if (window.localStorage.getItem(key) === day) return false;
    window.localStorage.setItem(key, day);
    return true;
  } catch {
    // Blocked storage: no stamp to keep, and no cheer to repeat either.
    return false;
  }
}
