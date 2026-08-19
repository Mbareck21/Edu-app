"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import ItemView from "@/components/items/ItemView";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import FeedbackSheet, { type Feedback } from "@/components/ui/FeedbackSheet";
import Icon from "@/components/ui/Icon";
import LessonComplete from "@/components/ui/LessonComplete";
import Pill from "@/components/ui/Pill";
import RunnerHeader from "@/components/ui/RunnerHeader";
import { gradeItem, reEnqueue, type LessonItem } from "@/lib/items";
import { mulberry32 } from "@/lib/math/rng";
import type { Rng } from "@/lib/math/types";
import { postSession } from "@/lib/offline-queue";
import { XP, type Gained } from "@/lib/rewards";
import type { SessionResult, WordResult } from "@/lib/types";

/** Under this many ms an answer earns the speed bonus. */
const FAST_MS = 3000;

export type VocabDrillRunnerProps = {
  items: LessonItem[];
  /** Activity ref, e.g. "drill:vocab:mixed". */
  sessionRef: string;
  /** Set when every item comes from one list. */
  listId?: string;
  title: string;
  subtitle?: string;
  /** Drill URL without a seed — "Again" adds a fresh one. */
  againHref: string;
  /** Spelling test: list every word right or wrong at the end. */
  report?: boolean;
  emptyNote?: string;
};

type Attempt = {
  word?: string;
  skill: WordResult["skill"];
  correct: boolean;
  fast: boolean;
  listId?: string;
};

type Outcome = {
  gained: Gained | null;
  saved: boolean;
  ms: number;
  answered: number;
  correct: number;
  /** Spelling test report: one line per word, first try only. */
  words: { word: string; correct: boolean }[];
};

/**
 * One session, whichever list the words came from. `wordResults` carry their
 * own listId as well, so the schedules land on the right list once the
 * endpoint reads it; today the server applies them to the top-level listId.
 */
function payload(
  sessionRef: string,
  listId: string | undefined,
  attempts: Attempt[],
  ms: number
): SessionResult {
  const answered = attempts.length;
  const correct = attempts.filter((a) => a.correct).length;
  const counts = new Map<string, number>();
  for (const a of attempts) {
    if (a.listId) counts.set(a.listId, (counts.get(a.listId) ?? 0) + 1);
  }
  const main =
    listId ?? [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? undefined;

  return {
    kind: "vocab",
    ref: sessionRef,
    answered,
    correct,
    fastCount: attempts.filter((a) => a.fast).length,
    ms,
    perfect: answered > 0 && correct === answered,
    ...(main ? { listId: main } : {}),
    wordResults: attempts
      .filter((a): a is Attempt & { word: string } => !!a.word)
      .map((a) => ({ word: a.word, skill: a.skill, correct: a.correct, listId: a.listId })),
  } as SessionResult;
}

/**
 * The drill runner: same item flow as a lesson, plus a live counter and a
 * streak flame. Wrong items come back until they are right.
 */
export default function VocabDrillRunner({
  items,
  sessionRef,
  listId,
  title,
  subtitle,
  againHref,
  report = false,
  emptyNote = "No words to drill yet.",
}: VocabDrillRunnerProps) {
  const router = useRouter();
  const [queue, setQueue] = useState<LessonItem[]>(items);
  const [chosen, setChosen] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [almost, setAlmost] = useState(false);
  const [streak, setStreak] = useState(0);
  const [round, setRound] = useState(0);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const answeredIds = useRef<Set<string>>(new Set());
  const attempts = useRef<Attempt[]>([]);
  const startedAt = useRef(0);
  const itemStartedAt = useRef(0);
  const rng = useRef<Rng | null>(null);
  const posted = useRef(false);

  const total = items.length;
  const done = total > 0 && queue.length === 0;
  const current = queue[0] ?? null;
  const remaining = new Set(queue.map((i) => i.id)).size;
  const finished = total - remaining;
  const progress = total === 0 ? 1 : finished / total;

  useEffect(() => {
    const now = Date.now();
    startedAt.current = now;
    itemStartedAt.current = now;
    rng.current = mulberry32(now % 2147483647);
  }, []);

  useEffect(() => {
    if (!done || posted.current) return;
    posted.current = true;
    const ms = Date.now() - startedAt.current;
    const all = attempts.current;
    const answered = all.length;
    const correct = all.filter((a) => a.correct).length;
    const words = report ? firstTryWords(all) : [];
    void postSession(payload(sessionRef, listId, all, ms)).then((res) => {
      setOutcome({
        gained: res.saved ? res.gained : null,
        saved: res.saved,
        ms,
        answered,
        correct,
        words,
      });
    });
  }, [done, sessionRef, listId, report]);

  function onAnswer(given: string) {
    if (!current || feedback || current.kind === "learn-card") return;
    const grade = gradeItem(current, given, almost);
    setChosen(given);
    if (grade === "almost") {
      setAlmost(true);
      return;
    }

    const right = grade === "correct";
    const firstTry = !answeredIds.current.has(current.id);
    const fast = right && Date.now() - itemStartedAt.current < FAST_MS;
    if (firstTry) {
      answeredIds.current.add(current.id);
      attempts.current.push({
        word: current.word,
        skill: current.skill,
        correct: right,
        fast,
        listId: current.listId,
      });
    }
    setStreak((s) => (right ? s + 1 : 0));

    if (right) {
      setFeedback({
        state: "correct",
        title: fast ? "Fast and right!" : "Nice work!",
        xp: firstTry ? XP.correct + (fast ? XP.fast : 0) : 0,
      });
    } else {
      const short = current.answer.length <= 22;
      setFeedback({
        state: "wrong",
        title: short ? `It is "${current.answer}"` : "Not this time",
        answer: current.answer,
        line: current.feedback,
      });
    }
  }

  function advance(wrong: boolean) {
    const [head, ...rest] = queue;
    const roll = rng.current ?? mulberry32(Date.now() % 2147483647);
    rng.current = roll;
    setQueue(wrong && head ? reEnqueue(rest, head, roll) : rest);
    setFeedback(null);
    setChosen(null);
    setAlmost(false);
    setRound((r) => r + 1);
    itemStartedAt.current = Date.now();
  }

  if (items.length === 0) {
    return (
      <div className="safe-top safe-bottom min-h-dvh px-4">
        <RunnerHeader href="/drill" value={0} color="blue" />
        <Card className="mt-8 space-y-3 text-center">
          <p className="font-display text-lg font-bold">{emptyNote}</p>
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
    const words = outcome.words;

    return (
      <div className="safe-top safe-bottom min-h-dvh px-4">
        {words.length > 0 ? (
          <Card className="mt-4">
            <p className="font-display text-lg font-bold">Your spelling</p>
            <ul className="mt-2 space-y-1.5">
              {words.map((w) => (
                <li key={w.word} className="flex items-center gap-2">
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                    style={{
                      background: w.correct ? "var(--color-green-soft)" : "var(--color-coral-soft)",
                      color: w.correct ? "var(--color-green-dark)" : "var(--color-coral-dark)",
                    }}
                  >
                    <Icon name={w.correct ? "check" : "x"} size={16} />
                  </span>
                  <span className="font-display text-base font-bold lowercase">{w.word}</span>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
        <LessonComplete
          title={title}
          subtitle={subtitle}
          xp={outcome.gained?.xp ?? 0}
          ms={outcome.ms}
          accuracy={outcome.answered === 0 ? 1 : outcome.correct / outcome.answered}
          perfect={outcome.answered > 0 && outcome.correct === outcome.answered}
          leveledUp={outcome.gained?.leveledUp}
          newBadge={badge ? { name: badge.name, blurb: badge.blurb, icon: badge.icon } : null}
          primary={{
            label: "Again",
            onClick: () => router.push(`${againHref}&seed=${Date.now()}`),
          }}
          secondary={{ label: "All drills", href: "/drill" }}
          note={outcome.saved ? undefined : "No internet. Saved on this phone for later."}
        />
      </div>
    );
  }

  return (
    <div className="safe-top min-h-dvh px-4 pb-40">
      <RunnerHeader
        href="/drill"
        value={progress}
        color="blue"
        label="Drill progress"
        right={
          <span className="flex items-center gap-2">
            {streak >= 3 ? (
              <Pill color="flame" variant="soft" icon="flame" size="sm">
                {streak}
              </Pill>
            ) : null}
            <span
              className="font-display text-sm font-bold"
              style={{ color: "var(--color-muted)" }}
            >
              {finished}/{total}
            </span>
          </span>
        }
      />
      <div className="pt-3">
        {current ? (
          <ItemView
            key={`${current.id}:${round}`}
            item={current}
            locked={feedback !== null}
            revealed={feedback !== null}
            chosen={chosen}
            almost={almost}
            onAnswer={onAnswer}
            onContinue={() => advance(false)}
          />
        ) : null}
      </div>
      <FeedbackSheet feedback={feedback} onContinue={() => advance(feedback?.state === "wrong")} />
    </div>
  );
}

/** One line per word, first try only — what the spelling test reports. */
function firstTryWords(attempts: Attempt[]): { word: string; correct: boolean }[] {
  const seen = new Map<string, boolean>();
  for (const a of attempts) {
    if (!a.word || seen.has(a.word)) continue;
    seen.set(a.word, a.correct);
  }
  return [...seen].map(([word, correct]) => ({ word, correct }));
}

export { VocabDrillRunner };
