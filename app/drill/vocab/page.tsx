import DrillFlashcards from "@/components/drill/DrillFlashcards";
import RememberRunner from "@/components/drill/RememberRunner";
import VocabDrillRunner from "@/components/drill/VocabDrillRunner";
import {
  VOCAB_MODE_LABEL,
  isVocabMode,
  parseLength,
  parseSource,
  vocabHref,
  type VocabMode,
} from "@/components/drill/options";
import { buildDrillItems, orderWords, pickWords, type DrillList } from "@/components/drill/picks";
import { mulberry32 } from "@/lib/math/rng";
import { connectDB } from "@/lib/db";
import { WordList, toClient } from "@/lib/models/WordList";

export const dynamic = "force-dynamic";

/** One seed per request. The page is dynamic, so every visit is a new drill. */
function requestSeed(): number {
  return Date.now();
}

export const metadata = { title: "Word drill" };

const DONE_TITLE: Record<VocabMode, string> = {
  flashcards: "Cards done!",
  match: "Match done!",
  listen: "Good ears!",
  spell: "Spelled it!",
  use: "You used them!",
  write: "Spelling test done!",
  remember: "Time!",
  mixed: "Drill done!",
};

type Search = Promise<{ src?: string; mode?: string; n?: string; seed?: string }>;

export default async function VocabDrillPage({ searchParams }: { searchParams: Search }) {
  const q = await searchParams;
  const source = parseSource(q.src);
  const mode: VocabMode = q.mode && isVocabMode(q.mode) ? q.mode : "mixed";
  const count = parseLength(q.n);
  const seed = Number(q.seed) || requestSeed();

  await connectDB();
  const docs = await WordList.find().sort({ updatedAt: -1 }).lean();
  const lists: DrillList[] = docs
    .map(toClient)
    .filter((l) => l.words.length > 0)
    .map((l) => ({ listId: l._id, name: l.name, words: l.words }));

  const now = new Date();
  const rng = mulberry32(seed % 2147483647);
  const againHref = vocabHref({ source, mode, count });
  const sessionRef = `drill:vocab:${mode}`;
  const listId = source.kind === "list" ? source.listId : undefined;

  if (mode === "remember") {
    const list = lists.find((l) => l.listId === listId) ?? lists[0];
    return (
      <RememberRunner
        listId={list?.listId}
        listName={list?.name ?? "your words"}
        words={list ? list.words.map((w) => w.word) : []}
        sessionRef={sessionRef}
        againHref={againHref}
      />
    );
  }

  const picked = pickWords(lists, source, now);

  if (mode === "flashcards") {
    const cards = orderWords(picked, now, rng)
      .slice(0, count)
      .map((p) => ({ listId: p.pool.listId ?? "", word: p.word }));
    return (
      <DrillFlashcards cards={cards} sessionRef={sessionRef} againHref={againHref} />
    );
  }

  const items = buildDrillItems({ picked, mode, count, now, rng });

  return (
    <VocabDrillRunner
      items={items}
      sessionRef={sessionRef}
      listId={listId}
      title={DONE_TITLE[mode]}
      subtitle={`${VOCAB_MODE_LABEL[mode]} drill`}
      againHref={againHref}
      report={mode === "write"}
      emptyNote="No words match that pick. Try another one."
    />
  );
}
