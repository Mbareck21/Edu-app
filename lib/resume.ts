/**
 * Progress that survives a reload, and closing the app, for the rest of the day.
 *
 * He swipes down to scroll, the browser reads it as pull-to-refresh, and the
 * lesson he was six questions into starts again from the top. The refresh
 * itself is turned off in globals.css; this is the second line, for the
 * reloads that still happen — a browser back-swipe, a tab the phone dropped,
 * a tap on the address bar — and for the app closed halfway through a lesson
 * he comes back to after dinner.
 *
 * localStorage, with the kid's day stamped on every value: a run resumes all
 * day and is gone at his midnight (lib/day.ts), which is the right lifetime
 * for "where was I". Every read and write is wrapped: storage can be missing
 * or throw in private windows and previews, and a lesson must run either way.
 *
 * Pure apart from storage; no React here.
 */

import { todayKey } from "@/lib/day";
import { learnerFromCookie } from "@/lib/learners";

const PREFIX = "quest:resume:";

/** What is stored: the value, the day it was saved on and whose run it is. */
type Stamped = { day: string; value: unknown; who?: string };

/** One key per run. The seed makes "Again" a different run from the last. */
export function resumeKey(kind: string, id: string, seed: string | number): string {
  return `${PREFIX}${kind}:${id}:${seed}`;
}

/** The stored form of `value`, saved on `day` (by `who`, when known). */
export function stamp(value: unknown, day: string, who?: string): string {
  return JSON.stringify({ day, value, who } satisfies Stamped);
}

/**
 * The value saved on `day`, or undefined when the stored text is from another
 * day, unstamped (an older build), not parseable, or saved by the other child.
 */
export function unstamp(raw: string, day: string, who?: string): unknown {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return undefined;
    const o = parsed as Partial<Stamped>;
    // Both boys can share one phone. Sign-out clears every run, but a sign-in
    // after an expired cookie does not, so each run also names its child.
    if (who && o.who && o.who !== who) return undefined;
    return o.day === day && "value" in o ? o.value : undefined;
  } catch {
    return undefined;
  }
}

/** Who is signed in on this phone, from the readable label cookie. */
function signedIn(): string | undefined {
  if (typeof document === "undefined") return undefined;
  try {
    return learnerFromCookie(document.cookie) ?? undefined;
  } catch {
    return undefined;
  }
}

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

/**
 * Once per page load, drop the runs saved on an earlier day. Nothing else
 * would: a run left on a seed that never comes back is never read again.
 */
let swept = false;
function sweep(ls: Storage, day: string): void {
  if (swept) return;
  swept = true;
  try {
    const stale: string[] = [];
    for (let i = 0; i < ls.length; i++) {
      const k = ls.key(i);
      if (k?.startsWith(PREFIX) && unstamp(ls.getItem(k) ?? "", day) === undefined) stale.push(k);
    }
    for (const k of stale) ls.removeItem(k);
  } catch {
    // Blocked storage holds nothing old.
  }
}

export function loadProgress<T>(key: string, isValid: (v: unknown) => v is T): T | null {
  const ls = storage();
  if (!ls) return null;
  try {
    const day = todayKey();
    sweep(ls, day);
    const raw = ls.getItem(key);
    if (!raw) return null;
    const value = unstamp(raw, day, signedIn());
    if (value === undefined) {
      // Yesterday's lesson is not today's, and his brother's is not his: start fresh.
      ls.removeItem(key);
      return null;
    }
    return isValid(value) ? value : null;
  } catch {
    return null;
  }
}

export function saveProgress<T>(key: string, value: T): void {
  const ls = storage();
  if (!ls) return;
  try {
    ls.setItem(key, stamp(value, todayKey(), signedIn()));
  } catch {
    // Full or blocked: he just does not get a resume this time.
  }
}

/** Once a run is finished it must not resume; the next one is a fresh start. */
export function clearProgress(key: string): void {
  const ls = storage();
  if (!ls) return;
  try {
    ls.removeItem(key);
  } catch {
    // nothing to clear
  }
}

/** Drop every unfinished run on this device: a new child must not resume the last one's. */
export function clearAllProgress(): void {
  if (typeof window === "undefined") return;
  // sessionStorage too: builds before this one saved runs there.
  for (const pick of [() => window.localStorage, () => window.sessionStorage]) {
    try {
      const store = pick();
      if (!store) continue;
      const keys: string[] = [];
      for (let i = 0; i < store.length; i++) {
        const k = store.key(i);
        if (k?.startsWith(PREFIX)) keys.push(k);
      }
      for (const k of keys) store.removeItem(k);
    } catch {
      // Blocked storage holds nothing to clear.
    }
  }
}
