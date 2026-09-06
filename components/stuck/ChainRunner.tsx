"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Icon from "@/components/ui/Icon";
import LessonComplete from "@/components/ui/LessonComplete";
import { hintFor } from "@/lib/number-words";
import { sfx } from "@/lib/sfx";
import {
  CHAIN_TARGET,
  isFinished,
  rotate,
  rungFor,
  type ChainState,
} from "@/lib/spell-chain";
import { postSession } from "@/lib/offline-queue";
import { startStopwatch, type Stopwatch } from "@/lib/time-on-task";
import type { StepId } from "@/lib/types";
import { playTextThroughTTS } from "@/lib/voice";

/** How many writes make one sitting. Enough to move, short enough to finish. */
const SITTING_WRITES = 18;

/** What the word means, in both his languages. */
export type WordSense = { clue: string; arabic: string };

export type ChainRunnerProps = {
  /** The words in this sitting, already chosen. Up to ROTATE_WIDTH. */
  words: string[];
  /** Meaning per word. A word lands in the pool because he does not know it. */
  senses: Record<string, WordSense>;
  /**
   * Set when this sitting is a step on a unit path, so finishing it marks the
   * step done. Left off for the Words tab, where writing is its own thing and
   * completes nothing.
   */
  post?: { ref: string; listId: string; step: StepId };
  /** Where the finish screen sends him. Defaults back to the Words tab. */
  exit?: { label: string; href: string };
  /** Their counts as the server has them right now. */
  chains: Record<string, ChainState>;
  onDone?: () => void;
};

/**
 * Mask everything except the part he gets wrong.
 *
 * His misses are not random: the -ty ending, the th digraph and eigh. Showing
 * the rest and hiding those puts his attention exactly where it fails.
 */
function chunkMask(word: string): string {
  const traps = [/ty$/, /^th/, /eigh/, /^wh/, /ough/];
  for (const trap of traps) {
    const m = word.match(trap);
    if (m && m.index !== undefined) {
      const before = word.slice(0, m.index);
      const after = word.slice(m.index + m[0].length);
      return `${before}${"_".repeat(m[0].length)}${after}`;
    }
  }
  // No known trap: hide the back half, which is where endings live.
  const keep = Math.ceil(word.length / 2);
  return word.slice(0, keep) + "_".repeat(word.length - keep);
}

export default function ChainRunner({
  words,
  senses,
  chains,
  post,
  exit,
  onDone,
}: ChainRunnerProps) {
  const [state, setState] = useState<Record<string, ChainState>>(chains);
  const [writeIndex, setWriteIndex] = useState(0);
  /** Advances only on a correct write, so a miss does not rotate away. */
  const [turn, setTurn] = useState(0);
  /**
   * The word he just got wrong. He stays on it for one repair write with the
   * spelling in front of him, so he never leaves a wrong version as the last
   * thing he wrote. Rotating away instead put the miss message beside the next
   * word's counter and handed that word the repair.
   */
  const [repairWord, setRepairWord] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [afterMiss, setAfterMiss] = useState(false);
  const [missed, setMissed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);
  const [done, setDone] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [hidden, setHidden] = useState(false);

  const watch = useRef<Stopwatch | null>(null);
  const postedRef = useRef(false);
  const correctRef = useRef(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    watch.current = startStopwatch();
  }, []);

  const word = useMemo(
    () => repairWord ?? rotate(words, turn),
    [repairWord, words, turn]
  );
  const chain = state[word];
  const remainingNow = chain ? Math.max(0, CHAIN_TARGET - chain.current) : CHAIN_TARGET;

  // Derived, never stored. The ladder lives in lib/spell-chain.ts and is the
  // same one the server uses to decide what to send back; a copy of those
  // thresholds here is a copy that would drift.
  const rung = chain ? rungFor(chain, afterMiss) : "copy";

  const say = useCallback((w: string) => {
    void playTextThroughTTS(w).promise;
  }, []);

  // At blind there is nothing on screen, so the word has to arrive by ear.
  useEffect(() => {
    if (rung === "blind" && word) say(word);
  }, [rung, word, writeIndex, say]);

  const submit = useCallback(async () => {
    if (!word || busy || !typed.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/stuck/write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word, typed, afterMiss }),
      });
      const data = await res.json();
      if (!res.ok) return;

      setState((s) => ({ ...s, [word]: data.state }));
      if (data.correct) {
        correctRef.current += 1;
        sfx.correct();
        setMissed(null);
        setAfterMiss(false);
        setRepairWord(null);
        setTurn((t) => t + 1);
      } else {
        sfx.wrong();
        setMissed(typed);
        setAfterMiss(true);
        setRepairWord(word); // stay here and write it again, correctly
        setShake(true);
        setTimeout(() => setShake(false), 420);
      }

      const next = writeIndex + 1;
      if (next >= SITTING_WRITES) {
        const ms = watch.current?.read() ?? 0;
        setElapsedMs(ms);
        setDone(true);
        if (post && !postedRef.current) {
          postedRef.current = true;
          // Unscored step: it completes on being played, so the score here is
          // only for the activity log. The chain itself is the real record and
          // it was written per attempt, so a lost post costs nothing but XP.
          void postSession({
            kind: "vocab",
            ref: post.ref,
            listId: post.listId,
            step: post.step,
            answered: next,
            correct: correctRef.current,
            fastCount: 0,
            ms,
            perfect: false,
          });
        }
      } else {
        watch.current?.mark();
        setWriteIndex(next);
        setTyped("");
        setHidden(false);
        inputRef.current?.focus();
      }
    } finally {
      setBusy(false);
    }
  }, [word, typed, afterMiss, busy, writeIndex, post]);

  if (done) {
    const best = words.map((w) => state[w]?.current ?? 0);
    const wonNow = words.filter((w) => {
      const c = state[w];
      return Boolean(c) && (state[w]?.current ?? 0) >= CHAIN_TARGET;
    });
    return (
      <LessonComplete
        title={wonNow.length > 0 ? "You finished a word!" : "Writing done."}
        subtitle={
          wonNow.length > 0
            ? `${wonNow.join(", ")} — ten in a row.`
            : `Your best run today: ${Math.max(0, ...best)} in a row.`
        }
        xp={0}
        ms={elapsedMs}
        accuracy={null}
        perfect={wonNow.length > 0}
        primary={
          onDone
            ? { label: "Done", onClick: onDone }
            : (exit ?? { label: "Back to Words", href: "/words" })
        }
      />
    );
  }

  if (!word || !chain) return null;

  const sense = senses[word];
  const showWord = rung === "copy" || (rung === "cover" && !hidden);
  const display = rung === "chunk" ? chunkMask(word) : word;

  return (
    <div className="px-4 pb-40 pt-5">
      {/* The counter he asked for: how many more in a row, never a percentage. */}
      <Card color="blue" variant="soft">
        <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--color-blue-dark)" }}>
          {chain && isFinished(chain)
            ? "Check it — one write, no help"
            : remainingNow === 0
              ? "Done"
              : `${remainingNow} more in a row`}
        </p>
        <div className="mt-2 flex gap-1.5" aria-hidden>
          {Array.from({ length: CHAIN_TARGET }, (_, i) => (
            <span
              key={i}
              className="h-3 flex-1 rounded-full"
              style={{
                background:
                  i < chain.current
                    ? "var(--color-blue)"
                    : i < chain.best
                      ? "var(--color-blue-soft)"
                      : "var(--color-line)",
              }}
            />
          ))}
        </div>
        {chain.best > chain.current ? (
          <p className="mt-2 text-sm" style={{ color: "var(--color-muted)" }}>
            Your best is {chain.best}. You can beat it.
          </p>
        ) : null}
      </Card>

      <Card className={`mt-5 ${shake ? "q-shake" : ""}`}>
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>
            Write it
          </p>
          <button
            type="button"
            aria-label="Say the word"
            onClick={() => say(word)}
            className="flex h-11 w-11 items-center justify-center rounded-full"
            style={{ background: "var(--color-sand)", color: "var(--color-green-dark)" }}
          >
            <Icon name="volume" size={22} />
          </button>
        </div>

        {/* What it means, always. A word is in this pool BECAUSE he does not
            know it — writing it ten times without knowing what it means would
            train his hand and teach him nothing. The Arabic carries the sense
            his English cannot yet reach. */}
        {sense && (sense.clue || sense.arabic) ? (
          <div
            className="mt-3 rounded-tile px-3 py-2 text-center"
            style={{ background: "var(--color-sand)" }}
          >
            {sense.clue ? <p className="text-sm">{sense.clue}</p> : null}
            {sense.arabic ? (
              <p className="mt-1 font-display text-lg" lang="ar" dir="rtl">
                {sense.arabic}
              </p>
            ) : null}
          </div>
        ) : null}

        {showWord || rung === "chunk" ? (
          <p className="mt-3 text-center font-display text-3xl font-bold tracking-wide">
            {display}
          </p>
        ) : (
          <p className="mt-3 text-center text-base" style={{ color: "var(--color-muted)" }}>
            {rung === "cover" ? "Now write it from memory." : "Listen, then write it."}
          </p>
        )}

        <form
          className="mt-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <input
            ref={inputRef}
            className="min-h-[52px] flex-1 rounded-tile border-2 px-3 text-lg"
            style={{ borderColor: "var(--color-line)", background: "#fff" }}
            placeholder="Type the word"
            value={typed}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            onChange={(e) => {
              setTyped(e.target.value);
              // Look, cover, write: the model disappears the moment he starts.
              if (rung === "cover") setHidden(true);
            }}
            disabled={busy}
          />
          <Button type="submit" size="md" color="green" disabled={!typed.trim() || busy}>
            Check
          </Button>
        </form>

        {missed ? (
          <div className="mt-4 rounded-tile px-3 py-3" style={{ background: "var(--color-coral-soft)" }}>
            <p className="text-sm font-bold" style={{ color: "var(--color-coral-dark)" }}>
              You wrote {missed}. Back to zero — write it again.
            </p>
            {hintFor(missed, word) ? (
              <p className="mt-1 text-sm">{hintFor(missed, word)}</p>
            ) : null}
          </div>
        ) : null}
      </Card>

      <p className="mt-5 text-center text-sm" style={{ color: "var(--color-muted)" }}>
        Write {writeIndex + 1} of {SITTING_WRITES}
        {words.length > 1 ? ` · ${words.length} words taking turns` : ""}
      </p>
    </div>
  );
}

export { ChainRunner };
