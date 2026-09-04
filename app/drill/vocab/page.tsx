import ChainRunner from "@/components/stuck/ChainRunner";
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
import { requestSeed } from "@/components/ui/time";
import { mulberry32 } from "@/lib/math/rng";
import { SpellChain } from "@/lib/models/SpellChain";
import { ROTATE_WIDTH, newChain, type ChainState } from "@/lib/spell-chain";
import { connectDB } from "@/lib/db";
import { getPractice } from "@/lib/word-source";

export const dynamic = "force-dynamic";

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
  // Remount key. "Again" pushes the same route with a new ?seed, and React
  // keeps a same-type component's state across that soft navigation — so
  // without a changing key the finished screen just re-renders itself.
  const runKey = q.seed ?? "first";

  await connectDB();
  // Pool first: the words he is stuck on get the slot ahead of the units, so
  // they are shuffled through the drill like anything else he is learning.
  const lists: DrillList[] = (await getPractice())
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
        key={runKey}
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
    // Was a flip card rated Easy or Hard by the child himself, which is not
    // evidence of anything. It is the writing drill now: same mode slot, so
    // his saved drill settings still resolve.
    const top = orderWords(picked, now, rng).slice(0, ROTATE_WIDTH);
    const chosen = top.map((p) => p.word.word);
    const rows = chosen.length > 0 ? await SpellChain.find({ word: { $in: chosen } }).lean() : [];
    const senses: Record<string, { clue: string; arabic: string }> = {};
    const chains: Record<string, ChainState> = {};
    for (const p of top) {
      senses[p.word.word] = { clue: p.word.clue, arabic: p.word.arabic };
    }
    for (const word of chosen) {
      const row = rows.find((r) => r.word === word);
      chains[word] = row
        ? {
            word,
            current: Number(row.current) || 0,
            best: Number(row.best) || 0,
            reps: Number(row.reps) || 0,
            attempts: Number(row.attempts) || 0,
            graduatedAt: row.graduatedAt ? new Date(row.graduatedAt).toISOString() : null,
          }
        : newChain(word);
      if (!senses[word]) senses[word] = { clue: "", arabic: "" };
    }
    return (
      <ChainRunner
        key={runKey}
        words={chosen}
        senses={senses}
        chains={chains}
        exit={{ label: "Again", href: againHref }}
      />
    );
  }

  const items = buildDrillItems({ picked, mode, count, now, rng });

  return (
    <VocabDrillRunner
      key={runKey}
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
