import Link from "next/link";
import { notFound } from "next/navigation";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { WordList, toClient } from "@/lib/models/WordList";
import InteractiveReading from "@/components/InteractiveReading";
import ReadingStatsCard from "@/components/ReadingStats";

export const dynamic = "force-dynamic";

export default async function ReadingPage({
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

  return (
    <main className="mx-auto max-w-3xl px-4 py-6 space-y-4">
      <nav className="text-sm">
        <Link href={`/lists/${list._id}`} className="text-slate-600 hover:underline">
          ← Back to {list.name}
        </Link>
      </nav>
      <header>
        <h1 className="text-2xl font-bold">Reading — {list.name}</h1>
        <p className="text-sm text-slate-600">
          Read the short story and answer the questions one at a time.
        </p>
      </header>

      <InteractiveReading list={list} />
      <ReadingStatsCard stats={list.readingStats} level={list.readingLevel} />
    </main>
  );
}
