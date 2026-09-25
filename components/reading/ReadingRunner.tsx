"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useSavedRun } from "@/components/ui/useSavedRun";
import { clearProgress, resumeKey, saveProgress } from "@/lib/resume";
import Link from "next/link";

import Button, { buttonClass, buttonStyle } from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import FeedbackSheet, { type Feedback } from "@/components/ui/FeedbackSheet";
import Icon from "@/components/ui/Icon";
import LessonComplete from "@/components/ui/LessonComplete";
import Pill from "@/components/ui/Pill";
import ProgressBar from "@/components/ui/ProgressBar";
import ArabicChip from "@/components/items/ArabicChip";
import AudioButton from "@/components/items/AudioButton";
import EchoReader, { type EchoSummary } from "@/components/reading/EchoReader";
import Passage from "@/components/reading/Passage";
import { judgeAnswer } from "@/lib/answer-check";
import { todayKey } from "@/lib/day";
import { gradeOn } from "@/lib/grade";
import { postReadingDone, postSession, saveNote } from "@/lib/offline-queue";
import { scrollIntoViewIfNeeded } from "@/lib/scroll-into-view";
import { startStopwatch, type Stopwatch } from "@/lib/time-on-task";
import {
  GRADE4_LEXILE,
  atGradeLevel,
  countWords,
  lexileForLevel,
  partPlan,
  splitParts,
  withNames,
  type Scaffold,
  wordsFirst,
} from "@/lib/reading";
import {
  forgetOpenReading,
  isEchoProgress,
  readingMode,
  rememberOpenReading,
  type EchoProgress,
  type ReadingMode,
} from "@/lib/reading-resume";
import { readingProgress } from "@/lib/rewards";
import { sfx } from "@/lib/sfx";
import type {
  ClientWordList,
  CurrentReading,
  ReadingQuestion,
  VocabGloss,
} from "@/lib/models/WordList";

export type ReadingRunnerProps = {
  list: ClientWordList;
  /** How much help finding the answer he still gets. See scaffoldFor(). */
  scaffold?: Scaffold;
  /**
   * True when list.currentReading was written on an earlier day. The Read step
   * used to reopen whatever passage was last saved, however old, so a list he
   * had read a week ago handed him the same story again with no way to refuse
   * it. Decided on the server — see app/learn/[listId]/[step]/page.tsx.
   */
  stale?: boolean;
  /**
   * A passage sitting on another list, for when this one cannot serve any.
   * The home page's Reading beat always points at the most recently touched
   * list; that list having nothing saved is not a reason for him to have
   * nothing to read at all.
   */
  spare?: { listId: string; title: string; href: string } | null;
  /** Called from the finish screen's main button. Falls back to a link home. */
  onDone?: () => void;
};

type Phase = "words" | "mode" | "read" | "questions" | "done";

const HINTS_BEFORE_REVEAL = 2;

type QState = { wrong: number; hints: number; revealed: boolean; done: boolean };

function freshQ(n: number): QState[] {
  return Array.from({ length: n }, () => ({
    wrong: 0,
    hints: 0,
    revealed: false,
    done: false,
  }));
}

/**
 * Where he was in a passage, for a reload. The passage itself is on the
 * server (the list's currentReading), so only the position is kept, and it
 * is only used when the passage on the server is still the one it was saved
 * against — `at` is that passage's generatedAt.
 */
type ReadingSaved = {
  at: string;
  phase: Phase;
  /** A ReadingMode, or one of the two dropped ones: see readingMode(). */
  mode: string;
  qStates: QState[];
  qIdx: number;
  /** Time on task banked before a reload. */
  ms?: number;
  /** Part by part: the furthest part he had on screen. */
  seen?: number;
  /** Read after the robot: the sentence he was on. */
  echoAt?: EchoProgress;
  /** Read after the robot, once done: for the finish screen. */
  echo?: EchoSummary;
};

function isReadingSaved(v: unknown): v is ReadingSaved {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Partial<ReadingSaved>;
  return (
    typeof o.at === "string" &&
    (o.phase === "words" ||
      o.phase === "mode" ||
      o.phase === "read" ||
      o.phase === "questions" ||
      o.phase === "done") &&
    readingMode(o.mode) !== null &&
    Array.isArray(o.qStates) &&
    o.qStates.every((q) => typeof q === "object" && q !== null && typeof q.done === "boolean") &&
    typeof o.qIdx === "number" &&
    (o.ms === undefined || typeof o.ms === "number") &&
    (o.seen === undefined || typeof o.seen === "number") &&
    (o.echoAt === undefined || isEchoProgress(o.echoAt)) &&
    (o.echo === undefined || (typeof o.echo === "object" && o.echo !== null))
  );
}

/**
 * The question a resumed passage opens on. A right answer marks its question
 * done at once, but the Continue sheet after it is not saved, so a reload in
 * between came back to a locked question with no button: stuck on every visit.
 * Skip past answered questions instead.
 */
/** A passage opens on its words when it has any to teach. */
function startPhase(reading: CurrentReading | null): Phase {
  return reading && reading.vocabGlosses.length > 0 ? "words" : "mode";
}

function resumeQuestion(qStates: readonly QState[], qIdx: number): number {
  let i = Math.max(0, qIdx);
  while (i < qStates.length && qStates[i].done) i++;
  return i;
}

export default function ReadingRunner(props: ReadingRunnerProps) {
  // "parts": questions are asked in the order of the parts they belong to, so
  // a position saved against the old order must not be resumed.
  const key = resumeKey("reading", props.list._id, "parts");
  const saved = useSavedRun(key, isReadingSaved);
  const current = props.stale ? null : props.list.currentReading;
  const initial = saved && current && saved.at === current.generatedAt ? saved : null;
  return (
    <ReadingRunnerInner
      key={initial ? "resumed" : "fresh"}
      {...props}
      saveKey={key}
      initial={initial}
    />
  );
}

function ReadingRunnerInner({
  list,
  scaffold = "none",
  stale = false,
  spare = null,
  onDone,
  saveKey,
  initial,
}: ReadingRunnerProps & { saveKey: string; initial: ReadingSaved | null }) {
  const [reading, setReading] = useState<CurrentReading | null>(
    stale ? null : list.currentReading
  );
  // The passage being held back for being old. Kept, not discarded: when a new
  // one cannot be written — the writing service is down, or the day's budget
  // is spent — an old story is far better than an empty screen. Hiding it was
  // only ever meant to stop it being served as today's.
  const shelved = stale ? list.currentReading : null;
  // The passage in parts of about three sentences, and each question moved
  // to just after the part its answer is in (see partPlan).
  const parts = useMemo(() => (reading ? splitParts(reading.paragraph) : []), [reading]);
  const plan = useMemo(
    () => partPlan(parts, reading?.questions ?? []),
    [parts, reading]
  );
  const questions: ReadingQuestion[] = useMemo(
    () => plan.order.map((i) => reading?.questions[i]).filter((q): q is ReadingQuestion => !!q),
    [plan, reading]
  );
  const partOfQ = useMemo(() => plan.order.map((i) => plan.partOf[i]), [plan]);
  const resumedQStates =
    initial && initial.qStates.length === questions.length ? initial.qStates : null;
  const resumedIdx = initial && resumedQStates ? resumeQuestion(resumedQStates, initial.qIdx) : 0;
  // Every question answered before the reload: all that was left was Continue.
  const resumedAllDone =
    initial?.phase === "questions" && questions.length > 0 && resumedIdx >= questions.length;
  // A finished passage never resumes as finished; he picks a mode again.
  const [phase, setPhase] = useState<Phase>(
    resumedAllDone
      ? "done"
      : initial && initial.phase !== "done"
        ? initial.phase
        : startPhase(stale ? null : list.currentReading)
  );
  const [mode, setMode] = useState<ReadingMode>(readingMode(initial?.mode) ?? "echo");
  const [busy, setBusy] = useState<null | "generating" | "saving">(null);
  const [error, setError] = useState<string | null>(null);

  const [qStates, setQStates] = useState<QState[]>(
    () => resumedQStates ?? freshQ(questions.length)
  );
  const [qIdx, setQIdx] = useState(Math.min(resumedIdx, Math.max(0, questions.length - 1)));
  // Part by part ("Read alone"): the furthest part on screen.
  const [seenPart, setSeenPart] = useState(() => initial?.seen ?? 0);
  // Echo mode ("read after the robot") — kept for the finish screen's subtitle.
  const [echo, setEcho] = useState<EchoSummary | null>(initial?.echo ?? null);
  // Echo mode: the sentence he is on, so leaving and coming back carries on.
  const [echoAt, setEchoAt] = useState<EchoProgress | null>(initial?.echoAt ?? null);

  // Time on task, not time on the clock. His longest logged reading was 2.5
  // hours of an open tab — see lib/time-on-task.ts.
  const watch = useRef<Stopwatch | null>(null);
  // A resumed passage picks its clock up where the reload left it; a fresh
  // one starts it when he picks a mode. Before the save below, which reads it.
  const bankedMs = initial && initial.phase !== "mode" ? (initial.ms ?? 0) : null;
  useEffect(() => {
    if (bankedMs !== null) watch.current = startStopwatch(Date.now, bankedMs);
  }, [bankedMs]);

  // Where he is, for a reload. Runs on every change of position; cleared
  // when the passage is done so the next one starts clean.
  useEffect(() => {
    if (!reading || phase === "done") {
      clearProgress(saveKey);
      return;
    }
    saveProgress(saveKey, {
      at: reading.generatedAt,
      phase,
      mode,
      qStates,
      qIdx,
      ms: watch.current?.read() ?? 0,
      seen: seenPart,
      ...(echoAt ? { echoAt } : {}),
      ...(echo ? { echo } : {}),
    });
  }, [reading, phase, mode, qStates, qIdx, seenPart, echoAt, echo, saveKey]);

  // This page, for Home's Reading beat to come back to while it is unfinished.
  // Its list may not be the one Home would pick. See lib/reading-resume.ts.
  const unfinished = reading !== null && phase !== "done";
  useEffect(() => {
    const here = window.location.pathname + window.location.search;
    if (unfinished) rememberOpenReading(here, todayKey());
    else forgetOpenReading(here);
  }, [unfinished]);
  const [typed, setTyped] = useState("");
  const [picked, setPicked] = useState<number | null>(null);
  /**
   * Answers already marked wrong on this question. Tapping Check again on the
   * same words, or the same option twice, used to count as another miss, and
   * the third one gave the answer away before he had changed anything.
   */
  const [tried, setTried] = useState<string[]>([]);
  const [shake, setShake] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  // The question card. On a long passage it renders below two screens of text
  // he has just read, and nothing moved the page — so "Answer the questions"
  // appeared to do nothing at all.
  const questionRef = useRef<HTMLDivElement | null>(null);

  const [gloss, setGloss] = useState<VocabGloss | null>(null);
  const [showArabic, setShowArabic] = useState(false);

  // 0 until the kid picks a reading mode; the finish screen reads it back.
  const startedAtRef = useRef(0);
  const savedRef = useRef(false);
  const [gainedXp, setGainedXp] = useState(0);
  const [queuedNote, setQueuedNote] = useState<string | undefined>(undefined);
  /** Where this reading left him on the ladder, for the finish screen. */
  const [ladderNote, setLadderNote] = useState<string | undefined>(undefined);
  const [elapsedMs, setElapsedMs] = useState(resumedAllDone ? (initial?.ms ?? 0) : 0);

  const wordsCount = reading ? countWords(reading.paragraph) : 0;
  const level = reading?.level ?? list.readingLevel ?? 1;
  const lexile = lexileForLevel(level);
  const atGrade = atGradeLevel(level);
  const grade = gradeOn(todayKey());

  // ── Generating ──────────────────────────────────────────────────────────

  /**
   * Put a passage on screen and clear everything the last one left behind.
   * Both paths that install a reading go through here — they had drifted, and
   * the fallback one was forgetting to reset the echo summary and the timer.
   */
  const installReading = useCallback((next: CurrentReading | null) => {
    setReading(next);
    setPhase(startPhase(next));
    setSeenPart(0);
    setEcho(null);
    setEchoAt(null);
    setQStates(freshQ(next?.questions.length ?? 0));
    setQIdx(0);
    setTried([]);
    savedRef.current = false;
    // The clock starts when he does, not while a passage is being written —
    // generation runs 30s and up, and it used to land on his time on task.
    startedAtRef.current = Date.now();
    watch.current = startStopwatch();
  }, []);

  const generate = useCallback(async () => {
    setError(null);
    setBusy("generating");
    try {
      const res = await fetch("/api/reading/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listId: list._id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // The route's own words are written for him; a status code is not.
        setError(
          res.status === 429
            ? "The story writer needs a short rest. Try again in a minute."
            : typeof data.error === "string" && res.status !== 500
              ? data.error
              : "The story did not come. Try again."
        );
        return null;
      }
      const fresh = (data as ClientWordList).currentReading;
      installReading(fresh);
      return fresh;
    } catch {
      setError("No internet right now. Try again when you are back online.");
      return null;
    } finally {
      setBusy(null);
    }
  }, [list._id, installReading]);

  // ── Answering ───────────────────────────────────────────────────────────

  function patchQ(i: number, patch: Partial<QState>) {
    setQStates((s) => s.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));
  }

  function markWrong(i: number) {
    const state = qStates[i];
    const wrong = state.wrong + 1;
    const hints = Math.min(HINTS_BEFORE_REVEAL, wrong);
    const revealed = wrong > HINTS_BEFORE_REVEAL;
    patchQ(i, { wrong, hints, revealed });
    sfx.wrong();
    setShake(true);
    setTimeout(() => setShake(false), 420);
  }

  /** A repeat of an answer already marked wrong: shake, but no new miss. */
  function alreadyTried(key: string): boolean {
    if (!tried.includes(key)) return false;
    setShake(true);
    setTimeout(() => setShake(false), 420);
    return true;
  }

  function answerText() {
    const q = questions[qIdx];
    if (!q || !typed.trim()) return;
    const key = typed.trim().toLowerCase().replace(/\s+/g, " ");
    if (alreadyTried(key)) return;
    const judged = judgeAnswer(typed, q.acceptable, q.q, reading?.paragraph ?? "");
    if (judged.verdict === "wrong") {
      setTried((t) => [...t, key]);
      markWrong(qIdx);
      return;
    }
    // "close" means he had the idea but the spelling or wording was rough. He
    // gets the credit, and the tidy phrasing to read back.
    patchQ(qIdx, { done: true });
    setFeedback({
      state: "correct",
      title: judged.verdict === "correct" ? "That's it." : "Yes — that's the idea.",
      line: withNames(
        judged.verdict === "correct"
          ? q.acceptable[0]
          : `We would write it: ${judged.matched || q.acceptable[0]}`,
        reading?.paragraph ?? ""
      ),
    });
  }

  function answerPick(index: number) {
    const q = questions[qIdx];
    if (!q || alreadyTried(`#${index}`)) return;
    setPicked(index);
    if (index === q.answerIndex) {
      patchQ(qIdx, { done: true });
      setFeedback({ state: "correct", title: "That's it.", line: q.options[index] });
    } else {
      setTried((t) => [...t, `#${index}`]);
      markWrong(qIdx);
      setTimeout(() => setPicked(null), 420);
    }
  }

  useEffect(() => {
    // Part by part scrolls the new part into view instead (Passage follows
    // it); putting the question at the top would push the part off screen.
    if (phase !== "questions" || mode === "alone") return;
    scrollIntoViewIfNeeded(questionRef.current, "start");
  }, [phase, qIdx, mode]);

  const advance = useCallback(() => {
    watch.current?.mark();
    setFeedback(null);
    setTyped("");
    setPicked(null);
    setTried([]);
    if (qIdx + 1 < questions.length) {
      setQIdx(qIdx + 1);
      // Part by part: the part just asked about is read, so open the next.
      if ((partOfQ[qIdx + 1] ?? 0) > seenPart) setSeenPart((p) => p + 1);
    } else {
      setElapsedMs(watch.current?.read() ?? 0);
      setPhase("done");
    }
  }, [qIdx, questions.length, partOfQ, seenPart]);

  // ── Saving ──────────────────────────────────────────────────────────────

  const firstTry = qStates.filter((q) => q.wrong === 0 && q.hints === 0).length;
  const pct = questions.length ? Math.round((firstTry / questions.length) * 100) : 0;
  const perfect = questions.length > 0 && firstTry === questions.length;

  useEffect(() => {
    if (phase !== "done" || savedRef.current || !reading) return;
    savedRef.current = true;
    const ms = elapsedMs;
    const perQuestion = questions.map((q, i) => ({
      type: q.type,
      firstTryCorrect: (qStates[i]?.wrong ?? 0) === 0 && (qStates[i]?.hints ?? 0) === 0,
      hintsUsed: qStates[i]?.hints ?? 0,
    }));

    void (async () => {
      setBusy("saving");
      try {
        // The session first: postSession stores it on the phone before it
        // sends, so closing the app during a slow save can no longer lose it.
        const posted = await postSession({
          kind: "reading",
          // The passage's own time tells a new passage from a re-read of this one.
          ref: `read:${list._id}@${reading.generatedAt}`,
          listId: list._id,
          step: "read",
          answered: questions.length,
          correct: firstTry,
          fastCount: 0,
          ms,
          perfect,
          reading: {
            level,
            pct,
            wordsCount,
          },
        });
        if (posted.saved) {
          setGainedXp(posted.gained.xp);
          const after = readingProgress(posted.profile.reading);
          setLadderNote(
            after.level > level
              ? `Level up! You are on reading level ${after.level} now.`
              : after.toNext > 0
                ? `${after.toNext} more good ${after.toNext === 1 ? "reading" : "readings"} to level ${after.level + 1}.`
                : undefined
          );
        } else setQueuedNote(saveNote(posted));

        // Then the passage's stats and glossed words. A repeat is harmless (the
        // route ignores a passage already closed). Offline, it waits on the
        // phone and goes with the next flush.
        await postReadingDone({ listId: list._id, generatedAt: reading.generatedAt, perQuestion });
      } finally {
        setBusy(null);
      }
    })();
  }, [
    phase,
    reading,
    questions,
    qStates,
    firstTry,
    perfect,
    pct,
    level,
    wordsCount,
    elapsedMs,
    list._id,
  ]);

  // ── Screens ─────────────────────────────────────────────────────────────

  if (phase === "done") {
    return (
      <LessonComplete
        title={perfect ? "Every one right." : "Reading done."}
        subtitle={
          echo
              ? `You read back ${echo.passed} of ${echo.sentences} sentences.`
              : `Level ${level} · ${lexile}L${atGrade ? ` · Grade ${grade} reading` : ""}`
        }
        xp={gainedXp}
        ms={elapsedMs}
        accuracy={questions.length ? firstTry / questions.length : 0}
        perfect={perfect}
        note={busy === "saving" ? "Saving…" : (error ?? queuedNote ?? ladderNote)}
        primary={
          onDone
            ? { label: "Continue", onClick: onDone }
            : { label: "Back to Learn", href: "/" }
        }
        secondary={{
          label: busy === "generating" ? "Writing…" : "New reading",
          // Not while saving (the new passage would land on the list the save
          // is writing), and once only: every tap is a paid call.
          disabled: busy !== null,
          onClick: () => {
            void (async () => {
              const fresh = await generate();
              // A new passage opens on its words; installReading set that.
              if (!fresh) return;
            })();
          },
        }}
      />
    );
  }

  if (!reading) {
    return (
      <div className="space-y-5 px-4 py-8">
        <h1 className="font-display text-2xl font-bold">Read and answer</h1>
        <p className="text-base" style={{ color: "var(--color-muted)" }}>
          A new passage using words from <strong>{list.name}</strong>, written for
          level {list.readingLevel}.
        </p>
        {error ? (
          <p className="text-sm" style={{ color: "var(--color-coral-dark)" }}>
            {error}
          </p>
        ) : null}
        <Button
          fullWidth
          size="lg"
          disabled={busy !== null}
          onClick={() => {
            void (async () => {
              await generate();
            })();
          }}
        >
          {busy === "generating" ? "Writing it…" : "Write my reading"}
        </Button>
        {error && shelved ? (
          <Button
            fullWidth
            size="lg"
            variant="secondary"
            color="green"
            onClick={() => {
              setError(null);
              installReading(shelved);
            }}
          >
            Read {shelved.title} again
          </Button>
        ) : null}
        {/* Nothing on this list, but something on another. Link rather than
            render it here, so the reading is logged against the list it
            actually belongs to. */}
        {error && !shelved && spare ? (
          <Link
            href={spare.href}
            className={buttonClass({ variant: "secondary", color: "green", size: "lg", fullWidth: true })}
            style={buttonStyle({ variant: "secondary", color: "green", size: "lg" })}
          >
            Read {spare.title} instead
          </Link>
        ) : null}
      </div>
    );
  }

  const glossPanel = gloss ? (
    <div
      // z-40, under the answer sheet (z-50): a word left open used to cover
      // the sheet's Continue button.
      className="fixed bottom-0 left-1/2 z-40 w-full max-w-app -translate-x-1/2 rounded-t-hero border-t-4 px-4 pt-4"
      style={{
        background: "#fff",
        borderTopColor: "var(--color-green)",
        paddingBottom: "calc(16px + env(safe-area-inset-bottom))",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-xl font-bold">{gloss.word}</p>
          <p className="mt-1 text-base">{gloss.meaning || "A word from the passage."}</p>
        </div>
        <button
          type="button"
          aria-label="Close"
          onClick={() => {
            setGloss(null);
            setShowArabic(false);
          }}
          className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
          style={{ color: "var(--color-muted)" }}
        >
          <Icon name="x" size={24} />
        </button>
      </div>
      {gloss.arabic ? (
        <div className="mt-3">
          {showArabic ? (
            <p className="font-display text-xl" lang="ar" dir="rtl">
              {gloss.arabic}
            </p>
          ) : (
            <Button
              variant="secondary"
              color="green"
              size="md"
              onClick={() => setShowArabic(true)}
            >
              Arabic
            </Button>
          )}
        </div>
      ) : null}
    </div>
  ) : null;

  // (a0) Words first: the hardest few, heard and understood before he meets
  // them in the story. Vocabulary is where he gets stuck.
  if (phase === "words") {
    const first = wordsFirst(reading.vocabGlosses, reading.paragraph);
    return (
      <div className="space-y-4 px-4 py-8">
        <h1 className="font-display text-2xl font-bold">
          {first.length} {first.length === 1 ? "word" : "words"} in this story
        </h1>
        <p className="text-base" style={{ color: "var(--color-muted)" }}>
          Tap to hear each one. Then read the story.
        </p>
        <ul className="space-y-3">
          {first.map((g) => (
            <li key={g.word}>
              <Card>
                <div className="flex items-center gap-3">
                  <AudioButton text={g.word} size={52} color="green" label={`Hear ${g.word}`} />
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-2xl font-bold">{g.word}</p>
                    {g.meaning ? <p className="mt-1 text-base">{g.meaning}</p> : null}
                  </div>
                </div>
                {g.arabic ? <ArabicChip arabic={g.arabic} className="mt-3" /> : null}
              </Card>
            </li>
          ))}
        </ul>
        <Button fullWidth size="lg" color="green" onClick={() => setPhase("mode")}>
          Read the story
        </Button>
      </div>
    );
  }

  // (a) Mode choice
  if (phase === "mode") {
    return (
      <div className="space-y-5 px-4 py-8">
        <p
          className="text-sm font-bold uppercase tracking-wide"
          style={{ color: "var(--color-muted)" }}
        >
          Level {level} · {wordsCount} words · {lexile}L
        </p>
        <p className="text-sm" style={{ color: "var(--color-muted)" }}>
          {atGrade
            ? `This is Grade ${grade} reading.`
            : `Grade ${grade} reading starts at ${GRADE4_LEXILE.min}L.`}
        </p>
        <h1 className="font-display text-3xl font-bold">{reading.title}</h1>
        {reading.reused ? (
          <p className="mt-1 text-sm" style={{ color: "var(--color-muted)" }}>
            One you read a while ago. The writer is resting today.
          </p>
        ) : null}
        <p className="text-base" style={{ color: "var(--color-muted)" }}>
          How do you want to read it?
        </p>
        <Button
          fullWidth
          size="lg"
          color="green"
          // Not while a new passage is being written: it would swap the
          // story, and his answers, out from under him.
          disabled={busy !== null}
          onClick={() => {
            setMode("echo");
            setEcho(null);
            setEchoAt(null);
            startedAtRef.current = Date.now();
            watch.current = startStopwatch();
            setPhase("read");
          }}
        >
          Read after the robot
        </Button>
        <Button
          fullWidth
          size="lg"
          variant="secondary"
          color="green"
          // Not while a new passage is being written: it would swap the
          // story, and his answers, out from under him.
          disabled={busy !== null}
          onClick={() => {
            setMode("alone");
            setEcho(null);
            setSeenPart(0);
            startedAtRef.current = Date.now();
            watch.current = startStopwatch();
            // Part by part: a few sentences, the question on them, the next few.
            setPhase("questions");
          }}
        >
          Read it part by part
        </Button>
        <p className="text-sm" style={{ color: "var(--color-muted)" }}>
          <strong>Read after the robot</strong> plays one sentence at a time and
          listens while you say it back. <strong>Read it part by part</strong> gives
          you a few sentences, then a question on them.
        </p>
        {/* He must never be stuck with a passage he does not want. Before this
            the only way to a new one was to finish every question first. */}
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void generate()}
          className="min-h-[44px] w-full text-sm font-bold underline underline-offset-4"
          style={{ color: "var(--color-muted)" }}
        >
          {busy === "generating" ? "Writing a new one…" : "I want a different story"}
        </button>
        {error ? (
          <p className="text-sm" style={{ color: "var(--color-coral-dark)" }}>
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  // (b) Reading
  // Only "read after the robot" has a reading screen; part by part goes
  // straight to the questions.
  if (phase === "read") {
    return (
      <div className="pt-5">
        <div className="mb-1 flex items-center justify-between gap-2 px-4">
          <h1 className="font-display text-2xl font-bold">{reading.title}</h1>
          <Pill color="green" size="sm">
            L{level}
          </Pill>
        </div>
        <EchoReader
          text={reading.paragraph}
          glosses={reading.vocabGlosses}
          onGlossTap={(g) => {
            setGloss(g);
            setShowArabic(false);
          }}
          start={echoAt}
          onProgress={setEchoAt}
          onFinish={(summary) => {
            setEcho(summary);
            setPhase("questions");
          }}
        />
        {glossPanel}
      </div>
    );
  }

  // (c) Questions. Part by part, the passage grows one part at a time, and
  // each question comes when the part with its answer is on screen.
  const q = questions[qIdx];
  if (!q) return null;
  const byPart = mode === "alone" && parts.length > 1;
  const needPart = partOfQ[qIdx] ?? parts.length - 1;
  // "What does the word X mean?" must not be answered by tapping X.
  const askedGlosses =
    q.type === "vocab"
      ? reading.vocabGlosses.filter((g) => !q.q.toLowerCase().includes(g.word.toLowerCase()))
      : reading.vocabGlosses;
  const shownText = byPart
    ? parts.slice(0, Math.max(seenPart, needPart) + 1).join("\n\n")
    : reading.paragraph;

  if (byPart && seenPart < needPart) {
    return (
      <div className="px-4 pb-40 pt-4">
        <ProgressBar
          value={(seenPart + 1) / parts.length}
          color="green"
          label={`Part ${seenPart + 1} of ${parts.length}`}
          className="mb-4"
        />
        <Passage
          text={parts.slice(0, seenPart + 1).join("\n\n")}
          glosses={reading.vocabGlosses}
          activeParagraph={seenPart}
          follow
          onGlossTap={(g) => {
            setGloss(g);
            setShowArabic(false);
          }}
        />
        <div className="mt-5 flex items-center gap-3">
          <AudioButton text={parts[seenPart]} size={56} color="green" label="Hear this part" />
          <Button size="lg" color="green" className="flex-1" onClick={() => setSeenPart(seenPart + 1)}>
            Next part
          </Button>
        </div>
        {glossPanel}
      </div>
    );
  }

  const state = qStates[qIdx] ?? { wrong: 0, hints: 0, revealed: false, done: false };
  const isMcq = q.options.length > 0 && q.answerIndex >= 0;
  const revealAnswer = isMcq
    ? q.options[q.answerIndex]
    : withNames(q.acceptable[0] ?? "", reading.paragraph);

  // Early on he is shown where to look before he answers; later only after a
  // miss; later still not until the reveal.
  const helped =
    scaffold === "full" || (scaffold === "light" && state.wrong > 0);
  // When the marked sentence is itself the answer ("Which sentence shows…?"),
  // marking it first hands him the answer. Those wait for the reveal.
  const plain = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const sourceIsAnswer =
    q.type === "evidence" || q.options.some((o) => plain(o) === plain(q.source));
  const markSource = Boolean(q.source) && (state.revealed || (helped && !sourceIsAnswer));
  // The first hint rides along with the marked sentence at full scaffolding.
  const hintsShown = Math.max(state.hints, helped && scaffold === "full" ? 1 : 0);

  return (
    <div className="px-4 pb-40 pt-4">
      <ProgressBar
        value={(qIdx + (state.done ? 1 : 0)) / questions.length}
        color="green"
        label="Questions"
        className="mb-4"
      />

      {byPart ? (
        <p className="mb-2 text-xs font-bold uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>
          Part {needPart + 1} of {parts.length}
        </p>
      ) : null}
      <Passage
        text={shownText}
        glosses={askedGlosses}
        activeParagraph={byPart ? needPart : null}
        follow={byPart}
        highlight={markSource ? q.source : undefined}
        onGlossTap={(g) => {
          setGloss(g);
          setShowArabic(false);
        }}
        className="mb-6 opacity-90"
      />

      <Card ref={questionRef} className={shake ? "q-shake" : ""}>
        <p
          className="text-xs font-bold uppercase tracking-wide"
          style={{ color: "var(--color-muted)" }}
        >
          Question {qIdx + 1} of {questions.length}
        </p>
        <p className="mt-1 text-[19px] leading-snug">{q.q}</p>

        {markSource && !state.revealed ? (
          <div className="mt-3 flex items-start gap-2">
            <span className="mt-0.5 shrink-0" style={{ color: "var(--color-gold-ink)" }}>
              <Icon name="star" size={18} />
            </span>
            <p className="text-sm" style={{ color: "var(--color-muted)" }}>
              The answer is in the <strong>marked sentence</strong> above. Read it
              again, then write it your own way.
            </p>
          </div>
        ) : null}

        {/* Above the answer box, not below it: on a phone the keyboard covers
            whatever sits under the box, so a miss looked like nothing had
            happened and he tapped Check again. */}
        {!state.revealed && hintsShown > 0 ? (
          <div
            className="mt-4 rounded-tile px-3 py-3"
            style={{ background: "var(--color-blue-soft)" }}
          >
            <p
              className="text-xs font-bold uppercase tracking-wide"
              style={{ color: "var(--color-blue-dark)" }}
            >
              Hint
            </p>
            {q.hints.slice(0, hintsShown).map((h, i) => (
              <p key={i} className="mt-1 text-base">
                {h}
              </p>
            ))}
          </div>
        ) : null}
        {state.revealed ? (
          <div className="mt-4 space-y-3">
            <div
              className="rounded-tile px-3 py-3"
              style={{ background: "var(--color-gold-soft)" }}
            >
              <p
                className="text-xs font-bold uppercase tracking-wide"
                style={{ color: "var(--color-gold-ink)" }}
              >
                The answer
              </p>
              <p className="mt-1 text-base">{revealAnswer}</p>
              {q.source ? (
                <p className="mt-2 text-sm" style={{ color: "var(--color-muted)" }}>
                  It comes from the marked sentence above.
                </p>
              ) : null}
            </div>
            <Button fullWidth size="lg" color="green" onClick={advance}>
              Got it
            </Button>
          </div>
        ) : isMcq ? (
          <ul className="mt-4 space-y-2">
            {q.options.map((opt, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => answerPick(i)}
                  disabled={state.done}
                  className="press-3d w-full rounded-tile border-2 px-4 py-3 text-left text-base"
                  style={{
                    borderColor:
                      picked === i ? "var(--color-coral)" : "var(--color-line)",
                    background: "#fff",
                  }}
                >
                  {opt}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <form
            className="mt-4 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              answerText();
            }}
          >
            <input
              className="min-h-[52px] min-w-0 flex-1 rounded-tile border-2 px-3 text-base"
              style={{ borderColor: "var(--color-line)", background: "#fff" }}
              placeholder="Type your answer"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              disabled={state.done}
            />
            <Button type="submit" size="md" color="green" disabled={!typed.trim()}>
              Check
            </Button>
          </form>
        )}

      </Card>

      <FeedbackSheet feedback={feedback} onContinue={advance} />
      {glossPanel}
    </div>
  );
}

export { ReadingRunner };
