"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import QuestionPad, { FLASH_MS, requeue } from "@/components/math/QuestionPad";
import FeedbackSheet, { type Feedback } from "@/components/ui/FeedbackSheet";
import LessonComplete from "@/components/ui/LessonComplete";
import Pill from "@/components/ui/Pill";
import RunnerHeader from "@/components/ui/RunnerHeader";
import { clock } from "@/components/ui/time";
import { buildSession, getSkill, gradeAnswer, type Level, type MathSkillId } from "@/lib/math";
import { postSession, saveNote } from "@/lib/offline-queue";
import { clearProgress, resumeKey, saveProgress } from "@/lib/resume";
import { useSavedRun } from "@/components/ui/useSavedRun";
import { startStopwatch, type Stopwatch } from "@/lib/time-on-task";
import { XP, type Gained } from "@/lib/rewards";
import { sfx } from "@/lib/sfx";
import type { SessionResult } from "@/lib/types";

const COUNT = 10;

export type MathSessionProps = {
  skillId: MathSkillId;
  level: Level;
  /** Question seed. The server makes one per visit; "Play again" makes a new one. */
  seed: number;
};

type Run = { seed: number; queue: number[] };
type Outcome = { gained: Gained | null; saved: boolean; note?: string; ms: number; correct: number };

function freshRun(seed: number): Run {
  return { seed, queue: Array.from({ length: COUNT }, (_, i) => i) };
}

/**
 * What a reload needs to put him back where he was. The seed is in here on
 * purpose: the page mints a new one on every request, so a reload would
 * otherwise rebuild a different set of questions under him. Resuming means
 * the same questions, in the saved order.
 */
type Saved = { seed: number; queue: number[]; firstTry: Record<number, boolean> };

function isSaved(v: unknown): v is Saved {
  if (typeof v !== "object" || v === null) return false;
  const o = v as { seed?: unknown; queue?: unknown; firstTry?: unknown };
  return (
    typeof o.seed === "number" &&
    Array.isArray(o.queue) &&
    o.queue.every((n) => typeof n === "number") &&
    typeof o.firstTry === "object" &&
    o.firstTry !== null
  );
}

/**
 * Reads any saved progress for this seed and mounts the session on it. The
 * key flips once the saved value arrives after hydration, so the inner
 * component remounts with it rather than setting state in an effect.
 */
export default function MathSession(props: MathSessionProps) {
  // Keyed on the skill and level, not the seed: the seed changes on reload.
  const key = resumeKey("math", props.skillId, props.level);
  const saved = useSavedRun(key, isSaved);
  return (
    <MathSessionInner key={saved ? "resumed" : "fresh"} {...props} saveKey={key} initial={saved} />
  );
}

function MathSessionInner({
  skillId,
  level,
  seed,
  saveKey,
  initial,
}: MathSessionProps & { saveKey: string; initial: Saved | null }) {
  const skill = getSkill(skillId);

  const [run, setRun] = useState<Run>(() =>
    initial ? { seed: initial.seed, queue: initial.queue } : freshRun(seed)
  );
  const [input, setInput] = useState("");
  const [flash, setFlash] = useState<"correct" | "wrong" | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const startRef = useRef(0);
  // Time on task, not time on the clock — see lib/time-on-task.ts.
  const watch = useRef<Stopwatch | null>(null);
  const postedRef = useRef(false);
  const firstTryRef = useRef<Record<number, boolean>>(initial ? { ...initial.firstTry } : {});
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    startRef.current = Date.now();
    watch.current = startStopwatch();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const questions = useMemo(
    () => buildSession({ skillId, level, seed: run.seed, count: COUNT }),
    [run.seed, skillId, level]
  );

  const queue = run.queue;
  const done = queue.length === 0;
  const question = questions[queue[0]];

  // Elapsed clock. Stops as soon as the queue is empty.
  useEffect(() => {
    if (done) return;
    const id = setInterval(() => setElapsed(watch.current?.read() ?? 0), 1000);
    return () => clearInterval(id);
  }, [done]);

  // Save the session, once, when the last question is answered.
  useEffect(() => {
    if (!done || postedRef.current) return;
    postedRef.current = true;
    clearProgress(saveKey);
    const ms = watch.current?.read() ?? 0;
    const correct = Object.values(firstTryRef.current).filter(Boolean).length;
    const result: SessionResult = {
      kind: "math",
      ref: `math:${skillId}`,
      answered: questions.length,
      correct,
      // No speed bonus outside the unit challenge and timed drills.
      fastCount: 0,
      ms,
      perfect: correct === questions.length,
      mathSkill: skillId,
    };
    void postSession(result).then((res) => {
      setOutcome({
        gained: res.saved ? res.gained : null,
        saved: res.saved,
        note: saveNote(res),
        ms,
        correct,
      });
    });
  }, [done, questions.length, skillId, saveKey]);

  const advance = useCallback(() => {
    watch.current?.mark();
    setInput("");
    setFlash(null);
    setRun((prev) => {
      const next = { ...prev, queue: prev.queue.slice(1) };
      // Where he is, so a reload lands him here and not on question one.
      saveProgress(saveKey, { seed: next.seed, queue: next.queue, firstTry: firstTryRef.current });
      return next;
    });
  }, [saveKey]);

  const check = useCallback(() => {
    if (!question || !input || flash || feedback) return;
    const index = queue[0];
    const { correct } = gradeAnswer(question, input);
    if (firstTryRef.current[index] === undefined) firstTryRef.current[index] = correct;

    if (correct) {
      sfx.correct();
      setFlash("correct");
      timerRef.current = setTimeout(advance, FLASH_MS);
      return;
    }
    setFlash("wrong");
    setShakeKey((k) => k + 1);
    setFeedback({
      state: "wrong",
      title: `The answer is ${question.answer}`,
      line: question.how,
    });
  }, [advance, feedback, flash, input, queue, question]);

  const afterWrong = useCallback(() => {
    watch.current?.mark();
    setFeedback(null);
    setInput("");
    setFlash(null);
    setRun((prev) => {
      const next = { ...prev, queue: requeue(prev.queue) };
      // A miss reorders the queue and marks a first try; a reload must keep both.
      saveProgress(saveKey, { seed: next.seed, queue: next.queue, firstTry: firstTryRef.current });
      return next;
    });
  }, [saveKey]);

  const playAgain = useCallback(() => {
    postedRef.current = false;
    firstTryRef.current = {};
    startRef.current = Date.now();
    watch.current = startStopwatch();
    setOutcome(null);
    setFeedback(null);
    setFlash(null);
    setInput("");
    setElapsed(0);
    setRun(freshRun(Date.now()));
  }, []);

  if (done) {
    if (!outcome) {
      return (
        <main className="flex min-h-dvh items-center justify-center px-6 text-center">
          <p className="font-display text-lg font-bold" style={{ color: "var(--color-muted)" }}>
            Saving your work...
          </p>
        </main>
      );
    }
    const total = questions.length;
    const offlineXp = outcome.correct * XP.correct + XP.lessonDone;
    return (
      <LessonComplete
        title={outcome.correct === total ? "All right!" : "Math done!"}
        subtitle={`${outcome.correct} of ${total} on the first try.`}
        xp={outcome.gained?.xp ?? offlineXp}
        ms={outcome.ms}
        accuracy={total > 0 ? outcome.correct / total : 0}
        perfect={outcome.correct === total}
        leveledUp={outcome.gained?.leveledUp ?? false}
        newBadge={outcome.gained?.newBadges[0] ?? null}
        primary={{ label: "All skills", href: "/math" }}
        secondary={{ label: "Play again", onClick: playAgain }}
        note={outcome.note}
      />
    );
  }

  const solved = questions.length - queue.length;

  return (
    <main className="flex min-h-dvh flex-col">
      <RunnerHeader
        href="/math"
        value={solved / questions.length}
        color="purple"
        label="Math progress"
        right={
          <Pill color="purple" variant="soft" icon="clock" size="sm">
            {clock(elapsed)}
          </Pill>
        }
      />

      <QuestionPad
        question={question}
        header={
          <p className="mb-2 font-display text-sm font-bold" style={{ color: "var(--color-purple)" }}>
            {skill.name}
          </p>
        }
        input={input}
        setInput={setInput}
        flash={flash}
        shakeKey={shakeKey}
        locked={feedback !== null}
        onCheck={check}
      />

      <FeedbackSheet feedback={feedback} onContinue={afterWrong} continueLabel="Got it" />
    </main>
  );
}

export { MathSession };
