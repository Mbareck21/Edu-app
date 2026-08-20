import { notFound } from "next/navigation";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { WordList, toClient } from "@/lib/models/WordList";
import { scrambleAll } from "@/lib/scramble";
import { sampleWords, WORD_GAME_SESSION_SIZE } from "@/lib/session-sample";
import GameFrame from "@/components/games/GameFrame";
import InteractiveScramble from "@/components/InteractiveScramble";

export const dynamic = "force-dynamic";

export default async function ScramblePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) notFound();
  await connectDB();
  const doc = await WordList.findById(id).lean();
  if (!doc) notFound();
  const list = toClient(doc);

  // Cap any single session at WORD_GAME_SESSION_SIZE words; reload for a
  // fresh random pick.
  const sampled = sampleWords(list.words, WORD_GAME_SESSION_SIZE);
  const rows = scrambleAll(sampled.map((w) => w.word));

  // The play view shows each word's clue on its card. scrambleAll drops and
  // reorders nothing but the unusable entries, so match clues back by the
  // answer it produced rather than by index.
  const clueFor = new Map<string, string>();
  for (const w of list.words) {
    const key = w.word.toUpperCase().replace(/[^A-Z]/g, "");
    if (key && !clueFor.has(key)) clueFor.set(key, (w.clue || "").trim());
  }
  const playRows = rows.map((r) => ({
    ...r,
    clue: clueFor.get(r.answer.replace(/[^A-Z]/g, "")) ?? "",
  }));

  return (
    <GameFrame
      title="Word Scramble"
      listName={list.name}
      backHref={`/words/${list._id}`}
      color="green"
      icon="sparkles"
      printView={<PrintView listName={list.name} rows={rows} />}
      playView={<InteractiveScramble rows={playRows} />}
    />
  );
}

function PrintView({
  listName,
  rows,
}: {
  listName: string;
  rows: { scrambled: string; answer: string }[];
}) {
  return (
    <>
      <section>
        <h1 className="mb-1 text-3xl font-bold">Word Scramble</h1>
        <p className="mb-4 text-sm text-slate-600">{listName}</p>
        <p className="mb-6 text-base">Unscramble each word.</p>
        <ol className="space-y-5 text-lg">
          {rows.map((r, i) => (
            <li key={i} className="flex flex-wrap items-center gap-4">
              <span className="scramble-scrambled font-bold min-w-40">{r.scrambled}</span>
              <span className="inline-flex gap-1">
                {r.answer.split("").map((ch, j) =>
                  ch === " " ? (
                    <span key={j} className="inline-block w-3" aria-hidden />
                  ) : (
                    <span key={j} className="scramble-box" aria-hidden />
                  )
                )}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <div className="page-break-after" />

      <section>
        <h1 className="mb-1 text-3xl font-bold">Answer Key</h1>
        <p className="mb-4 text-sm text-slate-600">{listName}</p>
        <ol className="space-y-2 text-lg">
          {rows.map((r, i) => (
            <li key={i} className="flex gap-4">
              <span className="font-bold tracking-widest min-w-32">{r.scrambled}</span>
              <span className="font-semibold tracking-widest">→ {r.answer}</span>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
