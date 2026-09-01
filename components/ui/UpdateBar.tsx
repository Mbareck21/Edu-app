"use client";

/**
 * "There is a new Quest" — the bar he taps to take an update.
 *
 * The service worker no longer installs itself over a running page. It waits,
 * and this is what lets it in. Without it a deploy mid-session left a new
 * worker serving new build chunks to a tab still running the old JavaScript,
 * which shows up as buttons that do nothing rather than as an error.
 *
 * Rendered by RegisterSW, which owns the worker lifecycle.
 */
export default function UpdateBar({ onReload }: { onReload: () => void }) {
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[60] mx-auto w-full max-w-app px-4"
      style={{ paddingBottom: "calc(12px + env(safe-area-inset-bottom))" }}
    >
      <button
        type="button"
        onClick={onReload}
        className="press-3d flex min-h-[56px] w-full items-center justify-center gap-2 rounded-full px-5 font-display text-[15px] font-bold uppercase tracking-wide"
        style={{
          background: "var(--color-blue)",
          color: "#fff",
          boxShadow: "0 4px 0 var(--color-blue-dark)",
        }}
      >
        New Quest ready — tap to load it
      </button>
    </div>
  );
}

export { UpdateBar };
