"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";

import { loadProgress } from "@/lib/resume";

/**
 * The saved progress for one run, read once per mount, in a way React can
 * hydrate.
 *
 * The server renders every lesson fresh, and the first client render has to
 * match it or React tears the page down. So the hydrating render sees nothing,
 * the very next render sees what was saved, and the runner remounts itself on
 * that change (see how each runner keys its inner component). No state is set
 * inside an effect, which this codebase forbids.
 *
 * One read per mount, not per page load. This used to be one cached read per
 * key for the life of the tab, so a lesson that resumed after a reload and
 * was then finished came back from the cache the next time he opened it
 * without a reload — old answers and all, posted a second time. A new mount
 * now reads storage, which the finished run has already cleared.
 */
const primed = new Map<string, unknown>();

function subscribe(): () => void {
  // Storage never changes behind a running lesson; there is nothing to watch.
  return () => {};
}

export function useSavedRun<T>(key: string, isValid: (v: unknown) => v is T): T | null {
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => {
      // The hydrating render must show nothing to match the server, but the
      // storage is read NOW. Effects run child-first, and a runner that saves
      // on mount would otherwise overwrite the progress before the next
      // render got to look at it.
      if (typeof window !== "undefined" && !primed.has(key)) {
        primed.set(key, loadProgress(key, isValid));
      }
      return false;
    }
  );
  const saved = useMemo(() => {
    if (!hydrated) return null;
    const v = primed.has(key) ? primed.get(key) : loadProgress(key, isValid);
    return isValid(v) ? v : null;
  }, [hydrated, key, isValid]);
  // The primed read belongs to this page load's first mount only.
  useEffect(() => {
    if (hydrated) primed.delete(key);
  }, [hydrated, key]);
  return saved;
}
