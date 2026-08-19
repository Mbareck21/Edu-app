"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import ArabicChip from "@/components/items/ArabicChip";
import AudioButton from "@/components/items/AudioButton";
import { Marked } from "@/components/items/ItemFrame";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import LessonComplete from "@/components/ui/LessonComplete";
import RunnerHeader from "@/components/ui/RunnerHeader";
import { fireConfetti } from "@/components/ui/Confetti";
import { postSession } from "@/lib/offline-queue";
import type { Gained } from "@/lib/rewards";
import { sfx } from "@/lib/sfx";
import type { ClientWord, ClientWordList, SrsState } from "@/lib/models/WordList";
import {
  DEFAULT_SESSION_SIZE,
  applyRating,
  selectSessionWords,
  type Rating,
  type SessionEntry,
} from "@/lib/study-session";
import type { WordResult } from "@/lib/types";

type Outcome = { gained: Gained | null; saved: boolean; ms: number; answered: number; correct: number };

export type FlashcardRunnerProps = {
  list: ClientWordList;
  /** Server time when the page rendered — keeps the first render pure. */
  nowIso: string;
  needsExamples?: boolean;
};

/**
 * Step 1 of the path: see the words.
 *
 * Same session queue as before (lib/study-session plus the /review endpoint
 * for the SRS), new card. Easy and Hard also feed the "recognize" rung through
 * the session-complete post, so flashcards count toward mastery.
 */
export default function FlashcardRunner({ list, nowIso, needsExamples }: FlashcardRunnerProps) {
  const [start] = useState<SessionEntry[]>(() =>
    selectSessionWords(list.words, DEFAULT_SESSION_SIZE, new Date(nowIso)).map((w) => ({
      id: w.word,
      easys: 0,
    }))
  );
  const [queue, setQueue] = useState<SessionEntry[]>(start);
  const [words, setWords] = useState<ClientWord[]>(list.words);
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const results = useRef<WordResult[]>([]);
  const startedAt = useRef(0);
  const posted = useRef(false);

  const byWord = useMemo(() => new Map(words.map((w) => [w.word, w])), [words]);
  const card = queue.length > 0 ? byWord.get(queue[0].id) ?? null : null;
  const done = start.length > 0 && queue.length === 0;
  const pathHref = `/learn/${list._id}`;

  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  useEffect(() => {
    if (!needsExamples) return;
    void fetch(`/api/lists/${list._id}/examples`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    }).catch(() => {});
  }, [needsExamples, list._id]);

  useEffect(() => {
    if (!done || posted.current) return;
    posted.current = true;
    const ms = Date.now() - startedAt.current;
    const wordResults = results.current;
    const answered = wordResults.length;
    const correct = wordResults.filter((r) => r.correct).length;
    void postSession({
      kind: "vocab",
      ref: `${list._id}:flashcards`,
      answered,
      correct,
      fastCount: 0,
      ms,
      perfect: answered > 0 && correct === answered,
      listId: list._id,
      step: "flashcards",
      wordResults,
    }).then((res) => {
      setOutcome({
        gained: res.saved ? res.gained : null,
        saved: res.saved,
        ms,
        answered,
        correct,
      });
    });
  }, [done, list._id]);

  async function rate(rating: Rating) {
    if (!card || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/lists/${list._id}/flashcards/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word: card.word, rating }),
      });
      if (res.ok) {
        const { srs } = (await res.json()) as { srs: SrsState };
        setWords((ws) => ws.map((w) => (w.word === card.word ? { ...w, srs } : w)));
      }
    } catch {
      // The SRS write can wait — the session post is the record that counts.
    }
    // One line per card in this session: Easy means the meaning came back.
    if (!results.current.some((r) => r.word === card.word)) {
      results.current.push({ word: card.word, skill: "recognize", correct: rating === "easy" });
    }
    if (rating === "easy") {
      sfx.correct();
      void fireConfetti("small");
    } else {
      sfx.wrong();
    }
    setQueue(applyRating(queue, rating).queue);
    setRevealed(false);
    setBusy(false);
  }

  if (words.length === 0) {
    return (
      <div className="safe-top safe-bottom min-h-dvh px-4">
        <RunnerHeader href={pathHref} value={0} color="blue" />
        <Card className="mt-8 text-center">
          <p className="font-display text-lg font-bold">No words on this list yet.</p>
          <p className="mt-1 font-body text-sm" style={{ color: "var(--color-muted)" }}>
            Add some in the Words tab.
          </p>
        </Card>
      </div>
    );
  }

  if (done) {
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
        <LessonComplete
          title="Words learned!"
          subtitle={`${outcome.correct} of ${outcome.answered} felt easy.`}
          xp={outcome.gained?.xp ?? 0}
          ms={outcome.ms}
          accuracy={outcome.answered === 0 ? 1 : outcome.correct / outcome.answered}
          leveledUp={outcome.gained?.leveledUp}
          newBadge={badge ? { name: badge.name, blurb: badge.blurb, icon: badge.icon } : null}
          primary={{ label: "Back to path", href: pathHref }}
          secondary={{ label: "Again", href: `${pathHref}/flashcards?r=${outcome.ms}` }}
          note={outcome.saved ? undefined : "No internet. Saved on this phone for later."}
        />
      </div>
    );
  }

  const left = new Set(queue.map((q) => q.id)).size;

  return (
    <div className="safe-top min-h-dvh px-4 pb-8">
      <RunnerHeader
        href={pathHref}
        value={start.length === 0 ? 1 : (start.length - left) / start.length}
        color="blue"
        label="Cards done"
      />

      <div className="pt-4">
        <div
          role={revealed ? undefined : "button"}
          tabIndex={revealed ? undefined : 0}
          onClick={() => {
            if (revealed) return;
            sfx.tap();
            setRevealed(true);
          }}
          onKeyDown={(e) => {
            if (revealed) return;
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              sfx.tap();
              setRevealed(true);
            }
          }}
          className="press-3d w-full rounded-hero border-2 bg-white px-4 py-6 text-left shadow-card"
          style={{ borderColor: "var(--color-line)", minHeight: 300 }}
          aria-label={revealed ? "Card" : "Tap to see the meaning"}
        >
          {card && revealed ? (
            <div className="q-pop space-y-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-display text-2xl font-bold lowercase">{card.word}</p>
                <ArabicChip arabic={card.arabic} faded={card.srs.interval >= 7} />
              </div>
              <p className="font-body text-lg leading-snug">
                {card.explanation || card.clue || "No meaning yet."}
              </p>
              {card.examples.length > 0 ? (
                <ul className="space-y-1.5">
                  {card.examples.slice(0, 3).map((ex, i) => (
                    <li
                      key={i}
                      className="rounded-tile px-3 py-2 font-body text-[15px] leading-snug"
                      style={{ background: "var(--color-sand)" }}
                    >
                      <Marked text={ex} word={card.word} />
                    </li>
                  ))}
                </ul>
              ) : null}
              {card.family.length > 0 ? (
                <p className="font-body text-sm" style={{ color: "var(--color-muted)" }}>
                  Family: {card.family.slice(0, 4).join(", ")}
                </p>
              ) : null}
            </div>
          ) : (
            <div className="flex min-h-[260px] flex-col items-center justify-center gap-4">
              <p className="font-display text-4xl font-bold lowercase">{card?.word}</p>
              <span onClick={(e) => e.stopPropagation()} role="presentation">
                <AudioButton text={card?.word ?? ""} autoPlay size={72} />
              </span>
              <p className="font-body text-sm" style={{ color: "var(--color-faint)" }}>
                Tap the card to see what it means
              </p>
            </div>
          )}
        </div>
      </div>

      {revealed ? (
        <div className="mt-4 flex gap-3">
          <Button color="coral" size="lg" fullWidth disabled={busy} onClick={() => rate("hard")}>
            Hard
          </Button>
          <Button color="green" size="lg" fullWidth disabled={busy} onClick={() => rate("easy")}>
            Easy
          </Button>
        </div>
      ) : null}

      <p className="mt-4 text-center font-body text-sm" style={{ color: "var(--color-muted)" }}>
        {left} card{left === 1 ? "" : "s"} to go
      </p>
    </div>
  );
}

export { FlashcardRunner };
