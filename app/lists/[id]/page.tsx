import Link from "next/link";
import { notFound } from "next/navigation";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { WordList, toClient } from "@/lib/models/WordList";
import ListEditor from "@/components/ListEditor";

export const dynamic = "force-dynamic";

export default async function EditListPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) notFound();

  await connectDB();
  const doc = await WordList.findById(id).lean();
  if (!doc) notFound();
  const list = toClient(doc);

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <nav className="mb-6 text-sm">
        <Link href="/" className="text-slate-600 hover:underline">← All lists</Link>
      </nav>
      <header className="mb-6">
        <h1 className="text-2xl font-bold">{list.name}</h1>
        <p className="text-sm text-slate-500">Edit words and clues, then open a worksheet to print.</p>
      </header>
      <ListEditor list={list} />
    </main>
  );
}
