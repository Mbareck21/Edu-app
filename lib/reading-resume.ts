/**
 * Getting him back to the passage he left.
 *
 * Two things sent him back to the start. "Read after the robot" kept its
 * place in the passage only in memory, so leaving for Home and coming back
 * opened the passage on sentence 1 again. And the Reading beat on Home points
 * at the unit's list, which is not always the list whose passage he was
 * reading (a passage borrowed from another list, or a list that has since
 * changed): that opened a different page with nothing to resume.
 *
 * So the echo reader's place is saved with the rest of the reading, and the
 * reading page he is partway through is remembered for the day, for Home to
 * send him back to. Same storage and lifetime as lib/resume.ts.
 *
 * Pure apart from storage; no React here.
 */

import { clearProgress, loadProgress, resumeKey, saveProgress } from "@/lib/resume";

/** The two ways to read a passage. */
export type ReadingMode = "echo" | "alone";

/**
 * A saved mode, or null when it is not one. "listen" and "aloud" were
 * dropped; both put the whole passage on screen, as "echo" does, so a
 * reading saved in either carries on as "echo".
 */
export function readingMode(v: unknown): ReadingMode | null {
  if (v === "echo" || v === "alone") return v;
  if (v === "listen" || v === "aloud") return "echo";
  return null;
}

/** "Read after the robot": the sentence he is on, and the tally so far. */
export type EchoProgress = { idx: number; passed: number; pctSum: number; pctCount: number };

export function isEchoProgress(v: unknown): v is EchoProgress {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return (["idx", "passed", "pctSum", "pctCount"] as const).every(
    (k) => typeof o[k] === "number" && Number.isFinite(o[k]) && (o[k] as number) >= 0
  );
}

/** The reading page he is partway through, and the day he was on it. */
export type OpenReading = { href: string; day: string };

const OPEN_KEY = resumeKey("reading-open", "any", 1);

function isOpenReading(v: unknown): v is OpenReading {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Partial<OpenReading>;
  return (
    typeof o.day === "string" &&
    typeof o.href === "string" &&
    // Only ever a reading page of this app.
    /^\/learn\/[^/?#]+\/read(\?|$)/.test(o.href)
  );
}

/** Where the Reading beat goes: the reading he left today, else `fallback`. */
export function continueHref(open: unknown, today: string, fallback: string): string {
  return isOpenReading(open) && open.day === today ? open.href : fallback;
}

export function openReading(): OpenReading | null {
  return loadProgress(OPEN_KEY, isOpenReading);
}

export function rememberOpenReading(href: string, day: string): void {
  saveProgress(OPEN_KEY, { href, day });
}

/** Only when it is this page: a finished passage must not forget another. */
export function forgetOpenReading(href: string): void {
  if (openReading()?.href === href) clearProgress(OPEN_KEY);
}
