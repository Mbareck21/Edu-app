"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import QuestionPad, { FLASH_MS, requeue } from "@/components/math/QuestionPad";
import FeedbackSheet, { type Feedback } from "@/components/ui/FeedbackSheet";
import LessonComplete from "@/components/ui/LessonComplete";
import Pill from "@/components/ui/Pill";
import RunnerHeader from "@/components/ui/RunnerHeader";
import { clock } from "@/components/ui/time";
import { buildSession, getSkill, gradeAnswer, type Level, type MathSkillId } from "@/lib/math";
import { postSession } from "@/lib/offline-queue";
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
type Outcome = { gained: Gained | null; saved: boolean; ms: number; correct: number };

function freshRun(seed: number): Run {
  return { seed, queue: Array.from({ length: COUNT }, (_, i) => i) };
}

export default function MathSession({ skillId, level, seed }: MathSessionProps) {
  const skill = getSkill(skillId);

  const [run, setRun] = useState<Run>(() => freshRun(seed));
  const [input, setInput] = useState("");
  const [flash, setFlash] = useState<"correct" | "wrong" | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const startRef = useRef(0);
  const postedRef = useRef(false);
  const firstTryRef = useRef<Record<number, boolean>>({});
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    startRef.current = Date.now();
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
    const id = setInterval(() => setElapsed(Date.now() - startRef.current), 1000);
    return () => clearInterval(id);
  }, [done]);

  // Save the session, once, when the last question is answered.
  useEffect(() => {
    if (!done || postedRef.current) return;
    postedRef.current = true;
    const ms = Date.now() - startRef.current;
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
      setOutcome({ gained: res.saved ? res.gained : null, saved: res.saved, ms, correct });
    });
  }, [done, questions.length, skillId]);

  const advance = useCallback(() => {
    setInput("");
    setFlash(null);
    setRun((prev) => ({ ...prev, queue: prev.queue.slice(1) }));
  }, []);

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
    setFeedback(null);
    setInput("");
    setFlash(null);
    setRun((prev) => ({ ...prev, queue: requeue(prev.queue) }));
  }, []);

  const playAgain = useCallback(() => {
    postedRef.current = false;
    firstTryRef.current = {};
    startRef.current = Date.now();
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
        note={outcome.saved ? undefined : "No internet. It will be saved later."}
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
