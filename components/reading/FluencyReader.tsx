"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import AudioButton from "@/components/items/AudioButton";
import PetSprite from "@/components/pet/PetSprite";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { fireConfetti } from "@/components/ui/Confetti";
import Icon from "@/components/ui/Icon";
import ProgressBar from "@/components/ui/ProgressBar";
import { fluencyHeadline, fluencyPart, scoreFluency, type FluencyResult } from "@/lib/fluency";
import { learnerFromCookie } from "@/lib/learners";
import { wpmNormForDate } from "@/lib/reading";
import { sfx } from "@/lib/sfx";
import { isRecordingSupported, recordAudio, type Recording } from "@/lib/voice";

/** Past this the recording stops by itself: the part is a minute of reading. */
const MAX_RECORD_MS = 3 * 60 * 1000;

type Stage = "ready" | "recording" | "checking" | "result";

/**
 * His read-aloud record, per child, on this phone. Kept apart from the silent
 * reading timer's rate: that one counts every word, this one only the words
 * read right, and mixing them would set a record he could never beat.
 */
function bestKey(): string {
  const who = typeof document === "undefined" ? null : learnerFromCookie(document.cookie);
  return `quest:fluency-best:${who ?? "me"}`;
}

function readBest(): number | null {
  try {
    const n = Number(window.localStorage.getItem(bestKey()));
    return n > 0 ? n : null;
  } catch {
    return null;
  }
}

function writeBest(n: number): void {
  try {
    window.localStorage.setItem(bestKey(), String(n));
  } catch {
    // Private mode: the record lasts this visit.
  }
}

const noSubscribe = () => () => {};

const HEADLINES = {
  first: "Your first record!",
  record: "New record!",
  close: "So close to your record!",
  good: "Great reading!",
} as const;

/**
 * Read one part of the passage out loud to Sparky, then see words correct per
 * minute against his own best. No clock on screen while he reads: the point
 * is reading well, and a ticking number makes a hard thing harder.
 *
 * `onFinish` gets the best score of this visit (null if none was scored).
 */
export default function FluencyReader({
  text,
  onFinish,
}: {
  text: string;
  onFinish: (wcpm: number | null) => void;
}) {
  const part = useMemo(() => fluencyPart(text), [text]);
  const [stage, setStage] = useState<Stage>("ready");
  const [result, setResult] = useState<FluencyResult | null>(null);
  const stored = useSyncExternalStore(noSubscribe, readBest, () => null);
  const [beaten, setBeaten] = useState<number | null>(null);
  const record = Math.max(stored ?? 0, beaten ?? 0) || null;
  const [bestToday, setBestToday] = useState<number | null>(null);
  const [headline, setHeadline] = useState<keyof typeof HEADLINES>("good");
  const [error, setError] = useState<string | null>(null);
  const recordingRef = useRef<Recording | null>(null);
  const startedRef = useRef(0);
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Leaving mid-read must not leave the mic on.
  useEffect(
    () => () => {
      recordingRef.current?.cancel();
      if (autoStopRef.current) clearTimeout(autoStopRef.current);
    },
    []
  );

  async function start() {
    setError(null);
    setResult(null);
    if (!isRecordingSupported()) {
      setError("This phone can't record here. Try one of the other ways to read.");
      return;
    }
    try {
      recordingRef.current = await recordAudio();
    } catch {
      setError("I can't reach the microphone. Allow it, then tap Start again.");
      return;
    }
    sfx.tap();
    startedRef.current = Date.now();
    setStage("recording");
    autoStopRef.current = setTimeout(() => void finish(), MAX_RECORD_MS);
  }

  async function finish() {
    if (autoStopRef.current) clearTimeout(autoStopRef.current);
    const rec = recordingRef.current;
    recordingRef.current = null;
    if (!rec) return;
    const ms = Date.now() - startedRef.current;
    setStage("checking");
    const blob = await rec.stop();
    let heard = "";
    if (blob) {
      try {
        const form = new FormData();
        // Whisper picks the container off the file name, and Safari records mp4.
        form.append("audio", blob, `read.${blob.type.includes("mp4") ? "mp4" : "webm"}`);
        form.append("language", "en");
        const res = await fetch("/api/transcribe", { method: "POST", body: form });
        const data = (await res.json().catch(() => ({}))) as { text?: unknown };
        if (!res.ok) {
          setError("I couldn't hear that one. Check the internet, then try again.");
          setStage("ready");
          return;
        }
        heard = String(data.text ?? "");
      } catch {
        setError("I couldn't hear that one. Check the internet, then try again.");
        setStage("ready");
        return;
      }
    }
    const scored = scoreFluency(part, heard, ms);
    setResult(scored);
    setStage("result");
    if (!scored.heardEnough) return;

    const next = fluencyHeadline(scored.wcpm, record);
    setHeadline(next);
    if (next === "record" || next === "first") {
      sfx.levelUp();
      void fireConfetti(next === "record" ? "big" : "small");
    } else {
      sfx.correct();
    }
    if (scored.wcpm > (record ?? 0)) {
      writeBest(scored.wcpm);
      setBeaten(scored.wcpm);
    }
    setBestToday((b) => Math.max(b ?? 0, scored.wcpm));
  }

  const norm = wpmNormForDate();

  return (
    <div className="px-4 pb-10">
      {stage === "result" && result ? (
        result.heardEnough ? (
          <Card className="text-center">
            <p className="font-display text-2xl font-bold" style={{ color: "var(--color-green-dark)" }}>
              {HEADLINES[headline]}
            </p>
            <p className="mt-2 font-display text-5xl font-bold leading-none">{result.wcpm}</p>
            <p className="mt-1 text-sm font-bold uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>
              words a minute
            </p>
            <p className="mt-3 text-base">
              You read <strong>{result.correct}</strong> of {result.total} words clearly.
            </p>
            {record ? (
              <p className="mt-1 text-sm" style={{ color: "var(--color-muted)" }}>
                Your best: {record}
              </p>
            ) : null}
            <div className="mt-4 text-left">
              <ProgressBar value={result.wcpm / norm} color="blue" height={10} label="Towards the Grade 4 goal" />
              <p className="mt-1 text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>
                Grade 4 goal: {norm} a minute. Every read gets you closer.
              </p>
            </div>
            {result.tricky.length > 0 ? (
              <div className="mt-5 text-left">
                <p className="font-display text-base font-bold">Words to practise</p>
                <p className="text-sm" style={{ color: "var(--color-muted)" }}>
                  Tap to hear them, then say them out loud.
                </p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {result.tricky.map((w) => (
                    <li
                      key={w}
                      className="flex items-center gap-2 rounded-full py-1 pr-3 pl-1"
                      style={{ background: "var(--color-blue-soft)" }}
                    >
                      <AudioButton text={w} size={40} label={`Hear ${w}`} />
                      <span className="font-display text-lg font-bold">{w}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="mt-4 font-display font-bold" style={{ color: "var(--color-green-dark)" }}>
                Every word, clear as a bell!
              </p>
            )}
          </Card>
        ) : (
          <Card className="text-center">
            <p className="font-display text-xl font-bold">I couldn&rsquo;t hear much that time.</p>
            <p className="mt-2 text-base" style={{ color: "var(--color-muted)" }}>
              Hold the phone a little closer and read in your big voice.
            </p>
          </Card>
        )
      ) : (
        <>
          <div className="flex items-center gap-3">
            <span className={stage === "recording" ? "q-float block" : "block"}>
              <PetSprite stage="teen" mood={stage === "recording" ? "happy" : "proud"} size={72} />
            </span>
            <p
              className="flex-1 rounded-tile px-3 py-2 text-sm font-bold"
              style={{ background: "var(--color-green-soft)", color: "var(--color-green-dark)" }}
              aria-live="polite"
            >
              {stage === "recording"
                ? "I'm listening! Take your time. Tap Done at the end."
                : stage === "checking"
                  ? "Let me count your words…"
                  : "Read this part out loud to me. Reading well beats reading fast!"}
            </p>
          </div>
          <Card className="mt-4">
            {part.split(/\n\s*\n/).map((p, i) => (
              <p key={i} className="mt-2 font-body text-xl leading-relaxed first:mt-0">
                {p}
              </p>
            ))}
          </Card>
        </>
      )}

      {error ? (
        <p className="mt-3 text-sm font-bold" role="alert" style={{ color: "var(--color-coral-dark)" }}>
          {error}
        </p>
      ) : null}

      <div className="mt-5 space-y-3">
        {stage === "ready" ? (
          <Button fullWidth size="lg" color="green" onClick={() => void start()}>
            <Icon name="mic" size={22} />
            Start reading
          </Button>
        ) : null}
        {stage === "recording" ? (
          <Button fullWidth size="lg" color="blue" onClick={() => void finish()}>
            <Icon name="check" size={22} />
            Done
          </Button>
        ) : null}
        {stage === "checking" ? (
          <Button fullWidth size="lg" color="blue" disabled>
            Counting…
          </Button>
        ) : null}
        {stage === "result" ? (
          <Button fullWidth size="lg" color="green" onClick={() => void start()}>
            <Icon name="mic" size={22} />
            {result?.heardEnough ? "Read it again" : "Try again"}
          </Button>
        ) : null}
        {stage !== "recording" && stage !== "checking" ? (
          <Button
            fullWidth
            size="lg"
            variant="secondary"
            color="green"
            onClick={() => onFinish(bestToday)}
          >
            {stage === "result" ? "On to the questions" : "Skip to the questions"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
