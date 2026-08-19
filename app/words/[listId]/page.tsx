import Link from "next/link";
import { notFound } from "next/navigation";
import mongoose from "mongoose";

import AppShell from "@/components/ui/AppShell";
import Icon from "@/components/ui/Icon";
import WordListEditor, { type WordStates } from "@/components/words/WordListEditor";
import { connectDB } from "@/lib/db";
import { wordKnowledge } from "@/lib/mastery";
import { WordList, toClient } from "@/lib/models/WordList";

export const dynamic = "force-dynamic";

export default async function EditWordListPage({
  params,
}: {
  params: Promise<{ listId: string }>;
}) {
  const { listId } = await params;
  if (!mongoose.isValidObjectId(listId)) notFound();

  await connectDB();
  const doc = await WordList.findById(listId).lean();
  if (!doc) notFound();
  const list = toClient(doc);
  const states: WordStates = Object.fromEntries(
    list.words.map((w) => [w.word, wordKnowledge(w)])
  );

  return (
    <AppShell>
      <header className="pt-4 pb-5">
        <Link
          href="/words"
          className="inline-flex items-center gap-1 text-sm font-bold"
          style={{ color: "var(--color-muted)" }}
        >
          <Icon name="arrowLeft" size={18} />
          All lists
        </Link>
        <h1 className="mt-2 font-display text-2xl font-bold">{list.name}</h1>
        <p className="text-sm" style={{ color: "var(--color-muted)" }}>
          {list.words.length} words · reading level {list.readingLevel}
        </p>
      </header>

      <WordListEditor list={list} states={states} />

      <section className="mt-6">
        <p
          className="mb-2 text-xs font-bold uppercase tracking-wide"
          style={{ color: "var(--color-muted)" }}
        >
          Print
        </p>
        <div className="flex flex-wrap gap-2">
          {[
            { href: `/lists/${list._id}/crossword`, label: "Crossword" },
            { href: `/lists/${list._id}/scramble`, label: "Scramble" },
            { href: `/lists/${list._id}/wordsearch`, label: "Word search" },
          ].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="press-3d inline-flex h-11 items-center rounded-full border-2 px-4 font-display text-sm font-bold"
              style={{
                borderColor: "var(--color-line)",
                background: "#fff",
                color: "var(--color-ink)",
                ["--btn-shade" as string]: "var(--color-line)",
              }}
            >
              {l.label}
            </Link>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
