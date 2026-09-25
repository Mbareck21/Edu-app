"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import Button from "@/components/ui/Button";
import { fireConfetti } from "@/components/ui/Confetti";
import Icon from "@/components/ui/Icon";
import LessonComplete from "@/components/ui/LessonComplete";
import RunnerHeader from "@/components/ui/RunnerHeader";
import { canListen, listenOnce } from "@/lib/listen";
import { requeue } from "@/components/math/QuestionPad";
import { postSession, saveNote } from "@/lib/offline-queue";
import type { Gained } from "@/lib/rewards";
import { sfx } from "@/lib/sfx";
import { judgeSpoken } from "@/lib/spoken-number";
import { FAST_MS, roundStars, type Fact } from "@/lib/tables";
import type { SessionResult } from "@/lib/types";
import {
  closeMicStream,
  openMicStream,
  playTextThroughTTS,
  recordUntilSilent,
  type Playback,
} from "@/lib/voice";

type Phase = "ready" | "asking" | "listening" | "checking" | "right" | "wrong" | "unclear" | "done";
type Outcome = { gained: Gained | null; note?: string; ms: number; correct: number; stars: 0 | 1 | 2 | 3 };

/** Quiet after speech that ends a fallback recording. Short: answers are one number. */
const FALLBACK_SILENCE_MS = 900;

/**
 * Times tables out loud. The app says a fact ("seven times eight"), he says
 * the answer, and it hears him. A quick right answer lights the fact fast on
 * the grid, the same as a typed one; a wrong one is said back with its answer
 * and comes round again later in the round. Every answer goes to
 * /api/tables/answer, so the grid moves exactly as it does for typing.
 */
export default function VoiceTablesRunner({ facts, onDone }: { facts: Fact[]; onDone: () => void }) {
  const [queue, setQueue] = useState<number[]>(() => facts.map((_, i) => i));
  const [phase, setPhase] = useState<Phase>("ready");
  const [heard, setHeard] = useState<number | null>(null);
  const [fast, setFast] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  /** The queue as the handlers see it; the state copy is for the screen. */
  const queueRef = useRef<number[]>(queue);
  /** The ask that is current; an older one that wakes up after a tap stops there. */
  const askId = useRef(0);
  /** The latest ask, for the retry timer: a callback cannot name itself. */
  const askRef = useRef<(index: number, repeat?: boolean) => Promise<void>>(async () => {});
  /** Three tries heard no number: show the buttons instead of asking again. */
  const [stuck, setStuck] = useState(false);
  const firstTry = useRef<Record<number, boolean>>({});
  const answerMs = useRef(0);
  const unclear = useRef(0);
  const alive = useRef(true);
  const playback = useRef<Playback | null>(null);
  const stopListening = useRef<(() => void) | null>(null);
  const stream = useRef<MediaStream | null>(null);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      playback.current?.cancel();
      stopListening.current?.();
      closeMicStream(stream.current);
    };
  }, []);

  const say = useCallback(async (text: string) => {
    playback.current?.cancel();
    const p = playTextThroughTTS(text);
    playback.current = p;
    await p.promise;
  }, []);

  /** One spoken answer: the phone's recogniser, or a recording sent to the server. */
  const hear = useCallback(async (answer: number): Promise<{ alternatives: string[]; ms: number } | "blocked"> => {
    const started = performance.now();
    if (canListen()) {
      // A guess on the way counts ("4" before it settles on "floor"), except
      // for an answer like 50, which is also the start of "fifty six".
      const onlyFinal = answer % 10 === 0;
      let acceptedAt = 0;
      const l = listenOnce({
        maxMs: 8000,
        accept: (guesses, isFinal) => {
          const ok = (isFinal || !onlyFinal) && judgeSpoken(guesses, answer).correct;
          if (ok && !acceptedAt) acceptedAt = performance.now();
          return ok;
        },
      });
      stopListening.current = l.cancel;
      const { alternatives, final, blocked } = await l.promise;
      stopListening.current = null;
      if (blocked) return "blocked";
      // What to judge: the finished guesses first, so "I heard" shows what he
      // ended up saying; every guess too, unless the answer ends in zero.
      const judged = onlyFinal && final.length > 0 ? final : [...final, ...alternatives];
      return { alternatives: judged, ms: (acceptedAt || performance.now()) - started };
    }
    // No recogniser on this phone: record until he stops, then transcribe.
    try {
      stream.current ??= await openMicStream();
    } catch {
      return "blocked";
    }
    const rec = recordUntilSilent({ stream: stream.current, silenceMs: FALLBACK_SILENCE_MS, initialWaitMs: 6000, maxMs: 8000 });
    stopListening.current = rec.cancel;
    const { blob } = await rec.promise;
    stopListening.current = null;
    const ms = Math.max(0, performance.now() - started - FALLBACK_SILENCE_MS);
    if (!blob) return { alternatives: [], ms };
    setPhase("checking");
    const form = new FormData();
    form.append("audio", blob, `answer.${blob.type.includes("mp4") ? "mp4" : "webm"}`);
    form.append("language", "en");
    const res = await fetch("/api/transcribe", { method: "POST", body: form }).catch(() => null);
    const data = res?.ok ? ((await res.json().catch(() => ({}))) as { text?: string }) : {};
    return { alternatives: data.text ? [data.text] : [], ms };
  }, []);

  /** Move on in the round, and ask the next fact straight away. */
  const move = useCallback((change: (q: number[]) => number[]) => {
    const next = change(queueRef.current);
    queueRef.current = next;
    setQueue(next);
    if (next.length > 0) void askRef.current(next[0]);
  }, []);

  const ask = useCallback(
    async (index: number, repeat = false) => {
      const id = ++askId.current;
      const live = () => alive.current && askId.current === id;
      const fact = facts[index];
      const answer = fact.a * fact.b;
      setError(null);
      setHeard(null);
      setFast(false);
      setStuck(false);
      setPhase("asking");
      await say(`${fact.a} times ${fact.b}`);
      if (!live()) return;
      setPhase("listening");
      const got = await hear(answer);
      if (!live()) return;
      if (got === "blocked") {
        setError("I can't use the microphone. Allow it for this site, then tap Start again.");
        setPhase("ready");
        return;
      }
      const { heard: number, correct } = judgeSpoken(got.alternatives, answer);
      setHeard(number);

      // Nothing he said was a number: ask again, twice, before moving on.
      if (number === null && !correct) {
        unclear.current += 1;
        setPhase("unclear");
        if (unclear.current <= 2) {
          setTimeout(() => live() && void askRef.current(index, true), 900);
        } else {
          setStuck(true);
        }
        return;
      }
      unclear.current = 0;
      if (firstTry.current[index] === undefined) firstTry.current[index] = correct && !repeat;
      answerMs.current += got.ms;

      // The server grades it and moves the grid, as for a typed answer.
      void fetch("/api/tables/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ a: fact.a, b: fact.b, typed: String(number ?? ""), ms: Math.round(got.ms) }),
      }).catch(() => null);

      if (correct) {
        sfx.correct();
        setFast(got.ms <= FAST_MS);
        setPhase("right");
        setTimeout(() => live() && move((q) => q.slice(1)), 800);
        return;
      }
      sfx.wrong();
      setPhase("wrong");
      await say(`${fact.a} times ${fact.b} is ${answer}`);
      setTimeout(() => live() && move((q) => requeue(q)), 700);
    },
    [facts, hear, move, say]
  );
  useEffect(() => {
    askRef.current = ask;
  }, [ask]);

  const head = queue[0];

  // The round is over: save it once.
  const posted = useRef(false);
  const done = queue.length === 0;
  useEffect(() => {
    if (!done || posted.current) return;
    posted.current = true;
    const correct = Object.values(firstTry.current).filter(Boolean).length;
    const ms = Math.round(answerMs.current);
    const result: SessionResult = {
      kind: "math",
      ref: "tables:voice",
      answered: facts.length,
      correct,
      fastCount: 0,
      ms,
      perfect: correct === facts.length,
    };
    if (correct > 0) void fireConfetti(correct === facts.length ? "big" : "small");
    void postSession(result).then((res) =>
      setOutcome({
        gained: res.saved ? res.gained : null,
        note: saveNote(res),
        ms,
        correct,
        stars: roundStars(correct, facts.length, ms),
      })
    );
  }, [done, facts.length]);

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
    const starLine = ["Every one right earns a star.", "One star.", "Two stars.", "Three stars!"][outcome.stars];
    return (
      <div className="safe-top safe-bottom min-h-dvh px-4">
        <LessonComplete
          title={outcome.stars === 3 ? "Lightning voice!" : "Times tables said!"}
          subtitle={`${outcome.correct} of ${facts.length} right the first time. ${starLine}`}
          xp={outcome.gained?.xp ?? 0}
          ms={outcome.ms}
          accuracy={facts.length === 0 ? 0 : outcome.correct / facts.length}
          perfect={outcome.stars > 0}
          leveledUp={outcome.gained?.leveledUp ?? false}
          newBadge={outcome.gained?.newBadges[0] ?? null}
          primary={{ label: "Back to the grid", onClick: onDone }}
          note={outcome.note}
        />
      </div>
    );
  }

  const fact = facts[head];
  const answered = facts.length - queue.length;

  return (
    <div className="safe-top flex min-h-dvh flex-col" style={{ paddingBottom: "calc(24px + env(safe-area-inset-bottom))" }}>
      <RunnerHeader href="/math/tables" value={answered / facts.length} color="purple" label="Facts said" />
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        {phase === "ready" ? (
          <>
            <span
              className="flex h-24 w-24 items-center justify-center rounded-full"
              style={{ background: "var(--color-purple-soft)", color: "var(--color-purple)" }}
            >
              <Icon name="mic" size={48} />
            </span>
            <h1 className="mt-4 font-display text-3xl font-bold">Say it out loud</h1>
            <p className="mt-2 text-base" style={{ color: "var(--color-muted)" }}>
              I&rsquo;ll say a times fact. Say the answer out loud, as fast as you can!
            </p>
          </>
        ) : (
          <>
            <p className="font-display text-6xl font-bold tracking-tight">
              {fact.a} × {fact.b}
            </p>
            <div className="mt-6 flex min-h-36 items-center justify-center">
              {phase === "asking" ? (
                <p className="font-display text-lg font-bold" style={{ color: "var(--color-muted)" }}>
                  Listen…
                </p>
              ) : phase === "listening" || phase === "checking" ? (
                <div className="flex flex-col items-center gap-3">
                  <span
                    className="q-node-pulse flex h-24 w-24 items-center justify-center rounded-full"
                    style={{ background: "var(--color-purple)", color: "#fff" }}
                    aria-label="Listening"
                  >
                    <Icon name="mic" size={44} />
                  </span>
                  {/* One short word is the hardest thing to recognise; the
                      whole fact is easy, and the number at its end counts. */}
                  <p className="text-sm" style={{ color: "var(--color-muted)" }}>
                    {`Say it all: “${fact.a} times ${fact.b} is …”`}
                  </p>
                </div>
              ) : phase === "right" ? (
                <div className="q-bounce-in">
                  <p className="font-display text-5xl font-bold" style={{ color: "var(--color-green-dark)" }}>
                    {fact.a * fact.b} ✓
                  </p>
                  {fast ? (
                    <p className="mt-1 font-display text-lg font-bold" style={{ color: "var(--color-gold-ink)" }}>
                      Lightning fast!
                    </p>
                  ) : null}
                </div>
              ) : phase === "wrong" ? (
                <div className="q-bounce-in">
                  {heard !== null ? (
                    <p className="text-base" style={{ color: "var(--color-muted)" }}>
                      I heard {heard}.
                    </p>
                  ) : null}
                  <p className="font-display text-4xl font-bold" style={{ color: "var(--color-coral-dark)" }}>
                    {fact.a} × {fact.b} = {fact.a * fact.b}
                  </p>
                  <p className="mt-1 text-sm" style={{ color: "var(--color-muted)" }}>
                    It will come back soon.
                  </p>
                </div>
              ) : (
                <p className="font-display text-lg font-bold" style={{ color: "var(--color-purple-dark)" }}>
                  {stuck ? "I couldn't hear a number. Try the buttons below." : "I didn't catch that. Say it again!"}
                </p>
              )}
            </div>
          </>
        )}
        {error ? (
          <p className="mt-4 text-sm font-bold" role="alert" style={{ color: "var(--color-coral-dark)" }}>
            {error}
          </p>
        ) : null}
      </div>

      <div className="space-y-3 px-4">
        {phase === "ready" ? (
          <Button
            fullWidth
            size="lg"
            color="purple"
            onClick={() => {
              sfx.tap();
              void ask(head);
            }}
          >
            <Icon name="mic" size={22} />
            Start
          </Button>
        ) : phase === "listening" || (phase === "unclear" && stuck) ? (
          <div className="flex gap-3">
            <Button
              className="flex-1"
              size="md"
              variant="secondary"
              color="purple"
              onClick={() => {
                stopListening.current?.();
                unclear.current = 0;
                void ask(head, true);
              }}
            >
              Say it again
            </Button>
            <Button
              className="flex-1"
              size="md"
              variant="secondary"
              color="purple"
              onClick={() => {
                stopListening.current?.();
                unclear.current = 0;
                if (firstTry.current[head] === undefined) firstTry.current[head] = false;
                move((q) => requeue(q));
              }}
            >
              Skip
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
