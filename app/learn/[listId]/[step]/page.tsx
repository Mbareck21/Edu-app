import mongoose from "mongoose";
import { notFound } from "next/navigation";

import ItemRunner from "@/components/items/ItemRunner";
import FlashcardRunner from "@/components/learn/FlashcardRunner";
import ReadingRunner from "@/components/reading/ReadingRunner";
import { requestSeed } from "@/components/ui/time";
import { connectDB } from "@/lib/db";
import { todayKey } from "@/lib/day";
import { buildLesson } from "@/lib/lesson-builder";
import { mulberry32 } from "@/lib/math/rng";
import { getProfile } from "@/lib/profile";
import { scaffoldFor } from "@/lib/reading";
import { WordList, toClient } from "@/lib/models/WordList";
import { isStepId, stepById } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function StepPage({
  params,
  searchParams,
}: {
  params: Promise<{ listId: string; step: string }>;
  searchParams: Promise<{ r?: string; saved?: string }>;
}) {
  const { listId, step } = await params;
  if (!isStepId(step) || !mongoose.isValidObjectId(listId)) notFound();
  // Remount key. "Again" links back to this same route with a new ?r, and
  // React keeps a same-type component's state across that soft navigation —
  // without a changing key the finished screen just re-renders itself.
  const runKey = (await searchParams).r ?? "first";

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
        key={runKey}
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
    // A passage he was given on an earlier day is not today's reading. Without
    // this the Read step reopened a story from over a week ago and gave him no
    // way to ask for another. Decided on the server so the runner never has to
    // read the clock during render.
    // Both sides go through todayKey(): generatedAt is UTC, and his day
    // boundary is Chicago. Slicing the ISO string instead would call every
    // passage written after 6pm his time "yesterday's".
    const generatedOn = list.currentReading?.generatedAt
      ? todayKey(new Date(list.currentReading.generatedAt))
      : "";
    // ?saved=1 is how the "read this one instead" link asks for the passage
    // already on the list, rather than a new one.
    const wantsSaved = (await searchParams).saved === "1";
    const stale = !wantsSaved && generatedOn !== todayKey();

    // If this list cannot serve a reading — nothing saved, or only something
    // old — find one that can. The home page's Reading beat always points at
    // the most recently touched list, and that list having no passage is not a
    // reason for him to have nothing to read while another list holds one.
    const needsSpare = stale || !list.currentReading;
    const spareDoc = needsSpare
      ? await WordList.findOne({
          _id: { $ne: list._id },
          currentReading: { $ne: null },
        })
          .sort({ "currentReading.generatedAt": -1 })
          .select("_id name currentReading.title")
          .lean()
      : null;
    const spareTitle = spareDoc?.currentReading?.title;
    const spare =
      spareDoc && spareTitle
        ? { listId: String(spareDoc._id), title: String(spareTitle) }
        : null;

    return (
      <ReadingRunner
        key={runKey}
        list={list}
        scaffold={scaffoldFor(profile.reading.recent)}
        stale={stale}
        spare={spare}
      />
    );
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
      key={runKey}
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
