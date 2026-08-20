"use client";

import type { Dispatch, ReactNode, SetStateAction } from "react";

import VisualRenderer from "@/components/math/VisualRenderer";
import Card from "@/components/ui/Card";
import NumberPad from "@/components/ui/NumberPad";
import type { MathQuestion } from "@/lib/math/types";

/** How long the answer box flashes green before the next question. */
export const FLASH_MS = 520;
/** How many other questions come before a missed one comes back. */
export const REQUEUE_AFTER = 2;
/** Longest answer the box takes. */
const MAX_DIGITS = 7;

/** Sends the question at the head of the queue back a few places. */
export function requeue(queue: number[]): number[] {
  const [head, ...rest] = queue;
  const at = Math.min(REQUEUE_AFTER, rest.length);
  return [...rest.slice(0, at), head, ...rest.slice(at)];
}

export type QuestionPadProps = {
  question: MathQuestion | undefined;
  /** Line above the question card — skill name, level, live score. */
  header?: ReactNode;
  input: string;
  setInput: Dispatch<SetStateAction<string>>;
  flash: "correct" | "wrong" | null;
  /** Bumped on a wrong answer so the shake replays. */
  shakeKey: number;
  /** Shown instead of the input when a timed round gives the answer away. */
  reveal?: number | null;
  /** A feedback sheet is up — the pad waits. */
  locked?: boolean;
  onCheck: () => void;
};

/**
 * The question card, the answer box and the number pad: everything a math run
 * shows between its header and its feedback sheet.
 */
export default function QuestionPad({
  question,
  header,
  input,
  setInput,
  flash,
  shakeKey,
  reveal = null,
  locked = false,
  onCheck,
}: QuestionPadProps) {
  return (
    <>
      <div className="flex-1 overflow-y-auto px-4 pt-2 pb-3">
        {header}
        <Card className="min-h-[180px]">
          {question ? (
            <>
              <p className="text-center font-display text-2xl leading-snug font-bold">
                {question.prompt}
              </p>
              <VisualRenderer visual={question.visual} op={question.op} />
            </>
          ) : (
            <p className="text-center" style={{ color: "var(--color-muted)" }}>
              Get ready…
            </p>
          )}
        </Card>
      </div>

      <div className="px-4 pb-4" style={{ paddingBottom: "calc(16px + env(safe-area-inset-bottom))" }}>
        <div
          key={shakeKey}
          className={`mb-3 flex h-16 items-center justify-center rounded-card border-2 font-display text-3xl font-bold ${
            flash === "wrong" ? "q-shake" : ""
          }`}
          style={{
            background:
              flash === "correct"
                ? "var(--color-green-soft)"
                : flash === "wrong"
                  ? "var(--color-coral-soft)"
                  : "#fff",
            borderColor:
              flash === "correct"
                ? "var(--color-green)"
                : flash === "wrong"
                  ? "var(--color-coral)"
                  : "var(--color-purple)",
            color:
              flash === "correct"
                ? "var(--color-green-dark)"
                : flash === "wrong"
                  ? "var(--color-coral-dark)"
                  : "var(--color-ink)",
          }}
          aria-live="polite"
          aria-label="Your answer"
        >
          {reveal !== null ? reveal : input || <span style={{ color: "var(--color-faint)" }}>?</span>}
        </div>

        <NumberPad
          onInput={(d) => setInput((v) => (v.length >= MAX_DIGITS ? v : v === "0" ? d : v + d))}
          onBackspace={() => setInput((v) => v.slice(0, -1))}
          onCheck={onCheck}
          color="purple"
          checkDisabled={input.length === 0}
          disabled={!question || flash !== null || locked}
        />
      </div>
    </>
  );
}

export { QuestionPad };
