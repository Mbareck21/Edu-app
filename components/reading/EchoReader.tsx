"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Icon from "@/components/ui/Icon";
import Pill from "@/components/ui/Pill";
import ProgressBar from "@/components/ui/ProgressBar";
import Passage from "@/components/reading/Passage";
import { compareEcho, type EchoScore } from "@/lib/echo";
import { splitParagraphs, splitSentences } from "@/lib/reading";
import { sfx } from "@/lib/sfx";
import {
  closeMicStream,
  isRecordingSupported,
  openMicStream,
  playTextThroughTTS,
  recordUntilSilent,
  type Playback,
  type SilentRecording,
} from "@/lib/voice";
import type { VocabGloss } from "@/lib/models/WordList";

export type EchoReaderProps = {
  text: string;
  glosses: VocabGloss[];
  /** Called once every sentence has been echoed or skipped. */
  onFinish: (summary: EchoSummary) => void;
  onGlossTap?: (gloss: VocabGloss) => void;
};

export type EchoSummary = {
  sentences: number;
  /** Sentences he got to the pass mark on, first try or not. */
  passed: number;
  /** Mean share of words he said across every attempt that reached the mic. */
  wordPct: number;
};

type Stage = "listen" | "recording" | "checking" | "result";

/** He reads after the voice; a long line is hard to hold in memory. */
const LONG_SENTENCE_WORDS = 14;

export default function EchoReader({
  text,
  glosses,
  onFinish,
  onGlossTap,
}: EchoReaderProps) {
  const sentences = useMemo(
    () => splitParagraphs(text).flatMap((p) => splitSentences(p)),
    [text]
  );

  const [idx, setIdx] = useState(0);
  const [stage, setStage] = useState<Stage>("listen");
  const [score, setScore] = useState<EchoScore | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [level, setLevel] = useState(0); // mic loudness, 0..1
  const [error, setError] = useState<string | null>(null);

  const playbackRef = useRef<Playback | null>(null);
  const recordingRef = useRef<SilentRecording | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const doneRef = useRef(false);
  // Results accumulate in a ref: the summary is read once, at the end.
  const tallyRef = useRef({ passed: 0, pctSum: 0, pctCount: 0 });

  const sentence = sentences[idx] ?? "";
  const canRecord = isRecordingSupported();

  const stopAll = useCallback(() => {
    playbackRef.current?.cancel();
    playbackRef.current = null;
    recordingRef.current?.cancel();
    recordingRef.current = null;
  }, []);

  const speak = useCallback(
    (line: string) => {
      playbackRef.current?.cancel();
      playbackRef.current = playTextThroughTTS(line);
    },
    []
  );

  // Read whichever sentence is up out loud the moment it appears.
  useEffect(() => {
    if (!sentence) return;
    const pb = playTextThroughTTS(sentence);
    playbackRef.current = pb;
    return () => pb.cancel();
  }, [sentence]);

  useEffect(
    () => () => {
      stopAll();
      closeMicStream(streamRef.current);
      streamRef.current = null;
    },
    [stopAll]
  );

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    stopAll();
    closeMicStream(streamRef.current);
    streamRef.current = null;
    const t = tallyRef.current;
    onFinish({
      sentences: sentences.length,
      passed: t.passed,
      wordPct: t.pctCount ? t.pctSum / t.pctCount : 0,
    });
  }, [onFinish, sentences.length, stopAll]);

  const next = useCallback(() => {
    if (idx + 1 >= sentences.length) {
      finish();
      return;
    }
    setIdx(idx + 1);
    setStage("listen");
    setScore(null);
    setAttempts(0);
    setError(null);
  }, [idx, sentences.length, finish]);

  const listen = useCallback(async () => {
    playbackRef.current?.cancel();
    playbackRef.current = null;
    setError(null);
    setScore(null);

    let stream = streamRef.current;
    if (!stream) {
      try {
        stream = await openMicStream();
        streamRef.current = stream;
      } catch {
        setError("I can't reach the microphone. You can still tap “I read it”.");
        return;
      }
    }

    setStage("recording");
    const rec = recordUntilSilent({
      stream,
      // A whole sentence takes longer to get going than a chat reply does.
      silenceMs: 1800,
      initialWaitMs: 8000,
      maxMs: 25_000,
      onLevel: (rms) => setLevel(Math.min(1, rms / 0.06)),
    });
    recordingRef.current = rec;

    const { blob } = await rec.promise;
    recordingRef.current = null;
    setLevel(0);
    if (doneRef.current) return;

    if (!blob) {
      setStage("result");
      setScore(compareEcho(sentence, ""));
      return;
    }

    setStage("checking");
    try {
      const form = new FormData();
      form.append("audio", blob, "echo.webm");
      form.append("language", "en");
      const res = await fetch("/api/transcribe", { method: "POST", body: form });
      const data: unknown = await res.json().catch(() => ({}));
      const heard =
        typeof data === "object" && data !== null && "text" in data
          ? String((data as { text?: unknown }).text ?? "")
          : "";
      if (!res.ok) {
        setError("I couldn't hear that one. Try again, or tap “I read it”.");
        setStage("listen");
        return;
      }
      const result = compareEcho(sentence, heard);
      setAttempts((a) => a + 1);
      tallyRef.current.pctSum += result.pct;
      tallyRef.current.pctCount += 1;
      if (result.pass) {
        tallyRef.current.passed += 1;
        sfx.correct();
      } else {
        sfx.wrong();
      }
      setScore(result);
      setStage("result");
    } catch {
      setError("Something went wrong listening. Try again.");
      setStage("listen");
    }
  }, [sentence]);

  if (!sentence) return null;

  const long = sentence.trim().split(/\s+/).length > LONG_SENTENCE_WORDS;
  const passed = score?.pass ?? false;

  return (
    <div className="px-4 pb-10 pt-5">
      <ProgressBar
        value={(idx + (passed ? 1 : 0)) / sentences.length}
        color="green"
        label={`Sentence ${idx + 1} of ${sentences.length}`}
        className="mb-4"
      />

      <Card color="green" variant="soft">
        <div className="flex items-center justify-between gap-2">
          <p
            className="text-xs font-bold uppercase tracking-wide"
            style={{ color: "var(--color-green-dark)" }}
          >
            {stage === "recording"
              ? "Your turn — read it out loud"
              : stage === "checking"
                ? "Listening…"
                : "Listen, then say it back"}
          </p>
          <button
            type="button"
            aria-label="Play the sentence again"
            onClick={() => speak(sentence)}
            className="press-3d rounded-full p-1"
            style={{ color: "var(--color-green-dark)" }}
          >
            <Icon name="volume" size={24} strokeWidth={2.6} />
          </button>
        </div>

        {/* The words, marked up once he has had a go at them. */}
        <p className="mt-2 text-[22px] font-bold leading-[1.55]">
          {score
            ? score.tokens.map((t, i) => (
                <span
                  key={i}
                  className="rounded px-1"
                  style={
                    !t.scored
                      ? undefined
                      : t.said
                        ? { color: "var(--color-green-dark)" }
                        : {
                            color: "var(--color-coral-dark)",
                            textDecoration: "underline",
                            textDecorationStyle: "wavy",
                          }
                  }
                >
                  {t.word}{" "}
                </span>
              ))
            : sentence}
        </p>

        {long && stage === "listen" && attempts === 0 ? (
          <p className="mt-2 text-sm" style={{ color: "var(--color-muted)" }}>
            This one is long. Play it twice if you need to.
          </p>
        ) : null}
      </Card>

      {/* Turn control */}
      <div className="mt-5">
        {stage === "recording" ? (
          <div className="flex flex-col items-center gap-3">
            <div
              className="flex items-center justify-center rounded-full"
              style={{
                width: 96,
                height: 96,
                background: "var(--color-coral)",
                color: "#fff",
                transform: `scale(${1 + level * 0.18})`,
                transition: "transform 90ms linear",
              }}
            >
              <Icon name="mic" size={40} strokeWidth={2.6} />
            </div>
            <p className="text-sm" style={{ color: "var(--color-muted)" }}>
              Stop talking when you finish and I&apos;ll check it.
            </p>
            <Button
              size="md"
              variant="secondary"
              color="green"
              onClick={() => recordingRef.current?.cancel()}
            >
              Done
            </Button>
          </div>
        ) : stage === "checking" ? (
          <p className="text-center text-base" style={{ color: "var(--color-muted)" }}>
            Checking what you said…
          </p>
        ) : stage === "result" && score ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Pill color={passed ? "green" : "gold"} size="md">
                {score.silent
                  ? "I heard nothing"
                  : `${score.matched} of ${score.total} words`}
              </Pill>
              <p className="text-sm" style={{ color: "var(--color-muted)" }}>
                {score.silent
                  ? "Tap the mic and read it out loud."
                  : score.great
                    ? "That was clean."
                    : passed
                      ? "Good — the wavy words need another go."
                      : "Listen once more, then say it again."}
              </p>
            </div>
            {passed ? (
              <Button fullWidth size="lg" color="green" onClick={next}>
                Next sentence
              </Button>
            ) : (
              <>
                <Button
                  fullWidth
                  size="lg"
                  color="green"
                  onClick={() => {
                    speak(sentence);
                    setStage("listen");
                    setScore(null);
                  }}
                >
                  <Icon name="volume" size={22} strokeWidth={2.6} />
                  Hear it again
                </Button>
                <Button fullWidth size="md" variant="secondary" color="green" onClick={next}>
                  Skip this one
                </Button>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {canRecord ? (
              <Button fullWidth size="lg" color="coral" onClick={() => void listen()}>
                <Icon name="mic" size={22} strokeWidth={2.6} />
                {attempts > 0 ? "Say it again" : "My turn"}
              </Button>
            ) : null}
            <Button fullWidth size="md" variant="secondary" color="green" onClick={next}>
              I read it
            </Button>
          </div>
        )}
        {error ? (
          <p className="mt-3 text-sm" style={{ color: "var(--color-coral-dark)" }}>
            {error}
          </p>
        ) : null}
      </div>

      {/* The whole passage stays on screen with the current line marked. */}
      <div className="mt-7">
        <p
          className="mb-2 text-xs font-bold uppercase tracking-wide"
          style={{ color: "var(--color-muted)" }}
        >
          The whole story
        </p>
        <Passage
          text={text}
          glosses={glosses}
          highlight={sentence}
          onGlossTap={onGlossTap}
          className="opacity-90"
        />
      </div>

      <div className="mt-6">
        <Button fullWidth size="md" variant="secondary" color="green" onClick={finish}>
          Stop and answer the questions
        </Button>
      </div>
    </div>
  );
}

export { EchoReader };
