"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import FeedbackSheet, { type Feedback } from "@/components/ui/FeedbackSheet";
import Icon from "@/components/ui/Icon";
import LessonComplete from "@/components/ui/LessonComplete";
import Pill from "@/components/ui/Pill";
import ProgressBar from "@/components/ui/ProgressBar";
import Passage from "@/components/reading/Passage";
import { postSession } from "@/lib/offline-queue";
import {
  countWords,
  isAcceptable,
  splitParagraphs,
  wordsPerMinute,
  wpmNormForDate,
} from "@/lib/reading";
import { sfx } from "@/lib/sfx";
import { playTextThroughTTS, type Playback } from "@/lib/voice";
import type {
  ClientWordList,
  CurrentReading,
  ReadingQuestion,
  VocabGloss,
} from "@/lib/models/WordList";

export type ReadingRunnerProps = {
  list: ClientWordList;
  /** Called from the finish screen's main button. Falls back to a link home. */
  onDone?: () => void;
};

type Phase = "mode" | "read" | "questions" | "done";
type Mode = "listen" | "alone";

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

export default function ReadingRunner({ list, onDone }: ReadingRunnerProps) {
  const [reading, setReading] = useState<CurrentReading | null>(list.currentReading);
  const [phase, setPhase] = useState<Phase>("mode");
  const [mode, setMode] = useState<Mode>("listen");
  const [busy, setBusy] = useState<null | "generating" | "saving">(null);
  const [error, setError] = useState<string | null>(null);

  const questions: ReadingQuestion[] = useMemo(
    () => reading?.questions ?? [],
    [reading]
  );
  const [qStates, setQStates] = useState<QState[]>(() => freshQ(questions.length));
  const [qIdx, setQIdx] = useState(0);
  const [typed, setTyped] = useState("");
  const [picked, setPicked] = useState<number | null>(null);
  const [shake, setShake] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const [gloss, setGloss] = useState<VocabGloss | null>(null);
  const [showArabic, setShowArabic] = useState(false);

  // Listen mode
  const [playingIdx, setPlayingIdx] = useState<number | null>(null);
  const playbackRef = useRef<Playback | null>(null);
  const tokenRef = useRef(0);

  // Fluency timer
  const [timerStart, setTimerStart] = useState<number | null>(null);
  const [wpm, setWpm] = useState<number | null>(null);

  // 0 until the kid picks a reading mode; the finish screen reads it back.
  const startedAtRef = useRef(0);
  const savedRef = useRef(false);
  const [gainedXp, setGainedXp] = useState(0);
  const [queuedNote, setQueuedNote] = useState<string | undefined>(undefined);
  const [elapsedMs, setElapsedMs] = useState(0);

  const paragraphs = useMemo(
    () => (reading ? splitParagraphs(reading.paragraph) : []),
    [reading]
  );
  const wordsCount = reading ? countWords(reading.paragraph) : 0;
  const level = reading?.level ?? list.readingLevel ?? 1;

  const stopAudio = useCallback(() => {
    tokenRef.current++;
    playbackRef.current?.cancel();
    playbackRef.current = null;
    setPlayingIdx(null);
  }, []);

  useEffect(() => () => stopAudio(), [stopAudio]);

  // ── Generating ──────────────────────────────────────────────────────────

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
        setError(typeof data.error === "string" ? data.error : `Error ${res.status}`);
        return null;
      }
      const fresh = (data as ClientWordList).currentReading;
      setReading(fresh);
      setQStates(freshQ(fresh?.questions.length ?? 0));
      setQIdx(0);
      setWpm(null);
      setTimerStart(null);
      savedRef.current = false;
      return fresh;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error.");
      return null;
    } finally {
      setBusy(null);
    }
  }, [list._id]);

  // ── Listen mode playback ────────────────────────────────────────────────

  const playFrom = useCallback(
    (start: number) => {
      stopAudio();
      const token = ++tokenRef.current;
      const run = (i: number) => {
        if (i >= paragraphs.length || tokenRef.current !== token) {
          if (tokenRef.current === token) setPlayingIdx(null);
          return;
        }
        setPlayingIdx(i);
        const pb = playTextThroughTTS(paragraphs[i]);
        playbackRef.current = pb;
        void pb.promise.then(() => {
          if (tokenRef.current === token) run(i + 1);
        });
      };
      run(start);
    },
    [paragraphs, stopAudio]
  );

  // ── Fluency timer ───────────────────────────────────────────────────────

  function toggleTimer() {
    if (timerStart === null) {
      stopAudio();
      setWpm(null);
      setTimerStart(Date.now());
      return;
    }
    setWpm(wordsPerMinute(wordsCount, Date.now() - timerStart));
    setTimerStart(null);
  }

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

  function answerText() {
    const q = questions[qIdx];
    if (!q || !typed.trim()) return;
    if (isAcceptable(typed, q.acceptable)) {
      patchQ(qIdx, { done: true });
      setFeedback({ state: "correct", title: "That's it.", line: q.acceptable[0] });
    } else {
      markWrong(qIdx);
    }
  }

  function answerPick(index: number) {
    const q = questions[qIdx];
    if (!q) return;
    setPicked(index);
    if (index === q.answerIndex) {
      patchQ(qIdx, { done: true });
      setFeedback({ state: "correct", title: "That's it.", line: q.options[index] });
    } else {
      markWrong(qIdx);
      setTimeout(() => setPicked(null), 420);
    }
  }

  const advance = useCallback(() => {
    setFeedback(null);
    setTyped("");
    setPicked(null);
    if (qIdx + 1 < questions.length) {
      setQIdx(qIdx + 1);
    } else {
      setElapsedMs(Date.now() - (startedAtRef.current || Date.now()));
      setPhase("done");
    }
  }, [qIdx, questions.length]);

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
        await fetch("/api/reading/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ listId: list._id, perQuestion }),
        }).catch(() => null);

        const posted = await postSession({
          kind: "reading",
          ref: `read:${list._id}`,
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
            ...(wpm ? { wpm } : {}),
          },
        });
        if (posted.saved) setGainedXp(posted.gained.xp);
        else setQueuedNote("Saved on this phone. It will sync next time.");
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
    wpm,
    elapsedMs,
    list._id,
  ]);

  // ── Screens ─────────────────────────────────────────────────────────────

  if (phase === "done") {
    return (
      <LessonComplete
        title={perfect ? "Every one right." : "Reading done."}
        subtitle={
          wpm
            ? `${wpm} words a minute. Grade 4 aims for ${wpmNormForDate()}.`
            : `Level ${level} · ${wordsCount} words`
        }
        xp={gainedXp}
        ms={elapsedMs}
        accuracy={questions.length ? firstTry / questions.length : 0}
        perfect={perfect}
        note={busy === "saving" ? "Saving…" : queuedNote}
        primary={
          onDone
            ? { label: "Continue", onClick: onDone }
            : { label: "Back to Learn", href: "/" }
        }
        secondary={{
          label: "New reading",
          onClick: () => {
            void (async () => {
              const fresh = await generate();
              if (fresh) {
                startedAtRef.current = Date.now();
                setPhase("mode");
              }
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
              const fresh = await generate();
              if (fresh) startedAtRef.current = Date.now();
            })();
          }}
        >
          {busy === "generating" ? "Writing it…" : "Write my reading"}
        </Button>
      </div>
    );
  }

  const glossPanel = gloss ? (
    <div
      className="fixed bottom-0 left-1/2 z-50 w-full max-w-app -translate-x-1/2 rounded-t-hero border-t-4 px-4 pt-4"
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

  // (a) Mode choice
  if (phase === "mode") {
    return (
      <div className="space-y-5 px-4 py-8">
        <p
          className="text-sm font-bold uppercase tracking-wide"
          style={{ color: "var(--color-muted)" }}
        >
          Level {level} · {wordsCount} words
        </p>
        <h1 className="font-display text-3xl font-bold">{reading.title}</h1>
        <p className="text-base" style={{ color: "var(--color-muted)" }}>
          How do you want to read it?
        </p>
        <Button
          fullWidth
          size="lg"
          color="green"
          onClick={() => {
            setMode("listen");
            startedAtRef.current = Date.now();
            setPhase("read");
            playFrom(0);
          }}
        >
          Listen and read
        </Button>
        <Button
          fullWidth
          size="lg"
          variant="secondary"
          color="green"
          onClick={() => {
            setMode("alone");
            startedAtRef.current = Date.now();
            setPhase("read");
          }}
        >
          Read alone
        </Button>
      </div>
    );
  }

  // (b) Reading
  if (phase === "read") {
    return (
      <div className="px-4 pb-10 pt-5">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h1 className="font-display text-2xl font-bold">{reading.title}</h1>
          <Pill color="green" size="sm">
            L{level}
          </Pill>
        </div>

        {mode === "listen" ? (
          <div className="mb-4 flex items-center gap-3">
            <Button
              size="lg"
              color="green"
              onClick={() => {
                if (playingIdx === null) playFrom(0);
                else stopAudio();
              }}
            >
              <Icon name={playingIdx === null ? "play" : "x"} size={22} />
              {playingIdx === null ? "Play" : "Pause"}
            </Button>
            <p className="text-sm" style={{ color: "var(--color-muted)" }}>
              {playingIdx === null
                ? "Tap play. The part being read lights up."
                : `Part ${playingIdx + 1} of ${paragraphs.length}`}
            </p>
          </div>
        ) : null}

        <Passage
          text={reading.paragraph}
          glosses={reading.vocabGlosses}
          activeParagraph={mode === "listen" ? playingIdx : null}
          onGlossTap={(g) => {
            setGloss(g);
            setShowArabic(false);
          }}
        />

        <Card color="green" variant="soft" className="mt-6">
          <p className="font-display text-base font-bold">Time my read</p>
          <p className="mt-1 text-sm" style={{ color: "var(--color-muted)" }}>
            Read it out loud one more time. Start, read, stop.
          </p>
          <div className="mt-3 flex items-center gap-3">
            <Button size="md" color="blue" onClick={toggleTimer}>
              {timerStart === null ? "Start" : "Stop"}
            </Button>
            {wpm ? (
              <Pill color="blue" size="md">
                {wpm} words a minute
              </Pill>
            ) : null}
          </div>
        </Card>

        <div className="mt-6">
          <Button
            fullWidth
            size="lg"
            color="green"
            onClick={() => {
              stopAudio();
              if (timerStart !== null) toggleTimer();
              setPhase("questions");
            }}
          >
            Answer the questions
          </Button>
        </div>

        {glossPanel}
      </div>
    );
  }

  // (c) Questions
  const q = questions[qIdx];
  if (!q) return null;
  const state = qStates[qIdx] ?? { wrong: 0, hints: 0, revealed: false, done: false };
  const isMcq = q.options.length > 0 && q.answerIndex >= 0;
  const revealAnswer = isMcq ? q.options[q.answerIndex] : q.acceptable[0];

  return (
    <div className="px-4 pb-40 pt-4">
      <ProgressBar
        value={(qIdx + (state.done ? 1 : 0)) / questions.length}
        color="green"
        label="Questions"
        className="mb-4"
      />

      <Passage
        text={reading.paragraph}
        glosses={reading.vocabGlosses}
        highlight={state.revealed ? q.source : undefined}
        onGlossTap={(g) => {
          setGloss(g);
          setShowArabic(false);
        }}
        className="mb-6 opacity-90"
      />

      <Card className={shake ? "q-shake" : ""}>
        <p
          className="text-xs font-bold uppercase tracking-wide"
          style={{ color: "var(--color-muted)" }}
        >
          Question {qIdx + 1} of {questions.length}
        </p>
        <p className="mt-1 text-[19px] leading-snug">{q.q}</p>

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
              className="min-h-[52px] flex-1 rounded-tile border-2 px-3 text-base"
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

        {!state.revealed && state.hints > 0 ? (
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
            {q.hints.slice(0, state.hints).map((h, i) => (
              <p key={i} className="mt-1 text-base">
                {h}
              </p>
            ))}
          </div>
        ) : null}
      </Card>

      <FeedbackSheet feedback={feedback} onContinue={advance} />
      {glossPanel}
    </div>
  );
}

export { ReadingRunner };
