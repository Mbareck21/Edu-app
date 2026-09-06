"use client";

import { useSyncExternalStore } from "react";

import { loadProgress } from "@/lib/resume";

/**
 * The saved progress for one run, read once, in a way React can hydrate.
 *
 * The server renders every lesson fresh, and the first client render has to
 * match it or React tears the page down. So this reads storage through
 * useSyncExternalStore with a server snapshot of null: the hydrating render
 * sees nothing, the very next render sees what was saved, and the runner
 * remounts itself on that change (see how each runner keys its inner
 * component). No state is set inside an effect, which this codebase forbids.
 *
 * One read per key. The snapshot must be a stable reference or React would
 * loop, so it is cached; a run is resumed from what storage held when the
 * page opened, never from a value that changes underneath it.
 */
const cache = new Map<string, unknown>();

function subscribe(): () => void {
  // Storage never changes behind a running lesson; there is nothing to watch.
  return () => {};
}

export function useSavedRun<T>(key: string, isValid: (v: unknown) => v is T): T | null {
  return useSyncExternalStore(
    subscribe,
    () => {
      if (!cache.has(key)) cache.set(key, loadProgress(key, isValid));
      const v = cache.get(key);
      return isValid(v) ? v : null;
    },
    () => null
  );
}

/** Drop the cached read, so a new run under the same key starts clean. */
export function forgetSavedRun(key: string): void {
  cache.delete(key);
}
