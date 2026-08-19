"use client";

import { useRef, useState } from "react";

/**
 * The Arabic gloss, hidden behind a tap.
 *
 * Research rule from the plan: the gloss helps early and gets in the way
 * later. Once the flashcard interval passes a week the chip is not offered at
 * all — a long press still reveals it for the odd blank moment.
 */
export type ArabicChipProps = {
  arabic: string;
  /** true once srs.interval >= 7. */
  faded?: boolean;
  className?: string;
};

const LONG_PRESS_MS = 600;

export default function ArabicChip({ arabic, faded = false, className = "" }: ArabicChipProps) {
  const [shown, setShown] = useState(false);
  const timer = useRef<number | null>(null);

  if (!arabic.trim()) return null;

  function clear() {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }

  function startPress() {
    clear();
    timer.current = window.setTimeout(() => setShown(true), LONG_PRESS_MS);
  }

  if (shown) {
    return (
      <span
        className={`inline-flex min-h-[36px] items-center rounded-full px-3 py-1 font-body text-base ${className}`}
        style={{ background: "var(--color-sand)", color: "var(--color-ink)" }}
        dir="rtl"
        lang="ar"
      >
        {arabic}
      </span>
    );
  }

  if (faded) {
    // Not offered — but a long press still gets there.
    return (
      <span
        className={`inline-block h-[36px] w-14 ${className}`}
        onPointerDown={startPress}
        onPointerUp={clear}
        onPointerLeave={clear}
        aria-hidden="true"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setShown(true)}
      className={`press-3d inline-flex min-h-[36px] items-center rounded-full border-2 px-3 font-display text-xs font-bold uppercase tracking-wide ${className}`}
      style={{
        borderColor: "var(--color-line)",
        background: "#fff",
        color: "var(--color-muted)",
      }}
    >
      AR
    </button>
  );
}

export { ArabicChip };
