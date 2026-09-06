"use client";

import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Icon from "@/components/ui/Icon";
import LessonComplete from "@/components/ui/LessonComplete";
import ProgressBar from "@/components/ui/ProgressBar";
import { mulberry32 } from "@/lib/math/rng";
import { postSession, saveNote } from "@/lib/offline-queue";
import { clearProgress, resumeKey, saveProgress } from "@/lib/resume";
import { useSavedRun } from "@/components/ui/useSavedRun";
import { sfx } from "@/lib/sfx";
import {
  structureSession,
  TEXT_STRUCTURES,
  findSignalWords,
  structureById,
  type TextStructureId,
} from "@/lib/text-structure";
import { startStopwatch, type Stopwatch } from "@/lib/time-on-task";

export type StructureRunnerProps = {
  /** Server-minted seed. Same seed = same answer options, and the Again link. */
  seed: number;
};

type Phase = "intro" | "play" | "done";

/** The passage text with its signal words marked. Sliced by index, no HTML. */
function SignalText({
  text,
  signalWords,
}: {
  text: string;
  signalWords: readonly string[];
}) {
  const matches = findSignalWords(text, signalWords);
  const parts: ReactNode[] = [];
  let cursor = 0;
  for (const m of matches) {
    if (m.index < cursor) continue;
    if (m.index > cursor) {
      parts.push(<Fragment key={`t${cursor}`}>{text.slice(cursor, m.index)}</Fragment>);
    }
    parts.push(
      <mark
        key={`m${m.index}`}
        className="rounded px-1 font-bold"
        style={{ background: "var(--color-gold-soft)", color: "var(--color-ink)" }}
      >
        {text.slice(m.index, m.index + m.length)}
      </mark>
    );
    cursor = m.index + m.length;
  }
  parts.push(<Fragment key={`t${cursor}`}>{text.slice(cursor)}</Fragment>);
  return <p className="rounded-tile px-2 py-1 text-[19px] leading-[1.7]">{parts}</p>;
}

/**
 * Where he was: which passage, which he has missed, and the seed that built
 * the session — the page mints a new seed per request, so without it a
 * reload would deal a different set of passages.
 */
type Saved = { seed: number; idx: number; missed: boolean[] };

function isSaved(v: unknown): v is Saved {
  if (typeof v !== "object" || v === null) return false;
  const o = v as { seed?: unknown; idx?: unknown; missed?: unknown };
  return (
    typeof o.seed === "number" &&
    typeof o.idx === "number" &&
    Array.isArray(o.missed) &&
    o.missed.every((b) => typeof b === "boolean")
  );
}

export default function StructureRunner(props: StructureRunnerProps) {
  const key = resumeKey("structure", "lesson", "current");
  const saved = useSavedRun(key, isSaved);
  return <StructureRunnerInner key={saved ? "resumed" : "fresh"} {...props} saveKey={key} initial={saved} />;
}

function StructureRunnerInner({
  seed: freshSeed,
  saveKey,
  initial,
}: StructureRunnerProps & { saveKey: string; initial: Saved | null }) {
  // A resumed run keeps the seed that dealt its passages.
  const seed = initial ? initial.seed : freshSeed;
  // Same seed on the server and here, so the options never jump on hydration.
  // The seed changes every visit, so the passages and their order do too —
  // walking the five in declaration order taught him the positions, not the
  // structures. See structureSession().
  const rounds = useMemo(
    () => structureSession(mulberry32(seed % 2147483647)),
    [seed]
  );

  // A saved run skips the intro: he has read it and was mid-lesson.
  const [phase, setPhase] = useState<Phase>(initial ? "play" : "intro");
  const [idx, setIdx] = useState(initial ? initial.idx : 0);
  /** Passages he missed on the first try. */
  const [missed, setMissed] = useState<boolean[]>(() =>
    initial && initial.missed.length === rounds.length ? initial.missed : rounds.map(() => false)
  );
  const [solved, setSolved] = useState(false);
  /** His last wrong pick — drives the "see the difference" panel. */
  const [picked, setPicked] = useState<TextStructureId | null>(null);
  const [shake, setShake] = useState(false);

  // Time on task, same stopwatch the other runners use.
  const watch = useRef<Stopwatch | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const savedRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const [gainedXp, setGainedXp] = useState(0);
  const [queuedNote, setQueuedNote] = useState<string | undefined>(undefined);

  const firstTry = missed.filter((m) => !m).length;
  const perfect = firstTry === rounds.length;

  function choose(id: TextStructureId) {
    if (solved) return;
    watch.current?.mark();
    if (id === rounds[idx].choices.answer) {
      setSolved(true);
      setPicked(null);
      sfx.correct();
    } else {
      setPicked(id);
      setMissed((m) => {
        const next = m.map((v, i) => (i === idx ? true : v));
        saveProgress(saveKey, { seed, idx, missed: next });
        return next;
      });
      sfx.wrong();
      setShake(true);
      setTimeout(() => setShake(false), 420);
    }
  }

  function next() {
    watch.current?.mark();
    if (idx + 1 < rounds.length) {
      setIdx(idx + 1);
      setSolved(false);
      setPicked(null);
      saveProgress(saveKey, { seed, idx: idx + 1, missed });
    } else {
      clearProgress(saveKey);
      setElapsedMs(watch.current?.read() ?? 0);
      setPhase("done");
    }
  }

  // One session at the end, posted the way ReadingRunner does it.
  useEffect(() => {
    if (phase !== "done" || savedRef.current) return;
    savedRef.current = true;
    void (async () => {
      setSaving(true);
      try {
        const posted = await postSession({
          kind: "reading",
          ref: "read:structure",
          answered: rounds.length,
          correct: firstTry,
          fastCount: 0,
          ms: elapsedMs,
          perfect,
        });
        if (posted.saved) setGainedXp(posted.gained.xp);
        else setQueuedNote(saveNote(posted));
      } finally {
        setSaving(false);
      }
    })();
  }, [phase, rounds.length, firstTry, perfect, elapsedMs]);

  // ── Screens ─────────────────────────────────────────────────────────────

  if (phase === "done") {
    return (
      <LessonComplete
        title={perfect ? "Every one right." : "Structures done."}
        subtitle={`You spotted ${firstTry} of ${rounds.length} on the first try.`}
        xp={gainedXp}
        ms={elapsedMs}
        accuracy={rounds.length ? firstTry / rounds.length : 0}
        perfect={perfect}
        note={saving ? "Saving…" : queuedNote}
        primary={{ label: "Back to Learn", href: "/" }}
        secondary={{ label: "Again", href: `/learn/structure?r=${seed}` }}
      />
    );
  }

  if (phase === "intro") {
    return (
      <div className="space-y-5 px-4 py-8">
        <h1 className="font-display text-3xl font-bold">Text structure</h1>
        <p className="text-base" style={{ color: "var(--color-muted)" }}>
          Nonfiction is built in five shapes. Read each passage. Ask yourself:
          how is it built?
        </p>
        <Card className="space-y-3">
          {TEXT_STRUCTURES.map((s) => (
            <div key={s.id} className="flex items-start gap-2">
              <span className="mt-1 shrink-0" style={{ color: "var(--color-green)" }}>
                <Icon name="book" size={16} />
              </span>
              <div className="min-w-0">
                <p className="font-display text-base font-bold">{s.name}</p>
                <p className="text-sm" style={{ color: "var(--color-muted)" }}>
                  {s.question}
                </p>
              </div>
            </div>
          ))}
        </Card>
        <Button
          fullWidth
          size="lg"
          color="green"
          onClick={() => {
            watch.current = startStopwatch();
            setPhase("play");
          }}
        >
          Start
        </Button>
      </div>
    );
  }

  const round = rounds[idx];
  const right = structureById(round.choices.answer);
  const wrong = picked ? structureById(picked) : null;

  return (
    <div className="px-4 pb-10 pt-4">
      <ProgressBar
        value={(idx + (solved ? 1 : 0)) / rounds.length}
        color="green"
        label="Passages"
        className="mb-4"
      />

      <p
        className="text-xs font-bold uppercase tracking-wide"
        style={{ color: "var(--color-muted)" }}
      >
        Passage {idx + 1} of {rounds.length}
      </p>
      <h1 className="mt-1 font-display text-2xl font-bold">{round.passage.title}</h1>

      <div className="mt-3">
        {solved ? (
          <SignalText text={round.passage.text} signalWords={round.passage.signalWords} />
        ) : (
          <p className="rounded-tile px-2 py-1 text-[19px] leading-[1.7]">
            {round.passage.text}
          </p>
        )}
      </div>

      <Card className={`mt-5 ${shake ? "q-shake" : ""}`}>
        {solved ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
                style={{ background: "var(--color-green)", color: "#fff" }}
              >
                <Icon name="check" size={24} strokeWidth={3} />
              </span>
              <div className="min-w-0">
                <p className="font-display text-lg font-bold">
                  That&rsquo;s it. {right.name}.
                </p>
                <p className="text-sm" style={{ color: "var(--color-muted)" }}>
                  {right.question} Yes. The signal words are marked in the
                  passage above.
                </p>
              </div>
            </div>

            <div
              className="rounded-tile px-3 py-3"
              style={{ background: "var(--color-green-soft)" }}
            >
              <p
                className="text-xs font-bold uppercase tracking-wide"
                style={{ color: "var(--color-green-dark)" }}
              >
                How you write one of these
              </p>
              <ol className="mt-2 space-y-1.5">
                {right.frame.map((slot, i) => (
                  <li key={slot} className="flex items-center gap-2">
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-display text-xs font-bold"
                      style={{ background: "#fff", color: "var(--color-green-dark)" }}
                    >
                      {i + 1}
                    </span>
                    <span className="text-base">{slot}</span>
                  </li>
                ))}
              </ol>
            </div>

            <Button fullWidth size="lg" color="green" onClick={next}>
              {idx + 1 < rounds.length ? "Next passage" : "Finish"}
            </Button>
          </div>
        ) : (
          <>
            <p className="text-[19px] font-bold leading-snug">
              What structure is this?
            </p>
            <ul className="mt-4 space-y-2">
              {round.choices.options.map((opt) => (
                <li key={opt.id}>
                  <button
                    type="button"
                    onClick={() => choose(opt.id)}
                    className="press-3d w-full rounded-tile border-2 px-4 py-3 text-left text-base"
                    style={{
                      borderColor:
                        picked === opt.id ? "var(--color-coral)" : "var(--color-line)",
                      background: "#fff",
                    }}
                  >
                    {opt.name}
                  </button>
                </li>
              ))}
            </ul>

            {wrong ? (
              <div
                className="mt-4 rounded-tile px-3 py-3"
                style={{ background: "var(--color-coral-soft)" }}
              >
                <p
                  className="text-xs font-bold uppercase tracking-wide"
                  style={{ color: "var(--color-coral-dark)" }}
                >
                  Not this one
                </p>
                <p className="mt-1 text-base">
                  <strong>{wrong.name}</strong> asks: {wrong.question}
                </p>
                <p className="mt-2 text-base">
                  This passage answers: <strong>{right.question}</strong>
                </p>
                <p className="mt-2 text-sm" style={{ color: "var(--color-muted)" }}>
                  Read it again. Which structure asks that question?
                </p>
              </div>
            ) : null}
          </>
        )}
      </Card>
    </div>
  );
}

export { StructureRunner };
