import Link from "next/link";
import { notFound } from "next/navigation";
import mongoose from "mongoose";

import AppShell from "@/components/ui/AppShell";
import Icon from "@/components/ui/Icon";
import DeleteListButton from "@/components/words/DeleteListButton";
import WordListEditor, { type WordStates } from "@/components/words/WordListEditor";
import { currentLearner } from "@/lib/auth";
import { db } from "@/lib/db";
import { wordKnowledge } from "@/lib/mastery";
import { toClient } from "@/lib/models/WordList";

export const dynamic = "force-dynamic";

export default async function EditWordListPage({
  params,
}: {
  params: Promise<{ listId: string }>;
}) {
  const { listId } = await params;
  if (!mongoose.isValidObjectId(listId)) notFound();

  const { WordList } = await db();
  const doc = await WordList.findById(listId).lean();
  if (!doc) notFound();
  const list = toClient(doc);
  const me = await currentLearner();
  const states: WordStates = Object.fromEntries(
    list.words.map((w) => [w.word, wordKnowledge(w)])
  );

  return (
    <AppShell>
      <header className="pt-4 pb-5">
        <Link
          href="/me/lists"
          className="-ml-1 inline-flex min-h-11 items-center gap-1 pr-3 pl-1 text-sm font-bold"
          style={{ color: "var(--color-muted)" }}
        >
          <Icon name="arrowLeft" size={18} />
          All lists
        </Link>
        <h1 className="mt-2 font-display text-2xl font-bold leading-tight">
          {list.name.replace(/^School:\s*/i, "")}
        </h1>
        <p className="text-sm" style={{ color: "var(--color-muted)" }}>
          {list.words.length} words · reading level {list.readingLevel}
        </p>
      </header>

      <WordListEditor list={list} states={states} me={me} />

      {list.kind === "pool" || list.addedBy === me ? (
        <section className="mt-8 border-t pt-5" style={{ borderColor: "var(--color-line)" }}>
          <DeleteListButton id={list._id} name={list.name} leaveTo="/me/lists" />
        </section>
      ) : null}
    </AppShell>
  );
}
