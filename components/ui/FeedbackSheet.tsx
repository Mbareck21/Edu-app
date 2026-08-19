"use client";

import { useEffect } from "react";

import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import { tone } from "@/components/ui/colors";
import { sfx } from "@/lib/sfx";

/** Discriminated union — a sheet is either a win or a miss, never "maybe". */
export type Feedback =
  | { state: "correct"; title?: string; line?: string; xp?: number }
  | { state: "wrong"; title?: string; line?: string; answer?: string };

export type FeedbackSheetProps = {
  /** null hides the sheet. */
  feedback: Feedback | null;
  onContinue: () => void;
  continueLabel?: string;
  /** Set false when the caller already played a sound. */
  playSound?: boolean;
};

export default function FeedbackSheet({
  feedback,
  onContinue,
  continueLabel = "Continue",
  playSound = true,
}: FeedbackSheetProps) {
  const state = feedback?.state ?? null;

  useEffect(() => {
    if (!state || !playSound) return;
    if (state === "correct") sfx.correct();
    else sfx.wrong();
  }, [state, playSound]);

  if (!feedback) return null;

  const good = feedback.state === "correct";
  const t = tone(good ? "green" : "coral");
  const title = feedback.title ?? (good ? "Nice work!" : "Not this time");
  const line =
    feedback.line ??
    (good ? "" : feedback.state === "wrong" && feedback.answer ? `Answer: ${feedback.answer}` : "");

  return (
    <div
      className="q-sheet-up fixed bottom-0 left-1/2 z-50 w-full max-w-app -translate-x-1/2 rounded-t-hero px-4 pt-4"
      style={{
        background: t.soft,
        borderTop: `3px solid ${t.base}`,
        paddingBottom: "calc(16px + env(safe-area-inset-bottom))",
      }}
      role="status"
      aria-live="polite"
    >
      <div className="mb-3 flex items-start gap-3">
        <span
          className="q-pop flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
          style={{ background: t.base, color: t.on }}
        >
          <Icon name={good ? "check" : "x"} size={24} strokeWidth={3} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg font-bold" style={{ color: t.onSoft }}>
            {title}
          </p>
          {line ? (
            <p className="text-sm" style={{ color: "var(--color-ink)" }}>
              {line}
            </p>
          ) : null}
        </div>
        {good && feedback.xp ? (
          <span
            className="rounded-full px-3 py-1 font-display text-sm font-bold"
            style={{ background: "var(--color-gold-soft)", color: "var(--color-gold-ink)" }}
          >
            +{feedback.xp} XP
          </span>
        ) : null}
      </div>
      <Button
        color={good ? "green" : "coral"}
        size="lg"
        fullWidth
        autoFocus
        onClick={onContinue}
      >
        {continueLabel}
      </Button>
    </div>
  );
}

export { FeedbackSheet };
