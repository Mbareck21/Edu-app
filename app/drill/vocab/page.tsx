import ChainRunner from "@/components/stuck/ChainRunner";
import RememberRunner from "@/components/drill/RememberRunner";
import RescueRunner from "@/components/drill/RescueRunner";
import VocabDrillRunner from "@/components/drill/VocabDrillRunner";
import {
  VOCAB_MODE_LABEL,
  isVocabMode,
  parseLength,
  parseSource,
  type VocabMode,
} from "@/components/drill/options";
import { buildDrillItems, orderWords, pickWords, withFill, type DrillList } from "@/components/drill/picks";
import ExitBar from "@/components/ui/ExitBar";
import KidGuard from "@/components/ui/KidGuard";
import { requestSeed } from "@/components/ui/time";
import { mulberry32 } from "@/lib/math/rng";
import { ROTATE_WIDTH, fromRow, type ChainState } from "@/lib/spell-chain";
import { requireSuggestedDrill } from "@/lib/assigned-data";
import { db } from "@/lib/db";
import { rescuable } from "@/lib/rescue";
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
  rescue: "Rescue done!",
  mixed: "Drill done!",
};

type Search = Promise<{ src?: string; mode?: string; n?: string; seed?: string }>;

export default async function VocabDrillPage({ searchParams }: { searchParams: Search }) {
  const q = await searchParams;
  // A child drills what the Drill tab suggests, not words and a type he picks.
  await requireSuggestedDrill("/drill/vocab", q);
  const source = parseSource(q.src);
  const mode: VocabMode = q.mode && isVocabMode(q.mode) ? q.mode : "mixed";
  const count = parseLength(q.n);
  const seed = Number(q.seed) || requestSeed();
  // Remount key. "Next drill" can land on the same route with a new ?seed, and React
  // keeps a same-type component's state across that soft navigation — so
  // without a changing key the finished screen just re-renders itself.
  const runKey = q.seed ?? "first";

  const { SpellChain } = await db();
  // Pool first: the words he is stuck on get the slot ahead of the units, so
  // they are shuffled through the drill like anything else he is learning.
  const lists: DrillList[] = (await getPractice())
    .filter((l) => l.words.length > 0)
    .map((l) => ({ listId: l._id, name: l.name, words: l.words }));

  const now = new Date();
  const rng = mulberry32(seed % 2147483647);
  const sessionRef = `drill:vocab:${mode}`;
  const listId = source.kind === "list" ? source.listId : undefined;

  if (mode === "remember") {
    const list = lists.find((l) => l.listId === listId) ?? lists[0];
    return (
      <>
        <KidGuard />
        <RememberRunner
          key={runKey}
          listId={list?.listId}
          listName={list?.name ?? "your words"}
          words={list ? list.words.map((w) => w.word) : []}
          sessionRef={sessionRef}
        />
      </>
    );
  }

  const picked = pickWords(lists, source, now);

  if (mode === "rescue") {
    // The words he most needs, one of each, as long as each makes a fair puzzle.
    const seen = new Set<string>();
    const words = orderWords(picked, now, rng)
      .map((p) => p.word)
      .filter((w) => rescuable(w.word) && !seen.has(w.word) && Boolean(seen.add(w.word)))
      .slice(0, count)
      .map((w) => ({ word: w.word, clue: w.clue, arabic: w.arabic }));
    return (
      <>
        <KidGuard />
        <RescueRunner
          key={runKey}
          words={words}
          seed={seed}
          sessionRef={sessionRef}
          listId={listId}
        />
      </>
    );
  }

  if (mode === "flashcards") {
    // Was a flip card rated Easy or Hard by the child himself, which is not
    // evidence of anything. It is the writing drill now: same mode slot, so
    // his saved drill settings still resolve.
    const top = orderWords(picked, now, rng).slice(0, ROTATE_WIDTH);
    const chosen = top.map((p) => p.word.word);
    // Senses and chains for every picked word, not just the chosen few: a
    // sitting that resumes after a reload keeps the words it started with.
    const allWords = picked.map((p) => p.word.word);
    const rows = allWords.length > 0 ? await SpellChain.find({ word: { $in: allWords } }).lean() : [];
    const senses: Record<string, { clue: string; arabic: string }> = {};
    const chains: Record<string, ChainState> = {};
    for (const p of picked) {
      senses[p.word.word] = { clue: p.word.clue, arabic: p.word.arabic };
    }
    for (const word of allWords) {
      const row = rows.find((r) => r.word === word);
      chains[word] = fromRow(word, row);
      if (!senses[word]) senses[word] = { clue: "", arabic: "" };
    }
    return (
      <>
        <KidGuard />
        <ExitBar href="/drill" label="Drill" />
        <ChainRunner
          key={runKey}
          words={chosen}
          senses={senses}
          chains={chains}
          // One saved sitting per source: a half-done weak-words sitting must
          // not come back inside an All-words or a list drill.
          resumeId={`drill:write:${q.src ?? "all"}`}
          // Posted like every other drill: without it the sitting paid no XP and
          // left no trace, so the suggestion never saw it played and "Next drill"
          // dealt the same writing sitting on the same words again and again.
          post={{ ref: sessionRef }}
          exit={{ label: "Next drill", href: "/drill/next" }}
        />
      </>
    );
  }

  // A weak or due pick of two or three words is topped up (see withFill).
  const dealt = source.kind === "weak" || source.kind === "due" ? withFill(picked, lists, count, now, rng) : picked;
  const items = buildDrillItems({ picked: dealt, mode, count, now, rng });

  return (
    <>
      <KidGuard />
      <VocabDrillRunner
        key={runKey}
        items={items}
        sessionRef={sessionRef}
        listId={listId}
        title={DONE_TITLE[mode]}
        subtitle={`${VOCAB_MODE_LABEL[mode]} drill`}
        report={mode === "write"}
        emptyNote="No words match that pick. Try another one."
      />
    </>
  );
}
