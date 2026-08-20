"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { mathDrillRef, timedSeconds, type MathMode } from "@/components/drill/options";
import QuestionPad, { FLASH_MS, requeue } from "@/components/math/QuestionPad";
import FeedbackSheet, { type Feedback } from "@/components/ui/FeedbackSheet";
import LessonComplete from "@/components/ui/LessonComplete";
import Pill from "@/components/ui/Pill";
import ProgressRing from "@/components/ui/ProgressRing";
import RunnerHeader from "@/components/ui/RunnerHeader";
import { clock } from "@/components/ui/time";
import { buildSession, gradeAnswer, mixedSession, type Level, type MathSkillId } from "@/lib/math";
import type { MathQuestion } from "@/lib/math/types";
import { postSession } from "@/lib/offline-queue";
import { XP, type Gained } from "@/lib/rewards";
import { sfx } from "@/lib/sfx";
import type { SessionResult } from "@/lib/types";

/** Under this many ms a right answer earns the speed bonus (timed only). */
const FAST_MS = 3000;
/** Questions drawn per timed batch. A fast round just draws another. */
const BATCH = 40;
const WRONG_MS = 1100;

export type MathDrillRunnerProps = {
  /** A skill id, or "mixed" for a bit of everything. */
  skill: MathSkillId | "mixed";
  skillName: string;
  level: Level;
  /** Relaxed only: how many questions. */
  count: number;
  mode: MathMode;
  seed: number;
  /** Drill URL without a seed — "Again" adds a fresh one. */
  againHref: string;
};

type Outcome = { gained: Gained | null; saved: boolean; ms: number; answered: number; correct: number };

function drawQuestions(
  skill: MathSkillId | "mixed",
  level: Level,
  seed: number,
  count: number
): MathQuestion[] {
  return skill === "mixed"
    ? mixedSession({ level, seed, count })
    : buildSession({ skillId: skill, level, seed, count });
}

/**
 * Math drill: a relaxed run of N questions, or as many as he can get in 60 or
 * 120 seconds. One session posts at the end either way.
 */
export default function MathDrillRunner({
  skill,
  skillName,
  level,
  count,
  mode,
  seed,
  againHref,
}: MathDrillRunnerProps) {
  const router = useRouter();
  const limit = timedSeconds(mode);
  const timed = limit !== null;

  const [batch, setBatch] = useState(0);
  const [at, setAt] = useState(0);
  const [queue, setQueue] = useState<number[]>(() =>
    timed ? [] : Array.from({ length: count }, (_, i) => i)
  );
  const [input, setInput] = useState("");
  const [flash, setFlash] = useState<"correct" | "wrong" | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [reveal, setReveal] = useState<number | null>(null);
  const [left, setLeft] = useState(limit ?? 0);
  const [tally, setTally] = useState({ answered: 0, correct: 0 });
  const [over, setOver] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const startedAt = useRef(0);
  const askedAt = useRef(0);
  const posted = useRef(false);
  const fastRef = useRef(0);
  const firstTry = useRef<Record<number, boolean>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Timed rounds draw a fresh batch whenever one runs out.
  const questions = useMemo(
    () => drawQuestions(skill, level, seed + batch * 7919, timed ? BATCH : count),
    [skill, level, seed, batch, timed, count]
  );
  const question = timed ? questions[at] : questions[queue[0]];
  const done = timed ? over : queue.length === 0;

  useEffect(() => {
    startedAt.current = Date.now();
    askedAt.current = Date.now();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  useEffect(() => {
    if (!timed || done) return;
    const id = setInterval(() => {
      const gone = Math.floor((Date.now() - startedAt.current) / 1000);
      const remaining = Math.max(0, (limit ?? 0) - gone);
      setLeft(remaining);
      if (remaining === 0) setOver(true);
    }, 250);
    return () => clearInterval(id);
  }, [timed, done, limit]);

  // Save once, when the run ends.
  useEffect(() => {
    if (!done || posted.current) return;
    posted.current = true;
    const ms = Date.now() - startedAt.current;
    const answered = timed
      ? tally.answered
      : Object.keys(firstTry.current).length || questions.length;
    const correct = timed
      ? tally.correct
      : Object.values(firstTry.current).filter(Boolean).length;
    const result: SessionResult = {
      kind: "math",
      ref: mathDrillRef(skill, mode, correct),
      answered,
      correct,
      // Speed bonus lives in timed drills only.
      fastCount: timed ? fastRef.current : 0,
      ms,
      perfect: answered > 0 && correct === answered,
      ...(skill === "mixed" ? {} : { mathSkill: skill }),
    };
    void postSession(result).then((res) => {
      setOutcome({
        gained: res.saved ? res.gained : null,
        saved: res.saved,
        ms,
        answered,
        correct,
      });
    });
  }, [done, timed, tally, questions.length, skill, mode]);

  const nextTimed = useCallback(() => {
    setInput("");
    setFlash(null);
    setReveal(null);
    askedAt.current = Date.now();
    if (at + 1 >= BATCH) {
      setBatch((b) => b + 1);
      setAt(0);
      return;
    }
    setAt(at + 1);
  }, [at]);

  const check = useCallback(() => {
    if (!question || !input || flash || feedback) return;
    const { correct } = gradeAnswer(question, input);
    const quick = Date.now() - askedAt.current < FAST_MS;

    if (timed) {
      setTally((t) => ({ answered: t.answered + 1, correct: t.correct + (correct ? 1 : 0) }));
      if (correct && quick) fastRef.current += 1;
      if (correct) {
        sfx.correct();
        setFlash("correct");
        timer.current = setTimeout(nextTimed, FLASH_MS);
        return;
      }
      sfx.wrong();
      setFlash("wrong");
      setShakeKey((k) => k + 1);
      setReveal(question.answer);
      timer.current = setTimeout(nextTimed, WRONG_MS);
      return;
    }

    const index = queue[0];
    if (firstTry.current[index] === undefined) firstTry.current[index] = correct;
    if (correct) {
      sfx.correct();
      setFlash("correct");
      timer.current = setTimeout(() => {
        setInput("");
        setFlash(null);
        askedAt.current = Date.now();
        setQueue((q) => q.slice(1));
      }, FLASH_MS);
      return;
    }
    setFlash("wrong");
    setShakeKey((k) => k + 1);
    setFeedback({ state: "wrong", title: `The answer is ${question.answer}`, line: question.how });
  }, [feedback, flash, input, nextTimed, queue, question, timed]);

  const afterWrong = useCallback(() => {
    setFeedback(null);
    setInput("");
    setFlash(null);
    askedAt.current = Date.now();
    setQueue(requeue);
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
    const offlineXp = outcome.correct * XP.correct + XP.lessonDone;
    return (
      <div className="safe-top safe-bottom min-h-dvh px-4">
        <LessonComplete
          title={timed ? "Time!" : outcome.correct === outcome.answered ? "All right!" : "Drill done!"}
          subtitle={
            timed
              ? `${outcome.correct} right in ${limit} seconds.`
              : `${outcome.correct} of ${outcome.answered} on the first try.`
          }
          xp={outcome.gained?.xp ?? offlineXp}
          ms={outcome.ms}
          accuracy={outcome.answered === 0 ? 0 : outcome.correct / outcome.answered}
          perfect={outcome.answered > 0 && outcome.correct === outcome.answered}
          leveledUp={outcome.gained?.leveledUp ?? false}
          newBadge={outcome.gained?.newBadges[0] ?? null}
          primary={{ label: "Again", onClick: () => router.push(`${againHref}&seed=${Date.now()}`) }}
          secondary={{ label: "All drills", href: "/drill" }}
          note={outcome.saved ? undefined : "No internet. Saved on this phone for later."}
        />
      </div>
    );
  }

  const progress = timed
    ? (limit === null ? 0 : 1 - left / limit)
    : (count - queue.length) / count;

  return (
    <main className="flex min-h-dvh flex-col">
      <RunnerHeader
        href="/drill"
        value={progress}
        color="purple"
        label="Drill progress"
        right={
          timed ? (
            <ProgressRing value={limit === null ? 0 : left / limit} size={46} stroke={5} color="purple">
              <span className="font-display text-xs font-bold">{clock(left * 1000)}</span>
            </ProgressRing>
          ) : (
            <Pill color="purple" variant="soft" size="sm">
              {count - queue.length}/{count}
            </Pill>
          )
        }
      />

      <QuestionPad
        question={question}
        header={
          <div className="mb-2 flex items-center justify-between">
            <p className="font-display text-sm font-bold" style={{ color: "var(--color-purple)" }}>
              {skillName} · Level {level}
            </p>
            {timed ? (
              <p className="font-display text-sm font-bold" style={{ color: "var(--color-green-dark)" }}>
                {tally.correct} right
              </p>
            ) : null}
          </div>
        }
        input={input}
        setInput={setInput}
        flash={flash}
        shakeKey={shakeKey}
        reveal={reveal}
        locked={feedback !== null}
        onCheck={check}
      />

      <FeedbackSheet feedback={feedback} onContinue={afterWrong} continueLabel="Got it" />
    </main>
  );
}

export { MathDrillRunner };
