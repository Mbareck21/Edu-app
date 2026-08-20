import mongoose from "mongoose";
import { notFound } from "next/navigation";

import ItemRunner from "@/components/items/ItemRunner";
import FlashcardRunner from "@/components/learn/FlashcardRunner";
import ReadingRunner from "@/components/reading/ReadingRunner";
import { connectDB } from "@/lib/db";
import { buildLesson } from "@/lib/lesson-builder";
import { mulberry32 } from "@/lib/math/rng";
import { WordList, toClient } from "@/lib/models/WordList";
import { STEPS, isStepId, type StepId } from "@/lib/types";

export const dynamic = "force-dynamic";

/** One seed per request. The page is dynamic, so every visit is a new lesson. */
function requestSeed(): number {
  return Date.now();
}

const ACCENT = {
  flashcards: "blue",
  match: "green",
  listen: "green",
  spell: "green",
  use: "green",
  read: "purple",
  challenge: "gold",
} as const;

const DONE_TITLE: Record<StepId, string> = {
  flashcards: "Words learned!",
  match: "Match done!",
  listen: "Good ears!",
  spell: "Spelled it!",
  use: "You used them!",
  read: "Reading done!",
  challenge: "Challenge done!",
};

export default async function StepPage({
  params,
}: {
  params: Promise<{ listId: string; step: string }>;
}) {
  const { listId, step } = await params;
  if (!isStepId(step) || !mongoose.isValidObjectId(listId)) notFound();

  await connectDB();
  const doc = await WordList.findById(listId).lean();
  if (!doc) notFound();
  const list = toClient(doc);

  // Only a word with no examples at all is worth a refill — an empty family is
  // normal for plenty of words.
  const needsExamples = list.words.some((w) => w.examples.length === 0);
  const pathHref = `/learn/${list._id}`;

  const seed = requestSeed();

  if (step === "flashcards") {
    return (
      <FlashcardRunner
        list={list}
        nowIso={new Date(seed).toISOString()}
        needsExamples={needsExamples}
      />
    );
  }

  if (step === "read") {
    return <ReadingRunner list={list} />;
  }

  const items = buildLesson({
    words: list.words,
    step,
    now: new Date(seed),
    rng: mulberry32(seed % 2147483647),
    listId: list._id,
  });
  return (
    <ItemRunner
      items={items}
      post={{ ref: `${list._id}:${step}`, listId: list._id, step }}
      exitHref={pathHref}
      accent={ACCENT[step]}
      title={DONE_TITLE[step]}
      subtitle={list.name}
      primary={{ label: "Back to path", href: pathHref }}
      secondary={{ label: "Again", href: `${pathHref}/${step}?r=${seed}` }}
      showTimer={step === "challenge"}
      chest={step === "challenge"}
      fillExamples={needsExamples ? [list._id] : undefined}
      emptyNote={`Add words to ${list.name} first.`}
    />
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ step: string }>;
}) {
  const { step } = await params;
  const name = isStepId(step) ? STEPS.find((s) => s.id === step)?.name : "Lesson";
  return { title: name ?? "Lesson" };
}
