import { notFound } from "next/navigation";

import ItemRunner from "@/components/items/ItemRunner";
import { connectDB } from "@/lib/db";
import {
  buildLesson,
  buildProductionSession,
  buildReviewSession,
} from "@/lib/lesson-builder";
import { mulberry32 } from "@/lib/math/rng";
import { WordList, toClient, type ClientWordList } from "@/lib/models/WordList";

export const dynamic = "force-dynamic";

/** One seed per request. Every visit builds a fresh session. */
function requestSeed(): number {
  return Date.now();
}

const BEATS = ["review", "new-words", "production"] as const;
type Beat = (typeof BEATS)[number];

function isBeat(v: string): v is Beat {
  return (BEATS as readonly string[]).includes(v);
}

const TITLE: Record<Beat, string> = {
  review: "Review done!",
  "new-words": "New words learned!",
  production: "You wrote and used them!",
};

function needsExamples(list: ClientWordList): boolean {
  // Only a word with no examples at all is worth a refill — an empty family is
  // normal for plenty of words.
  return list.words.some((w) => w.examples.length === 0);
}

export default async function TodayBeatPage({
  params,
}: {
  params: Promise<{ beat: string }>;
}) {
  const { beat } = await params;
  if (!isBeat(beat)) notFound();

  await connectDB();
  const docs = await WordList.find().sort({ updatedAt: -1 }).lean();
  const lists = docs.map(toClient).filter((l) => l.words.length > 0);
  const seed = requestSeed();
  const now = new Date(seed);
  const rng = mulberry32(seed % 2147483647);
  const unit = lists[0];
  const fill = lists.filter(needsExamples).map((l) => l._id);

  const shared = {
    exitHref: "/",
    primary: { label: "Back to Learn", href: "/" },
    secondary: { label: "Again", href: `/learn/today/${beat}?r=${seed}` },
    fillExamples: fill.length > 0 ? fill : undefined,
    emptyNote: "Add a word list first, then come back.",
  };

  if (beat === "review") {
    const items = buildReviewSession({
      lists: lists.map((l) => ({ listId: l._id, words: l.words })),
      now,
      rng,
    });
    return (
      <ItemRunner
        {...shared}
        items={items}
        post={{ ref: "quest:review", perList: true }}
        accent="green"
        title={TITLE.review}
        subtitle="Everything that was due today."
      />
    );
  }

  if (beat === "new-words") {
    const items = unit
      ? buildLesson({
          words: unit.words,
          step: "match",
          now,
          rng,
          maxNew: 3,
          listId: unit._id,
        })
      : [];
    return (
      <ItemRunner
        {...shared}
        items={items}
        post={{ ref: "quest:new", listId: unit?._id }}
        accent="blue"
        title={TITLE["new-words"]}
        subtitle={unit?.name}
      />
    );
  }

  const items = unit
    ? buildProductionSession({ words: unit.words, now, rng, listId: unit._id })
    : [];
  return (
    <ItemRunner
      {...shared}
      items={items}
      post={{ ref: "quest:production", listId: unit?._id }}
      accent="purple"
      title={TITLE.production}
      subtitle={unit?.name}
    />
  );
}

export async function generateMetadata({ params }: { params: Promise<{ beat: string }> }) {
  const { beat } = await params;
  const name = beat === "new-words" ? "New words" : beat === "review" ? "Review" : "Production";
  return { title: name };
}
