"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import AudioButton from "@/components/items/AudioButton";
import Card from "@/components/ui/Card";
import { fireConfetti } from "@/components/ui/Confetti";
import LessonComplete from "@/components/ui/LessonComplete";
import RunnerHeader from "@/components/ui/RunnerHeader";
import { mulberry32 } from "@/lib/math/rng";
import { postSession, saveNote } from "@/lib/offline-queue";
import { FALL_START_MS, blanksFor, letterChoices, nextFallMs } from "@/lib/rescue";
import type { Gained } from "@/lib/rewards";
import { sfx } from "@/lib/sfx";
import type { SessionResult } from "@/lib/types";

export type RescueWord = { word: string; clue: string; arabic: string };

type Status = "ready" | "falling" | "saved" | "splash" | "done";
type Outcome = { gained: Gained | null; ms: number; note?: string };

/** How long "Saved!" or "Splash!" stays before the next word. */
const PAUSE_MS = 1_700;

/**
 * Word rescue. A word floats down on a balloon with a letter or two missing;
 * he taps the missing letters, left to right, before it reaches the water.
 * The meaning is on screen and the word can be heard at any time. A wrong
 * tap only wiggles; a word that lands shows itself whole and play goes on.
 */
export default function RescueRunner({
  words,
  seed,
  sessionRef,
  listId,
  againHref,
}: {
  words: RescueWord[];
  seed: number;
  sessionRef: string;
  listId?: string;
  againHref: string;
}) {
  const router = useRouter();
  const puzzles = useMemo(() => {
    const rng = mulberry32(seed % 2147483647);
    return words.map((w) => {
      const blanks = blanksFor(w.word, rng);
      return { ...w, blanks, choices: blanks.map((i) => letterChoices(w.word[i], rng)) };
    });
  }, [words, seed]);

  const [idx, setIdx] = useState(0);
  const [filled, setFilled] = useState(0);
  const [status, setStatus] = useState<Status>("ready");
  const [progress, setProgress] = useState(0);
  const [fallMs, setFallMs] = useState(FALL_START_MS);
  const [saved, setSaved] = useState(0);
  const [clean, setClean] = useState(0);
  const [wiggle, setWiggle] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const startedAt = useRef(0);
  const fallStart = useRef(0);
  const missedThisWord = useRef(false);

  const puzzle = puzzles[idx];

  // The fall. One element moves, so a state update a frame is cheap.
  useEffect(() => {
    if (status !== "falling") return;
    let frame = 0;
    const tick = () => {
      const p = Math.min(1, (performance.now() - fallStart.current) / fallMs);
      setProgress(p);
      if (p >= 1) {
        setStatus("splash");
        setFallMs((ms) => nextFallMs(ms, false));
        sfx.wrong();
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [status, fallMs, idx]);

  const next = useCallback(() => {
    if (idx + 1 >= puzzles.length) {
      setStatus("done");
      return;
    }
    setIdx((i) => i + 1);
    setFilled(0);
    setProgress(0);
    missedThisWord.current = false;
    fallStart.current = performance.now();
    setStatus("falling");
  }, [idx, puzzles.length]);

  // After "Saved!" or "Splash!", the next word.
  useEffect(() => {
    if (status !== "saved" && status !== "splash") return;
    const t = setTimeout(next, PAUSE_MS);
    return () => clearTimeout(t);
  }, [status, next]);

  // The round is over: post it once.
  const posted = useRef(false);
  useEffect(() => {
    if (status !== "done" || posted.current) return;
    posted.current = true;
    const ms = Date.now() - startedAt.current;
    const result: SessionResult = {
      kind: "vocab",
      ref: sessionRef,
      answered: puzzles.length,
      correct: saved,
      fastCount: 0,
      ms,
      perfect: puzzles.length > 0 && clean === puzzles.length,
      ...(listId ? { listId } : {}),
    };
    if (saved > 0) void fireConfetti(saved === puzzles.length ? "big" : "small");
    void postSession(result).then((res) =>
      setOutcome({ gained: res.saved ? res.gained : null, ms, note: saveNote(res) })
    );
  }, [status, puzzles.length, saved, clean, sessionRef, listId]);

  function start() {
    sfx.tap();
    startedAt.current = Date.now();
    fallStart.current = performance.now();
    setStatus("falling");
  }

  function tap(letter: string) {
    if (status !== "falling" || !puzzle) return;
    const want = puzzle.word[puzzle.blanks[filled]].toLowerCase();
    if (letter !== want) {
      missedThisWord.current = true;
      setWiggle(letter);
      setTimeout(() => setWiggle(null), 400);
      sfx.tap();
      return;
    }
    const nowFilled = filled + 1;
    setFilled(nowFilled);
    if (nowFilled < puzzle.blanks.length) {
      sfx.tap();
      return;
    }
    setStatus("saved");
    setSaved((n) => n + 1);
    if (!missedThisWord.current) setClean((n) => n + 1);
    setFallMs((ms) => nextFallMs(ms, true));
    sfx.correct();
  }

  if (puzzles.length === 0) {
    return (
      <div className="safe-top min-h-dvh px-4">
        <RunnerHeader href="/drill" value={0} color="blue" />
        <Card className="mt-6 text-center">
          <p className="font-display text-lg font-bold">No words to rescue here.</p>
          <p className="mt-1 text-sm" style={{ color: "var(--color-muted)" }}>
            Pick other words on the Drill tab.
          </p>
        </Card>
      </div>
    );
  }

  if (status === "done") {
    if (!outcome) {
      return (
        <main className="flex min-h-dvh items-center justify-center px-6 text-center">
          <p className="font-display text-lg font-bold">Saving…</p>
        </main>
      );
    }
    return (
      <LessonComplete
        title={saved === puzzles.length ? "Every word rescued!" : "Rescue done!"}
        subtitle={`You saved ${saved} of ${puzzles.length} words.`}
        xp={outcome.gained?.xp ?? 0}
        ms={outcome.ms}
        accuracy={saved / puzzles.length}
        perfect={clean === puzzles.length}
        leveledUp={outcome.gained?.leveledUp}
        newBadge={
          outcome.gained?.newBadges[0]
            ? { ...outcome.gained.newBadges[0] }
            : null
        }
        primary={{ label: "Play again", onClick: () => router.push(`${againHref}&seed=${Date.now()}`) }}
        secondary={{ label: "All drills", href: "/drill" }}
        note={outcome.note}
      />
    );
  }

  const shownWhole = status === "saved" || status === "splash";
  // Long words get narrower tiles so "adaptation" still fits a phone.
  const letterCount = puzzle.word.length;
  const tileSize =
    letterCount > 11 ? "h-9 w-5 text-lg" : letterCount > 7 ? "h-10 w-[26px] text-xl" : "h-11 w-8 text-2xl";
  const activeBlank = puzzle.blanks[filled];

  return (
    <div className="safe-top min-h-dvh pb-8">
      <RunnerHeader
        href="/drill"
        value={idx / puzzles.length}
        color="blue"
        label="Words rescued"
        right={
          <span className="font-display text-sm font-bold" style={{ color: "var(--color-blue-dark)" }}>
            {saved} saved
          </span>
        }
      />

      <div className="px-4">
        {/* The meaning and the sound: the clues he rescues the word with. */}
        <Card className="flex items-center gap-3">
          {/* Says each new word as it starts to fall: hearing it is half the clue. */}
          <AudioButton
            key={`${idx}:${status === "ready" ? "ready" : "go"}`}
            text={puzzle.word}
            size={52}
            autoPlay={status !== "ready"}
            label="Hear the word"
          />
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>
              It means
            </p>
            <p className="font-body text-base font-bold leading-snug">{puzzle.clue || "Listen, then fill the gap."}</p>
          </div>
        </Card>

        {/* The sky, the falling word, the water. */}
        <div
          // Shorter on a short phone, so the letter tiles below stay on screen.
          className="relative mt-3 h-[min(300px,42dvh)] overflow-hidden rounded-hero"
          style={{ background: "linear-gradient(#cfe6ff, #eef6ff)" }}
        >
          <div
            className="absolute inset-x-0 flex flex-col items-center"
            style={{
              top: `calc(${status === "saved" ? 0 : progress} * (100% - 150px))`,
              transition: status === "saved" ? "top 700ms ease-out" : undefined,
            }}
          >
            <svg viewBox="0 0 60 70" width="54" height="63" aria-hidden className={status === "saved" ? "q-pop" : ""}>
              <ellipse cx="30" cy="26" rx="22" ry="25" fill={status === "splash" ? "var(--color-faint)" : "var(--color-coral)"} />
              <ellipse cx="22" cy="17" rx="5" ry="8" fill="#fff" opacity="0.5" />
              <path d="M30 51 l-3 5 h6 z" fill={status === "splash" ? "var(--color-faint)" : "var(--color-coral)"} />
              <path d="M30 56 v14" stroke="var(--color-ink)" strokeWidth="1.5" />
            </svg>
            <div
              className={`flex rounded-tile bg-white py-2 shadow-lift ${letterCount > 7 ? "gap-0.5 px-1.5" : "gap-1 px-2"} ${status === "splash" ? "opacity-70" : ""}`}
            >
              {[...puzzle.word].map((ch, i) => {
                const blankAt = puzzle.blanks.indexOf(i);
                const isBlank = blankAt >= 0;
                const shown = !isBlank || blankAt < filled || shownWhole;
                if (ch === " ") return <span key={i} className="w-3" />;
                return (
                  <span
                    key={i}
                    className={`flex ${tileSize} items-center justify-center rounded-lg font-display font-bold lowercase ${
                      isBlank && blankAt < filled ? "q-pop" : ""
                    }`}
                    style={{
                      background: isBlank ? (shown ? "var(--color-green-soft)" : "var(--color-blue-soft)") : "transparent",
                      border: isBlank && !shown ? `2px dashed ${i === activeBlank ? "var(--color-blue)" : "var(--color-line)"}` : "2px solid transparent",
                      color: isBlank && status === "splash" && blankAt >= filled ? "var(--color-coral-dark)" : "var(--color-ink)",
                    }}
                  >
                    {shown ? ch : ""}
                  </span>
                );
              })}
            </div>
          </div>

          {status === "saved" ? (
            <p className="q-bounce-in absolute inset-x-0 bottom-14 text-center font-display text-3xl font-bold" style={{ color: "var(--color-green-dark)" }}>
              Saved!
            </p>
          ) : null}
          {status === "splash" ? (
            <p className="q-bounce-in absolute inset-x-0 top-5 px-4 text-center font-display text-2xl font-bold" style={{ color: "var(--color-blue-dark)" }}>
              Splash! It was “{puzzle.word}”.
            </p>
          ) : null}

          <svg className="absolute inset-x-0 bottom-0" viewBox="0 0 400 48" preserveAspectRatio="none" width="100%" height="48" aria-hidden>
            <path d="M0 14 q25 -12 50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 V48 H0 z" fill="#5aa9f2" />
            <path d="M0 24 q25 -10 50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 t50 0 V48 H0 z" fill="#3b7de0" />
          </svg>

          {status === "ready" ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/70 px-6 text-center">
              <p className="font-display text-2xl font-bold">Word rescue</p>
              <p className="text-base">
                Tap the missing letters before the balloon reaches the water!
              </p>
              <button
                type="button"
                onClick={start}
                className="btn-3d min-h-[56px] rounded-full px-8 font-display text-lg font-bold uppercase"
                style={{ background: "var(--color-green)", color: "#fff", ["--btn-shade" as string]: "var(--color-green-dark)" }}
              >
                Start
              </button>
            </div>
          ) : null}
        </div>

        {/* The letters. Big tiles, four only. */}
        <div className="mt-4 grid grid-cols-4 gap-3" aria-label="Pick the missing letter">
          {(status === "falling" ? puzzle.choices[filled] : puzzle.choices[Math.min(filled, puzzle.choices.length - 1)]).map((letter) => (
            <button
              key={`${idx}-${filled}-${letter}`}
              type="button"
              disabled={status !== "falling"}
              onClick={() => tap(letter)}
              className={`btn-3d flex h-16 items-center justify-center rounded-tile border-2 bg-white font-display text-3xl font-bold lowercase disabled:opacity-40 ${
                wiggle === letter ? "q-shake" : ""
              }`}
              style={{ borderColor: "var(--color-line)", ["--btn-shade" as string]: "var(--color-line)", color: "var(--color-ink)" }}
            >
              {letter}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
