"use client";

import { useEffect, useRef, useState } from "react";

import ItemView from "@/components/items/ItemView";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Icon from "@/components/ui/Icon";
import FeedbackSheet, { type Feedback } from "@/components/ui/FeedbackSheet";
import LessonComplete, { type CompleteAction } from "@/components/ui/LessonComplete";
import Pill from "@/components/ui/Pill";
import RunnerHeader from "@/components/ui/RunnerHeader";
import { fireConfetti } from "@/components/ui/Confetti";
import { clock } from "@/components/ui/time";
import type { AccentColor } from "@/components/ui/colors";
import { gradeItem, reEnqueue, type LessonItem } from "@/lib/items";
import { mulberry32 } from "@/lib/math/rng";
import type { Rng } from "@/lib/math/types";
import { postSession } from "@/lib/offline-queue";
import { XP, type Gained, type GainedBadge } from "@/lib/rewards";
import { sfx } from "@/lib/sfx";
import type { SessionResult, StepId, WordResult } from "@/lib/types";

/** Under this many ms an answer earns the speed bonus. */
const FAST_MS = 3000;
/** The unit chest opens at this score. */
export const CHEST_PCT = 80;

export type RunnerPost = {
  /** Activity ref: "listId:step", "quest:review", "quest:new", ... */
  ref: string;
  listId?: string;
  step?: StepId;
  /** No `listId`: take the one most answers came from (drills across lists). */
  deriveListId?: boolean;
};

export type ItemRunnerProps = {
  items: LessonItem[];
  post: RunnerPost;
  /** Where the X goes. */
  exitHref: string;
  accent?: AccentColor;
  title: string;
  subtitle?: string;
  primary: CompleteAction;
  secondary?: CompleteAction;
  showTimer?: boolean;
  /** Challenge step: pass at 80% and the chest opens. */
  chest?: boolean;
  /** Lists whose words still need AI examples. Filled once, in the background. */
  fillExamples?: string[];
  emptyNote?: string;
  /** Progress bar label. */
  progressLabel?: string;
  /** Live "done/total" and a streak flame in the header — drills show these. */
  counter?: boolean;
  /** Spelling test: list every word right or wrong at the end. */
  report?: boolean;
  /** Replaces "Go back" on the empty screen. */
  emptyAction?: { label: string; onClick: () => void };
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

/** One line per word, first try only — what the spelling test reports. */
function firstTryWords(attempts: Attempt[]): { word: string; correct: boolean }[] {
  const seen = new Map<string, boolean>();
  for (const a of attempts) {
    if (!a.word || seen.has(a.word)) continue;
    seen.set(a.word, a.correct);
  }
  return [...seen].map(([word, correct]) => ({ word, correct }));
}

/** The list most answers came from — the drill's stand-in for a chosen list. */
function mainListId(attempts: Attempt[]): string | undefined {
  const counts = new Map<string, number>();
  for (const a of attempts) {
    if (a.listId) counts.set(a.listId, (counts.get(a.listId) ?? 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
}

/** One post; each word result carries its own list so every schedule moves. */
function payloads(post: RunnerPost, all: Attempt[], ms: number): SessionResult[] {
  const answered = all.length;
  const correct = all.filter((a) => a.correct).length;
  const listId = post.listId ?? (post.deriveListId ? mainListId(all) : undefined);
  return [
    {
      kind: "vocab",
      ref: post.ref,
      answered,
      correct,
      fastCount: all.filter((a) => a.fast).length,
      ms,
      perfect: answered > 0 && correct === answered,
      ...(listId ? { listId } : {}),
      ...(post.step ? { step: post.step } : {}),
      wordResults: all
        .filter((a): a is Attempt & { word: string } => !!a.word)
        .map((a) => ({
          word: a.word,
          skill: a.skill,
          correct: a.correct,
          ...(a.listId ? { listId: a.listId } : {}),
        })),
    } satisfies SessionResult,
  ];
}

export default function ItemRunner({
  items,
  post,
  exitHref,
  accent = "green",
  title,
  subtitle,
  primary,
  secondary,
  showTimer = false,
  chest = false,
  fillExamples,
  emptyNote = "Nothing to practise here yet.",
  progressLabel,
  counter = false,
  report = false,
  emptyAction,
}: ItemRunnerProps) {
  const [queue, setQueue] = useState<LessonItem[]>(items);
  const [chosen, setChosen] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [almost, setAlmost] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [streak, setStreak] = useState(0);
  /** Bumped every time the queue moves, so a returning item starts fresh. */
  const [round, setRound] = useState(0);

  const answeredIds = useRef<Set<string>>(new Set());
  const attempts = useRef<Attempt[]>([]);
  const startedAt = useRef(0);
  const itemStartedAt = useRef(0);
  const rng = useRef<Rng | null>(null);
  const posted = useRef(false);

  const total = items.length;
  const remaining = new Set(queue.map((i) => i.id)).size;
  const progress = total === 0 ? 1 : (total - remaining) / total;
  const current = queue[0] ?? null;
  const done = total > 0 && queue.length === 0;

  useEffect(() => {
    const now = Date.now();
    startedAt.current = now;
    itemStartedAt.current = now;
    rng.current = mulberry32(now % 2147483647);
  }, []);

  // Missing examples get written in the background — the lesson never waits.
  useEffect(() => {
    if (!fillExamples || fillExamples.length === 0) return;
    for (const id of fillExamples) {
      void fetch(`/api/lists/${id}/examples`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      }).catch(() => {});
    }
  }, [fillExamples]);

  useEffect(() => {
    if (!showTimer || done) return;
    const id = setInterval(() => {
      setElapsed(Date.now() - startedAt.current);
    }, 1000);
    return () => clearInterval(id);
  }, [showTimer, done]);

  // Save the session once, when the queue empties.
  useEffect(() => {
    if (!done || posted.current) return;
    posted.current = true;
    const ms = Date.now() - startedAt.current;
    const all = attempts.current;
    const answered = all.length;
    const correct = all.filter((a) => a.correct).length;
    const pct = answered === 0 ? 100 : Math.round((correct / answered) * 100);
    if (chest && pct >= CHEST_PCT) {
      sfx.chest();
      void fireConfetti("big");
    }

    void (async () => {
      const sum: Gained = {
        xp: 0,
        newBadges: [],
        streakExtended: false,
        leveledUp: false,
        level: 1,
        goalMet: false,
      };
      const badges: GainedBadge[] = [];
      let saved = true;
      for (const result of payloads(post, all, ms)) {
        const res = await postSession(result);
        if (!res.saved) {
          saved = false;
          continue;
        }
        sum.xp += res.gained.xp;
        sum.streakExtended = sum.streakExtended || res.gained.streakExtended;
        sum.leveledUp = sum.leveledUp || res.gained.leveledUp;
        sum.goalMet = sum.goalMet || res.gained.goalMet;
        sum.level = Math.max(sum.level, res.gained.level);
        badges.push(...res.gained.newBadges);
      }
      sum.newBadges = badges;
      setOutcome({
        gained: sum,
        saved,
        ms,
        answered,
        correct,
        words: report ? firstTryWords(all) : [],
      });
    })();
  }, [done, chest, post, report]);

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
      // Short answers read best as the headline; a whole sentence does not.
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
        <RunnerHeader href={exitHref} value={0} color={accent} />
        <Card className="mt-8 space-y-3 text-center">
          <p className="font-display text-lg font-bold">{emptyNote}</p>
          <Button
            color={accent}
            size="lg"
            fullWidth
            onClick={emptyAction ? emptyAction.onClick : () => window.history.back()}
          >
            {emptyAction?.label ?? "Go back"}
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
    const accuracy = outcome.answered === 0 ? 1 : outcome.correct / outcome.answered;
    const won = chest && Math.round(accuracy * 100) >= CHEST_PCT;
    const badge = outcome.gained?.newBadges[0];

    return (
      <div className="safe-top safe-bottom min-h-dvh px-4">
        {won ? (
          <Card color="gold" variant="soft" className="q-bounce-in mt-4 text-center">
            <span
              className="inline-flex h-16 w-16 items-center justify-center rounded-full"
              style={{ background: "var(--color-gold)", color: "var(--color-gold-ink)" }}
            >
              <Icon name="chest" size={34} />
            </span>
            <p className="mt-2 font-display text-xl font-bold">Chest open!</p>
            <p className="font-body text-sm">You finished this unit.</p>
          </Card>
        ) : null}
        {outcome.words.length > 0 ? (
          <Card className="mt-4">
            <p className="font-display text-lg font-bold">Your spelling</p>
            <ul className="mt-2 space-y-1.5">
              {outcome.words.map((w) => (
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
          accuracy={accuracy}
          perfect={outcome.answered > 0 && outcome.correct === outcome.answered}
          leveledUp={outcome.gained?.leveledUp}
          newBadge={badge ? { name: badge.name, blurb: badge.blurb, icon: badge.icon } : null}
          primary={primary}
          secondary={secondary}
          note={outcome.saved ? undefined : "No internet. Saved on this phone for later."}
        />
      </div>
    );
  }

  return (
    <div className="safe-top min-h-dvh px-4 pb-40">
      <RunnerHeader
        href={exitHref}
        value={progress}
        color={accent}
        label={progressLabel}
        right={
          showTimer ? (
            <span
              className="inline-flex items-center gap-1 font-display text-sm font-bold"
              style={{ color: "var(--color-muted)" }}
            >
              <Icon name="clock" size={16} />
              {clock(elapsed)}
            </span>
          ) : counter ? (
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
                {total - remaining}/{total}
              </span>
            </span>
          ) : undefined
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
      <FeedbackSheet
        feedback={feedback}
        onContinue={() => advance(feedback?.state === "wrong")}
      />
    </div>
  );
}

export { ItemRunner };
