import Link from "next/link";
import { connectDB } from "@/lib/db";
import { WordList, toClient } from "@/lib/models/WordList";
import NewListForm from "@/components/NewListForm";
import DeleteListButton from "@/components/DeleteListButton";

export const dynamic = "force-dynamic";

export default async function Home() {
  await connectDB();
  const docs = await WordList.find().sort({ updatedAt: -1 }).lean();
  const lists = docs.map(toClient);

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Edu-App</h1>
          <p className="text-slate-600">English worksheets and AI buddy.</p>
        </div>
        <Link href="/chat" className="btn-secondary">AI Chat</Link>
      </header>

      <section className="card mb-6">
        <h2 className="mb-3 text-lg font-semibold">Create a new word list</h2>
        <NewListForm />
      </section>

      <section className="card">
        <h2 className="mb-3 text-lg font-semibold">Your word lists</h2>
        {lists.length === 0 ? (
          <p className="text-slate-600">No lists yet. Create one above to get started.</p>
        ) : (
          <ul className="divide-y divide-slate-200">
            {lists.map((l) => (
              <li key={l._id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <Link href={`/lists/${l._id}`} className="font-medium text-slate-900 hover:underline">
                    {l.name}
                  </Link>
                  <p className="text-sm text-slate-500">
                    {l.words.length} word{l.words.length === 1 ? "" : "s"} · updated {new Date(l.updatedAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/lists/${l._id}`} className="btn-secondary">Edit</Link>
                  <Link href={`/lists/${l._id}/crossword`} className="btn-secondary">Crossword</Link>
                  <Link href={`/lists/${l._id}/scramble`} className="btn-secondary">Scramble</Link>
                  <Link href={`/lists/${l._id}/wordsearch`} className="btn-secondary">Word Search</Link>
                  <DeleteListButton id={l._id} name={l.name} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
