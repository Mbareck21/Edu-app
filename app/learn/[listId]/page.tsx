import mongoose from "mongoose";
import Link from "next/link";
import { notFound } from "next/navigation";

import PathNodes, { nodeStates } from "@/components/learn/PathNodes";
import AppShell from "@/components/ui/AppShell";
import Card from "@/components/ui/Card";
import Icon from "@/components/ui/Icon";
import ProgressBar from "@/components/ui/ProgressBar";
import { connectDB } from "@/lib/db";
import { countKnowledge } from "@/lib/mastery";
import { WordList, toClient } from "@/lib/models/WordList";
import { STEPS } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PathPage({
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

  const doneCount = nodeStates(list.pathProgress).filter((n) => n === "done").length;
  const counts = countKnowledge(list.words);

  return (
    <AppShell>
      <header className="flex items-center gap-3 pt-3 pb-2">
        <Link
          href="/"
          aria-label="Back"
          className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
          style={{ color: "var(--color-muted)" }}
        >
          <Icon name="arrowLeft" size={24} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-xl font-bold">{list.name}</h1>
          <p className="font-body text-sm" style={{ color: "var(--color-muted)" }}>
            {doneCount} of {STEPS.length} done
          </p>
        </div>
      </header>

      <ProgressBar value={doneCount / STEPS.length} color="green" label="Unit progress" />

      <div className="mt-4">
        <PathNodes listId={list._id} progress={list.pathProgress} />
      </div>

      <Card className="mt-2 mb-4 flex items-center gap-3">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
          style={{ background: "var(--color-green-soft)", color: "var(--color-green-dark)" }}
        >
          <Icon name="book" size={22} />
        </span>
        <p className="font-body text-sm leading-snug">
          <strong>{counts.known + counts.mastered}</strong> of {list.words.length} words known.
          {counts.new > 0 ? ` ${counts.new} still new.` : ""}
        </p>
      </Card>
    </AppShell>
  );
}
