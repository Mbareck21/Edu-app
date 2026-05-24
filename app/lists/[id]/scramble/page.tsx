import { notFound } from "next/navigation";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { WordList, toClient } from "@/lib/models/WordList";
import { scrambleAll } from "@/lib/scramble";
import WorksheetFrame from "@/components/WorksheetFrame";

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

  const rows = scrambleAll(list.words.map((w) => w.word));

  return (
    <WorksheetFrame title="Word Scramble" listName={list.name} backHref={`/lists/${list._id}`}>
      <section>
        <h1 className="mb-1 text-3xl font-bold">Word Scramble</h1>
        <p className="mb-4 text-sm text-slate-600">{list.name}</p>
        <p className="mb-6 text-base">Unscramble each word.</p>
        <ol className="space-y-5 text-lg">
          {rows.map((r, i) => (
            <li key={i} className="flex flex-wrap items-center gap-4">
              <span className="scramble-scrambled font-bold min-w-40">{r.scrambled}</span>
              <span className="inline-flex gap-1">
                {Array.from({ length: r.answer.length }).map((_, j) => (
                  <span
                    key={j}
                    className="scramble-box"
                    aria-hidden
                  />
                ))}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <div className="page-break-after" />

      <section>
        <h1 className="mb-1 text-3xl font-bold">Answer Key</h1>
        <p className="mb-4 text-sm text-slate-600">{list.name}</p>
        <ol className="space-y-2 text-lg">
          {rows.map((r, i) => (
            <li key={i} className="flex gap-4">
              <span className="font-bold tracking-widest min-w-32">{r.scrambled}</span>
              <span className="font-semibold tracking-widest">→ {r.answer}</span>
            </li>
          ))}
        </ol>
      </section>
    </WorksheetFrame>
  );
}
