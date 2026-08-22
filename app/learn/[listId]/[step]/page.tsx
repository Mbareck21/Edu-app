import mongoose from "mongoose";
import { notFound } from "next/navigation";

import ItemRunner from "@/components/items/ItemRunner";
import FlashcardRunner from "@/components/learn/FlashcardRunner";
import ReadingRunner from "@/components/reading/ReadingRunner";
import { requestSeed } from "@/components/ui/time";
import { connectDB } from "@/lib/db";
import { buildLesson } from "@/lib/lesson-builder";
import { mulberry32 } from "@/lib/math/rng";
import { getProfile } from "@/lib/profile";
import { scaffoldFor } from "@/lib/reading";
import { WordList, toClient } from "@/lib/models/WordList";
import { isStepId, stepById } from "@/lib/types";

export const dynamic = "force-dynamic";

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
    // How much help finding the answer he still gets. Read from the profile so
    // it follows him across word lists, not per list.
    const profile = await getProfile();
    return <ReadingRunner list={list} scaffold={scaffoldFor(profile.reading.recent)} />;
  }

  const info = stepById(step);
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
      accent={info.accent}
      title={info.doneTitle}
      subtitle={list.name}
      primary={{ label: "Back to path", href: pathHref }}
      secondary={{ label: "Again", href: `${pathHref}/${step}?r=${seed}` }}
      showTimer={info.timed}
      chest={info.chest}
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
  return { title: isStepId(step) ? stepById(step).name : "Lesson" };
}
