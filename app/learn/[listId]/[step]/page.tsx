import mongoose from "mongoose";
import { notFound } from "next/navigation";

import ItemRunner from "@/components/items/ItemRunner";
import ChainRunner from "@/components/stuck/ChainRunner";
import ReadingRunner from "@/components/reading/ReadingRunner";
import { requestSeed } from "@/components/ui/time";
import { connectDB } from "@/lib/db";
import { todayKey } from "@/lib/day";
import { buildLesson } from "@/lib/lesson-builder";
import { mulberry32 } from "@/lib/math/rng";
import { orderByNeed } from "@/lib/practice-order";
import { resumeKey } from "@/lib/resume";
import { skillDue } from "@/lib/mastery";
import { SpellChain } from "@/lib/models/SpellChain";
import { ROTATE_WIDTH, fromRow, type ChainState } from "@/lib/spell-chain";
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
    // The step id is still "flashcards" so already-finished units stay
    // finished and queued offline sessions still parse — see lib/types.ts.
    // What it does is now writing, because flipping a card and telling
    // yourself you knew it is not evidence of anything.
    const chosen = orderByNeed(
      list.words,
      mulberry32(seed % 2147483647),
      // Due first, then weakest: the words he most needs to write.
      (w) => ({
        due: skillDue(w.skills.spell, new Date(seed)),
        streak: w.skills.spell.streak,
      })
    )
      .slice(0, ROTATE_WIDTH)
      .map((w) => w.word);
    // Senses and chains for the whole list, not just the chosen few: a sitting
    // that resumes after a reload keeps the words it started with, and those
    // may not be the ones this visit would have picked.
    const allWords = list.words.map((w) => w.word);
    const rows = allWords.length > 0 ? await SpellChain.find({ word: { $in: allWords } }).lean() : [];
    const chains: Record<string, ChainState> = {};
    const senses: Record<string, { clue: string; arabic: string }> = {};
    for (const w of list.words) {
      senses[w.word] = { clue: w.clue, arabic: w.arabic };
      const row = rows.find((r) => r.word === w.word);
      chains[w.word] = fromRow(w.word, row);
    }
    return (
      <ChainRunner
        key={runKey}
        words={chosen}
        senses={senses}
        chains={chains}
        post={{ ref: `${list._id}:flashcards`, listId: list._id, step: "flashcards" }}
        exit={{ label: "Back to path", href: pathHref }}
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
    // ?saved=<day> is how the "read this one instead" link asks for the passage
    // already on the list. It carries the day it was issued rather than a bare
    // flag: it means "show me this one now", not "staleness off". A bookmarked
    // or back-navigated URL must not quietly serve a week-old passage as
    // today's reading, which is the bug the staleness check exists for.
    const today = todayKey();
    const wantsSaved = (await searchParams).saved === today;
    const stale = !wantsSaved && generatedOn !== today;

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
        ? {
            listId: String(spareDoc._id),
            title: String(spareTitle),
            href: `/learn/${String(spareDoc._id)}/read?saved=${today}`,
          }
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
      resumeKey={resumeKey("items", `${list._id}:${step}`, runKey)}
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
