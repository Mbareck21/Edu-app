"use client";

import { useState, type Dispatch, type ReactNode, type SetStateAction } from "react";

import AudioButton from "@/components/items/AudioButton";
import VisualRenderer from "@/components/math/VisualRenderer";
import Card from "@/components/ui/Card";
import NumberPad from "@/components/ui/NumberPad";
import type { MathQuestion } from "@/lib/math/types";
import { speakable, termSegments, type MathTerm } from "@/lib/math/vocab";

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
      {/* The card fills the space above the keypad, and the picture in it
          grows or shrinks to what is left under the prompt, so the whole
          figure stays in view. The area still scrolls as a last resort on a
          very short screen, so the keypad and Check never leave it. */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pt-1 pb-2">
        {header}
        <Card className="flex flex-1 flex-col">
          {question ? (
            <>
              {/* A new question closes any open word: keyed on the prompt. */}
              <Prompt key={question.prompt} prompt={question.prompt} />
              <VisualRenderer visual={question.visual} op={question.op} />
            </>
          ) : (
            <p className="text-center" style={{ color: "var(--color-muted)" }}>
              Get ready…
            </p>
          )}
        </Card>
      </div>

      <div className="px-4" style={{ paddingBottom: "calc(12px + env(safe-area-inset-bottom))" }}>
        <NumberPad
          display={
            <div
              key={shakeKey}
              className={`flex h-14 items-center justify-center rounded-card border-2 font-display text-3xl font-bold ${
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
          }
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

/**
 * The question, with a speaker to hear it and its math words marked. For an
 * English learner a word problem is a reading test first; hearing it, and a
 * tap on "left over" or "each", keeps a missed word from becoming a wrong sum.
 */
function Prompt({ prompt }: { prompt: string }) {
  const [open, setOpen] = useState<MathTerm | null>(null);
  const segments = termSegments(prompt);
  // A long word problem in the big type runs to five or six lines on a phone
  // and pushes the picture off the card.
  const size = prompt.length > 40 ? "text-xl" : "text-2xl";
  return (
    <div className="shrink-0">
      <div className="flex items-start gap-3">
        <AudioButton text={speakable(prompt)} size={44} color="purple" label="Hear the question" />
        <p className={`min-w-0 flex-1 font-display ${size} leading-snug font-bold`}>
          {segments.map((s, i) =>
            s.term ? (
              <button
                key={i}
                type="button"
                onClick={() => setOpen((t) => (t === s.term ? null : (s.term ?? null)))}
                className="rounded font-display font-bold underline decoration-dotted decoration-2 underline-offset-4"
                style={{
                  color: "var(--color-purple-dark)",
                  background: open === s.term ? "var(--color-purple-soft)" : "transparent",
                }}
                aria-expanded={open === s.term}
              >
                {s.text}
              </button>
            ) : (
              <span key={i}>{s.text}</span>
            )
          )}
        </p>
      </div>
      {open ? (
        <div
          className="q-pop mt-3 flex items-center gap-3 rounded-tile px-3 py-2"
          style={{ background: "var(--color-purple-soft)" }}
          role="note"
        >
          <AudioButton text={open.term} size={40} color="purple" label={`Hear ${open.term}`} />
          <div className="min-w-0 flex-1">
            <p className="font-display text-base font-bold">{open.term}</p>
            <p className="text-sm leading-snug">{open.meaning}</p>
            <p className="mt-0.5 text-base font-bold" lang="ar" dir="rtl" style={{ color: "var(--color-purple-dark)" }}>
              {open.arabic}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export { QuestionPad };
