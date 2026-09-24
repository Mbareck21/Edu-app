/**
 * Progress that survives a reload.
 *
 * He swipes down to scroll, the browser reads it as pull-to-refresh, and the
 * lesson he was six questions into starts again from the top. The refresh
 * itself is turned off in globals.css; this is the second line, for the
 * reloads that still happen — a browser back-swipe, a tab the phone dropped,
 * a tap on the address bar.
 *
 * sessionStorage, not localStorage: it lives exactly as long as the tab, so a
 * lesson resumes across a reload and is gone once he closes the app, which is
 * the right lifetime for "where was I". Every read and write is wrapped:
 * storage can be missing or throw in private windows and previews, and a
 * lesson must run either way.
 *
 * Pure apart from storage; no React here.
 */

const PREFIX = "quest:resume:";

/** One key per run. The seed makes "Again" a different run from the last. */
export function resumeKey(kind: string, id: string, seed: string | number): string {
  return `${PREFIX}${kind}:${id}:${seed}`;
}

export function loadProgress<T>(key: string, isValid: (v: unknown) => v is T): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isValid(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveProgress<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Full or blocked: he just does not get a resume this time.
  }
}

/** Once a run is finished it must not resume; the next one is a fresh start. */
export function clearProgress(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // nothing to clear
  }
}

/** Drop every unfinished run on this device: a new child must not resume the last one's. */
export function clearAllProgress(): void {
  if (typeof window === "undefined") return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.sessionStorage.length; i++) {
      const k = window.sessionStorage.key(i);
      if (k?.startsWith(PREFIX)) keys.push(k);
    }
    for (const k of keys) window.sessionStorage.removeItem(k);
  } catch {
    // Blocked storage holds nothing to clear.
  }
}
