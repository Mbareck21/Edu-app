"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Icon from "@/components/ui/Icon";
import LessonComplete from "@/components/ui/LessonComplete";
import ProgressRing from "@/components/ui/ProgressRing";
import RunnerHeader from "@/components/ui/RunnerHeader";
import { fireConfetti } from "@/components/ui/Confetti";
import { normalizeAnswer } from "@/lib/items";
import { postSession } from "@/lib/offline-queue";
import { XP, type Gained } from "@/lib/rewards";
import { sfx } from "@/lib/sfx";
import type { SessionResult, WordResult } from "@/lib/types";

/** Seconds on the clock. */
export const REMEMBER_SECONDS = 90;

export type RememberRunnerProps = {
  listId: string;
  listName: string;
  words: string[];
  sessionRef: string;
  againHref: string;
};

type Phase = "ready" | "go" | "done";
type Outcome = { gained: Gained | null; saved: boolean; ms: number };

/**
 * Write what you remember: 90 seconds, one box, every word from the list that
 * he can pull out of his head. Recalled words count as a `use` win; the rest
 * come back due now.
 */
export default function RememberRunner({
  listId,
  listName,
  words,
  sessionRef,
  againHref,
}: RememberRunnerProps) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("ready");
  const [left, setLeft] = useState(REMEMBER_SECONDS);
  const [typed, setTyped] = useState("");
  const [found, setFound] = useState<string[]>([]);
  const [float, setFloat] = useState(0);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const startedAt = useRef(0);
  const posted = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const keyed = new Map(words.map((w) => [normalizeAnswer(w), w]));
  const missed = words.filter((w) => !found.includes(w));

  const finish = useCallback(() => {
    setPhase("done");
  }, []);

  useEffect(() => {
    if (phase !== "go") return;
    const id = setInterval(() => {
      const gone = Math.floor((Date.now() - startedAt.current) / 1000);
      const remaining = Math.max(0, REMEMBER_SECONDS - gone);
      setLeft(remaining);
      if (remaining === 0) finish();
    }, 250);
    return () => clearInterval(id);
  }, [phase, finish]);

  useEffect(() => {
    if (phase !== "done" || posted.current) return;
    posted.current = true;
    const ms = Date.now() - startedAt.current;
    const wordResults: WordResult[] = words.map((w) => ({
      word: w,
      skill: "use",
      correct: found.includes(w),
    }));
    const result: SessionResult = {
      kind: "vocab",
      ref: sessionRef,
      answered: words.length,
      correct: found.length,
      fastCount: 0,
      ms,
      perfect: words.length > 0 && found.length === words.length,
      listId,
      wordResults,
    };
    if (found.length > 0) void fireConfetti("small");
    void postSession(result).then((res) => {
      setOutcome({ gained: res.saved ? res.gained : null, saved: res.saved, ms });
    });
  }, [phase, found, words, listId, sessionRef]);

  function start() {
    startedAt.current = Date.now();
    setLeft(REMEMBER_SECONDS);
    setPhase("go");
    sfx.tap();
    // Focus has to wait for the input to exist.
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function onType(value: string) {
    const hit = keyed.get(normalizeAnswer(value));
    if (hit && !found.includes(hit)) {
      setFound((f) => [...f, hit]);
      setFloat((n) => n + 1);
      setTyped("");
      sfx.correct();
      return;
    }
    setTyped(value);
  }

  if (phase === "ready") {
    return (
      <div className="safe-top safe-bottom min-h-dvh px-4">
        <RunnerHeader href="/drill" value={0} color="blue" label="Ready" />
        <Card className="mt-6 space-y-3 text-center">
          <span
            className="inline-flex h-16 w-16 items-center justify-center rounded-full"
            style={{ background: "var(--color-blue-soft)", color: "var(--color-blue)" }}
          >
            <Icon name="clock" size={34} />
          </span>
          <h1 className="font-display text-2xl font-bold">Write what you remember</h1>
          <p className="font-body text-[15px] leading-snug">
            {REMEMBER_SECONDS} seconds. Type every word you remember from{" "}
            <strong>{listName}</strong>. One word at a time.
          </p>
          <p className="font-body text-sm" style={{ color: "var(--color-muted)" }}>
            {words.length} words on this list.
          </p>
          <Button color="blue" size="lg" fullWidth onClick={start}>
            Start
          </Button>
        </Card>
      </div>
    );
  }

  if (phase === "done") {
    if (!outcome) {
      return (
        <div className="safe-top safe-bottom flex min-h-dvh items-center justify-center px-4">
          <Card className="w-full text-center">
            <p className="font-display text-lg font-bold">Saving your work…</p>
          </Card>
        </div>
      );
    }
    const badge = outcome.gained?.newBadges[0];
    return (
      <div className="safe-top safe-bottom min-h-dvh px-4">
        <Card className="mt-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="font-display text-sm font-bold" style={{ color: "var(--color-green-dark)" }}>
                You wrote {found.length}
              </p>
              <ul className="mt-1.5 space-y-1">
                {found.map((w) => (
                  <li
                    key={w}
                    className="rounded-tile px-2 py-1 font-display text-[15px] font-bold lowercase"
                    style={{ background: "var(--color-green-soft)", color: "var(--color-green-dark)" }}
                  >
                    {w}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-display text-sm font-bold" style={{ color: "var(--color-coral-dark)" }}>
                Still to learn {missed.length}
              </p>
              <ul className="mt-1.5 space-y-1">
                {missed.map((w) => (
                  <li
                    key={w}
                    className="rounded-tile px-2 py-1 font-display text-[15px] font-bold lowercase"
                    style={{ background: "var(--color-sand)" }}
                  >
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
        <LessonComplete
          title="Time!"
          subtitle={`${found.length} of ${words.length} words from memory.`}
          xp={outcome.gained?.xp ?? 0}
          ms={outcome.ms}
          accuracy={words.length === 0 ? 0 : found.length / words.length}
          perfect={words.length > 0 && found.length === words.length}
          leveledUp={outcome.gained?.leveledUp}
          newBadge={badge ? { name: badge.name, blurb: badge.blurb, icon: badge.icon } : null}
          primary={{ label: "Again", onClick: () => router.push(`${againHref}&seed=${Date.now()}`) }}
          secondary={{ label: "All drills", href: "/drill" }}
          note={outcome.saved ? undefined : "No internet. Saved on this phone for later."}
        />
      </div>
    );
  }

  return (
    <div className="safe-top min-h-dvh px-4 pb-8">
      <RunnerHeader
        href="/drill"
        value={found.length / Math.max(1, words.length)}
        color="blue"
        label="Words found"
      />

      <div className="flex flex-col items-center pt-2">
        <ProgressRing value={left / REMEMBER_SECONDS} size={104} stroke={10} color="blue">
          <span className="font-display text-3xl font-bold">{left}</span>
          <span className="font-body text-xs" style={{ color: "var(--color-muted)" }}>
            seconds
          </span>
        </ProgressRing>
      </div>

      <div className="relative mt-4">
        <input
          ref={inputRef}
          value={typed}
          onChange={(e) => onType(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              setTyped("");
            }
          }}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          enterKeyHint="done"
          aria-label="Type a word you remember"
          placeholder="type a word"
          className="w-full rounded-card border-2 bg-white px-4 py-4 text-center font-display text-2xl font-bold lowercase outline-none"
          style={{ borderColor: "var(--color-blue)", minHeight: 64 }}
        />
        {float > 0 ? (
          <span
            key={float}
            className="q-xp-float pointer-events-none absolute -top-2 right-3 font-display text-lg font-bold"
            style={{ color: "var(--color-gold-ink)" }}
          >
            +{XP.correct}
          </span>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {found.map((w) => (
          <span
            key={w}
            className="q-pop rounded-full px-3 py-2 font-display text-[15px] font-bold lowercase"
            style={{ background: "var(--color-green-soft)", color: "var(--color-green-dark)" }}
          >
            {w}
          </span>
        ))}
      </div>

      <p className="mt-4 text-center font-body text-sm" style={{ color: "var(--color-muted)" }}>
        {found.length} of {words.length} words
      </p>

      <Button className="mt-4" variant="secondary" color="blue" size="lg" fullWidth onClick={finish}>
        I am done
      </Button>
    </div>
  );
}

export { RememberRunner };
