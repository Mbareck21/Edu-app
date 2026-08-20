"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import ArabicChip from "@/components/items/ArabicChip";
import AudioButton from "@/components/items/AudioButton";
import { Marked } from "@/components/items/ItemFrame";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import LessonComplete from "@/components/ui/LessonComplete";
import Pill from "@/components/ui/Pill";
import RunnerHeader from "@/components/ui/RunnerHeader";
import { fireConfetti } from "@/components/ui/Confetti";
import type { ClientWord } from "@/lib/models/WordList";
import { postSession } from "@/lib/offline-queue";
import type { Gained } from "@/lib/rewards";
import { sfx } from "@/lib/sfx";
import type { SessionResult, WordResult } from "@/lib/types";

/** How far back a "Hard" card goes. */
const HARD_GAP = 3;

export type DrillCard = { listId: string; word: ClientWord };

export type DrillFlashcardsProps = {
  cards: DrillCard[];
  sessionRef: string;
  againHref: string;
  subtitle?: string;
};

type Outcome = { gained: Gained | null; saved: boolean; ms: number; answered: number; correct: number };

/** Classic flip card, Easy or Hard, with the SRS write behind it. */
export default function DrillFlashcards({
  cards,
  sessionRef,
  againHref,
  subtitle,
}: DrillFlashcardsProps) {
  const router = useRouter();
  const [queue, setQueue] = useState<DrillCard[]>(cards);
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const results = useRef<WordResult[]>([]);
  const listCounts = useRef(new Map<string, number>());
  const startedAt = useRef(0);
  const posted = useRef(false);

  const card = queue[0] ?? null;
  const done = cards.length > 0 && queue.length === 0;

  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  useEffect(() => {
    if (!done || posted.current) return;
    posted.current = true;
    const ms = Date.now() - startedAt.current;
    const wordResults = results.current;
    const answered = wordResults.length;
    const correct = wordResults.filter((r) => r.correct).length;
    const main = [...listCounts.current].sort((a, b) => b[1] - a[1])[0]?.[0];
    const result: SessionResult = {
      kind: "vocab",
      ref: sessionRef,
      answered,
      correct,
      fastCount: 0,
      ms,
      perfect: answered > 0 && correct === answered,
      ...(main ? { listId: main } : {}),
      wordResults,
    };
    void postSession(result).then((res) => {
      setOutcome({
        gained: res.saved ? res.gained : null,
        saved: res.saved,
        ms,
        answered,
        correct,
      });
    });
  }, [done, sessionRef]);

  async function rate(rating: "easy" | "hard") {
    if (!card || busy) return;
    setBusy(true);
    try {
      await fetch(`/api/lists/${card.listId}/flashcards/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word: card.word.word, rating }),
      });
    } catch {
      // The SRS write can wait — the session post is the record that counts.
    }
    if (!results.current.some((r) => r.word === card.word.word)) {
      results.current.push({
        word: card.word.word,
        // Cross-list decks: the SRS write has to land on the card's own list.
        ...(card.listId ? { listId: card.listId } : {}),
        skill: "recognize",
        correct: rating === "easy",
      });
      listCounts.current.set(card.listId, (listCounts.current.get(card.listId) ?? 0) + 1);
    }
    if (rating === "easy") {
      sfx.correct();
      void fireConfetti("small");
    } else {
      sfx.wrong();
    }
    const [head, ...rest] = queue;
    setQueue(
      rating === "easy"
        ? rest
        : [...rest.slice(0, Math.min(HARD_GAP, rest.length)), head, ...rest.slice(HARD_GAP)]
    );
    setRevealed(false);
    setBusy(false);
  }

  if (cards.length === 0) {
    return (
      <div className="safe-top safe-bottom min-h-dvh px-4">
        <RunnerHeader href="/drill" value={0} color="blue" />
        <Card className="mt-8 space-y-3 text-center">
          <p className="font-display text-lg font-bold">No cards to flip yet.</p>
          <Button color="blue" size="lg" fullWidth onClick={() => router.push("/drill")}>
            Back to drills
          </Button>
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
          title="Cards done!"
          subtitle={subtitle ?? `${outcome.correct} of ${outcome.answered} felt easy.`}
          xp={outcome.gained?.xp ?? 0}
          ms={outcome.ms}
          accuracy={outcome.answered === 0 ? 1 : outcome.correct / outcome.answered}
          leveledUp={outcome.gained?.leveledUp}
          newBadge={badge ? { name: badge.name, blurb: badge.blurb, icon: badge.icon } : null}
          primary={{ label: "Again", onClick: () => router.push(`${againHref}&seed=${Date.now()}`) }}
          secondary={{ label: "All drills", href: "/drill" }}
          note={outcome.saved ? undefined : "No internet. Saved on this phone for later."}
        />
      </div>
    );
  }

  const left = queue.length;
  const word = card?.word;

  return (
    <div className="safe-top min-h-dvh px-4 pb-8">
      <RunnerHeader
        href="/drill"
        value={(cards.length - left) / cards.length}
        color="blue"
        label="Cards done"
        right={
          <Pill color="blue" variant="soft" size="sm">
            {cards.length - left}/{cards.length}
          </Pill>
        }
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
          {word && revealed ? (
            <div className="q-pop space-y-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-display text-2xl font-bold lowercase">{word.word}</p>
                <ArabicChip arabic={word.arabic} faded={word.srs.interval >= 7} />
              </div>
              <p className="font-body text-lg leading-snug">
                {word.explanation || word.clue || "No meaning yet."}
              </p>
              {word.examples.length > 0 ? (
                <ul className="space-y-1.5">
                  {word.examples.slice(0, 3).map((ex, i) => (
                    <li
                      key={i}
                      className="rounded-tile px-3 py-2 font-body text-[15px] leading-snug"
                      style={{ background: "var(--color-sand)" }}
                    >
                      <Marked text={ex} word={word.word} />
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : (
            <div className="flex min-h-[260px] flex-col items-center justify-center gap-4">
              <p className="font-display text-4xl font-bold lowercase">{word?.word}</p>
              <span onClick={(e) => e.stopPropagation()} role="presentation">
                <AudioButton text={word?.word ?? ""} autoPlay size={72} />
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
    </div>
  );
}

export { DrillFlashcards };
