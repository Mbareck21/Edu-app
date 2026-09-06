"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import QuestionPad, { FLASH_MS, requeue } from "@/components/math/QuestionPad";
import FeedbackSheet, { type Feedback } from "@/components/ui/FeedbackSheet";
import LessonComplete from "@/components/ui/LessonComplete";
import type { MathQuestion } from "@/lib/math";
import { postSession, saveNote } from "@/lib/offline-queue";
import { clearProgress, saveProgress } from "@/lib/resume";
import type { Gained } from "@/lib/rewards";
import { sessionPerfect } from "@/lib/session-score";
import { sfx } from "@/lib/sfx";
import { roundStars, type Fact, type FactState } from "@/lib/tables";
import { startStopwatch, type Stopwatch } from "@/lib/time-on-task";
import type { SessionResult } from "@/lib/types";

export type TablesRunnerProps = {
  /** The facts in this round, in the order to ask them. */
  facts: Fact[];
  /** "Table 7" or "Lightning": the finish title. */
  label: string;
  /** Activity ref for the posted session, e.g. "tables:7". Not a React ref. */
  sessionRef: string;
  /** Where a reload writes its progress. See lib/resume.ts. */
  saveKey: string;
  /** A round he was in the middle of when the page reloaded. */
  initial: TablesSaved | null;
  onDone?: () => void;
};

/**
 * Everything a reload needs to put him back in the round: the round itself,
 * because the board builds it on the client and would otherwise deal a new
 * one, and where he was in it.
 */
export type TablesSaved = {
  facts: Fact[];
  label: string;
  sessionRef: string;
  queue: number[];
  firstTry: Record<number, boolean>;
};

export function isTablesSaved(v: unknown): v is TablesSaved {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Partial<TablesSaved>;
  return (
    Array.isArray(o.facts) &&
    o.facts.every((f) => typeof f?.a === "number" && typeof f?.b === "number" && typeof f?.key === "string") &&
    typeof o.label === "string" &&
    typeof o.sessionRef === "string" &&
    Array.isArray(o.queue) &&
    o.queue.every((n) => typeof n === "number") &&
    typeof o.firstTry === "object" &&
    o.firstTry !== null
  );
}

type Outcome = {
  gained: Gained | null;
  saved: boolean;
  note?: string;
  ms: number;
  correct: number;
  stars: 0 | 1 | 2 | 3;
};

function toQuestion(f: Fact): MathQuestion {
  return {
    prompt: `${f.a} × ${f.b} = ?`,
    answer: f.a * f.b,
    visual: { kind: "none" },
    how: `${f.a} × ${f.b} = ${f.a * f.b} (${f.a} groups of ${f.b})`,
    op: "×",
    a: f.a,
    b: f.b,
  };
}

/**
 * One round of ten facts on the number pad. A missed fact comes back later
 * in the same round, so nothing is left as a wrong answer. Every answer goes
 * to the server, which grades it and moves the grid.
 */
export default function TablesRunner({
  facts,
  label,
  sessionRef,
  saveKey,
  initial,
  onDone,
}: TablesRunnerProps) {
  const questions = useMemo(() => facts.map(toQuestion), [facts]);
  const [queue, setQueue] = useState<number[]>(() => initial?.queue ?? facts.map((_, i) => i));
  const [input, setInput] = useState("");
  const [flash, setFlash] = useState<"correct" | "wrong" | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [states, setStates] = useState<Record<string, FactState>>({});

  const watch = useRef<Stopwatch | null>(null);
  const askedAt = useRef<number>(0);
  const firstTry = useRef<Record<number, boolean>>(initial?.firstTry ?? {});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const posted = useRef(false);

  useEffect(() => {
    watch.current = startStopwatch();
    askedAt.current = Date.now();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const done = queue.length === 0;

  // Where he is, for a reload. The queue changes on every answer, right or
  // wrong, so this runs after each one; cleared once the round is done.
  useEffect(() => {
    if (done) clearProgress(saveKey);
    else saveProgress(saveKey, { facts, label, sessionRef, queue, firstTry: firstTry.current });
  }, [done, facts, label, queue, saveKey, sessionRef]);

  const index = queue[0];
  const question = done ? undefined : questions[index];
  const fact = done ? undefined : facts[index];

  // Save once, when the last fact is answered.
  useEffect(() => {
    if (!done || posted.current) return;
    posted.current = true;
    const ms = watch.current?.read() ?? 0;
    const correct = Object.values(firstTry.current).filter(Boolean).length;
    const answered = facts.length;
    const result: SessionResult = {
      kind: "math",
      ref: sessionRef,
      answered,
      correct,
      fastCount: 0,
      ms,
      perfect: sessionPerfect({ answered, correct }),
    };
    void postSession(result).then((res) => {
      setOutcome({
        gained: res.saved ? res.gained : null,
        saved: res.saved,
        note: saveNote(res),
        ms,
        correct,
        stars: roundStars(correct, answered, ms),
      });
    });
  }, [done, facts.length, sessionRef]);

  const advance = useCallback(() => {
    watch.current?.mark();
    setInput("");
    setFlash(null);
    setQueue((q) => q.slice(1));
    askedAt.current = Date.now();
  }, []);

  const check = useCallback(() => {
    if (!question || !fact || !input || flash || feedback) return;
    const clean = input.trim();
    const correct = /^\d+$/.test(clean) && Number(clean) === question.answer;
    const ms = Math.max(0, Date.now() - askedAt.current);
    if (firstTry.current[index] === undefined) firstTry.current[index] = correct;

    // The server grades and moves the grid. Fire and forget: the screen has
    // already decided from the same rule, and a lost post costs one answer
    // of progress, never a wrong mark.
    void fetch("/api/tables/answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ a: fact.a, b: fact.b, typed: clean, ms }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.state) setStates((s) => ({ ...s, [fact.key]: data.state }));
      })
      .catch(() => null);

    if (correct) {
      sfx.correct();
      setFlash("correct");
      timer.current = setTimeout(advance, FLASH_MS);
      return;
    }
    sfx.wrong();
    setFlash("wrong");
    setShakeKey((k) => k + 1);
    setFeedback({ state: "wrong", title: `${fact.a} × ${fact.b} = ${question.answer}`, line: question.how });
  }, [advance, fact, feedback, flash, index, input, question]);

  const afterWrong = useCallback(() => {
    watch.current?.mark();
    setFeedback(null);
    setInput("");
    setFlash(null);
    // Back a few places, so it comes round again before the round ends.
    setQueue((q) => requeue(q));
    askedAt.current = Date.now();
  }, []);

  if (done) {
    if (!outcome) {
      return (
        <main className="flex min-h-dvh items-center justify-center px-6 text-center">
          <p className="font-display text-lg font-bold" style={{ color: "var(--color-muted)" }}>
            Saving your work…
          </p>
        </main>
      );
    }
    const starLine = ["No stars yet — every one right earns the first.", "One star.", "Two stars.", "Three stars!"][outcome.stars];
    return (
      <div className="safe-top safe-bottom min-h-dvh px-4">
        <LessonComplete
          title={outcome.stars === 3 ? "Lightning fast!" : outcome.stars > 0 ? `${label} done!` : "Round done."}
          subtitle={`${outcome.correct} of ${facts.length} on the first try. ${starLine}`}
          xp={outcome.gained?.xp ?? 0}
          ms={outcome.ms}
          accuracy={facts.length === 0 ? 0 : outcome.correct / facts.length}
          perfect={outcome.stars > 0}
          leveledUp={outcome.gained?.leveledUp ?? false}
          newBadge={outcome.gained?.newBadges[0] ?? null}
          primary={onDone ? { label: "Back to the grid", onClick: onDone } : { label: "Back to the grid", href: "/math/tables" }}
          note={outcome.note}
        />
      </div>
    );
  }

  const answeredSoFar = facts.length - queue.length;
  const known = Object.values(states).filter((s) => s.streak >= 3).length;

  return (
    <div className="safe-top min-h-dvh px-4 pb-8">
      <QuestionPad
        question={question}
        header={
          <div className="flex items-center justify-between text-sm">
            <span className="font-display font-bold">{label}</span>
            <span style={{ color: "var(--color-muted)" }}>
              {answeredSoFar} of {facts.length}
              {known > 0 ? ` · ${known} lit` : ""}
            </span>
          </div>
        }
        input={input}
        setInput={setInput}
        flash={flash}
        shakeKey={shakeKey}
        locked={feedback !== null}
        onCheck={check}
      />
      <FeedbackSheet feedback={feedback} onContinue={afterWrong} continueLabel="Got it" />
    </div>
  );
}

export { TablesRunner };
