"use client";

import Icon from "@/components/ui/Icon";

/**
 * "There is a new Quest" — the bar he taps to take an update.
 *
 * The service worker no longer installs itself over a running page. It waits,
 * and this is what lets it in. Without it a deploy mid-session left a new
 * worker serving new build chunks to a tab still running the old JavaScript,
 * which shows up as buttons that do nothing rather than as an error.
 *
 * It sits ABOVE the bottom navigation rather than on top of it, and it can be
 * dismissed. The first cut covered the tab bar at z-60 with no way out, so a
 * deploy mid-lesson left him unable to reach Learn, Math or Drill, or even to
 * finish the question he was on — his only move was a reload that threw the
 * lesson away. An update is an offer, not a demand.
 *
 * Rendered by RegisterSW, which owns the worker lifecycle.
 */
export default function UpdateBar({
  onReload,
  onDismiss,
}: {
  onReload: () => void;
  onDismiss: () => void;
}) {
  return (
    <div
      className="fixed inset-x-0 z-30 mx-auto flex w-full max-w-app items-center gap-2 px-4"
      // Clear of BottomNav (fixed, bottom-0, z-40) and below FeedbackSheet
      // (z-50), so neither the tab bar nor a question is ever covered.
      style={{ bottom: "calc(76px + env(safe-area-inset-bottom))" }}
    >
      <button
        type="button"
        onClick={onReload}
        className="press-3d flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-full px-5 font-display text-[15px] font-bold uppercase tracking-wide"
        style={{
          background: "var(--color-blue)",
          color: "#fff",
          boxShadow: "0 4px 0 var(--color-blue-dark)",
        }}
      >
        New Quest ready — tap to load it
      </button>
      <button
        type="button"
        aria-label="Not now"
        onClick={onDismiss}
        className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full border-2"
        style={{
          background: "#fff",
          borderColor: "var(--color-line)",
          color: "var(--color-muted)",
        }}
      >
        <Icon name="x" size={22} />
      </button>
    </div>
  );
}

export { UpdateBar };
