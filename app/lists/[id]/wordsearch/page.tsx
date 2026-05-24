import { notFound } from "next/navigation";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { WordList, toClient } from "@/lib/models/WordList";
import { buildWordSearch } from "@/lib/wordsearch";
import WorksheetFrame from "@/components/WorksheetFrame";
import WordSearchGrid from "@/components/WordSearchGrid";
import { PlayProvider, PlayToggleButton, PlayPaneSwitcher } from "@/components/PlayToggle";
import InteractiveWordSearch from "@/components/InteractiveWordSearch";

export const dynamic = "force-dynamic";

export default async function WordSearchPage({
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

  const result = buildWordSearch(
    list.words.map((w) => w.word),
    list.hiddenMessage
  );

  if (!result.ok) {
    return (
      <WorksheetFrame title="Word Search" listName={list.name} backHref={`/lists/${list._id}`}>
        <section>
          <h1 className="mb-2 text-2xl font-bold">Word Search — {list.name}</h1>
          <p className="text-red-600">{result.reason}</p>
        </section>
      </WorksheetFrame>
    );
  }

  return (
    <PlayProvider>
      <WorksheetFrame
        title="Word Search"
        listName={list.name}
        backHref={`/lists/${list._id}`}
        extraHeaderRight={<PlayToggleButton />}
      >
        <PlayPaneSwitcher
          printView={
            <PrintView
              listName={list.name}
              hiddenMessage={list.hiddenMessage}
              wordsToFind={list.words.map((w) => w.word.toUpperCase())}
              result={result}
            />
          }
          playView={
            <InteractiveWordSearch
              listName={list.name}
              rows={result.rows}
              cols={result.cols}
              grid={result.grid}
              words={list.words.map((w) => w.word)}
            />
          }
        />
      </WorksheetFrame>
    </PlayProvider>
  );
}

function PrintView({
  listName,
  hiddenMessage,
  wordsToFind,
  result,
}: {
  listName: string;
  hiddenMessage: string;
  wordsToFind: string[];
  result: Extract<ReturnType<typeof buildWordSearch>, { ok: true }>;
}) {
  return (
    <>
      <section>
        <h1 className="mb-1 text-3xl font-bold">Hidden Message-Puzzle</h1>
        <p className="mb-4 text-sm text-slate-600">{listName}</p>
        <div className="mb-6">
          <WordSearchGrid {...result} highlight={[]} />
        </div>
        <WordsToFind words={wordsToFind} />
        {result.hiddenMessage.length > 0 && <HiddenMessageBlanks length={result.hiddenMessage.length} />}
        <Instructions hasHidden={result.hiddenMessage.length > 0} />
      </section>

      <div className="page-break-after" />

      <section>
        <h1 className="mb-1 text-3xl font-bold">Answer Key</h1>
        <p className="mb-4 text-sm text-slate-600">{listName}</p>
        <div className="mb-6">
          <WordSearchGrid {...result} highlight={result.placements} />
        </div>
        <p className="text-base">
          <strong>Hidden message:</strong>{" "}
          <span className="uppercase tracking-wider">{hiddenMessage || "(none)"}</span>
        </p>
      </section>
    </>
  );
}

function WordsToFind({ words }: { words: string[] }) {
  return (
    <div className="mb-4 rounded border border-black p-3">
      <p className="mb-2 text-center text-sm font-bold tracking-wider">WORDS TO FIND</p>
      <ul className="grid grid-cols-2 gap-x-6 gap-y-1 text-base sm:grid-cols-3 md:grid-cols-4">
        {words.map((w) => (
          <li key={w}>{w}</li>
        ))}
      </ul>
    </div>
  );
}

function HiddenMessageBlanks({ length }: { length: number }) {
  return (
    <div className="mb-2 flex flex-wrap gap-2">
      {Array.from({ length }).map((_, i) => (
        <span
          key={i}
          className="inline-block w-6 border-b-2 border-black text-center text-lg"
          aria-hidden
        >
          &nbsp;
        </span>
      ))}
    </div>
  );
}

function Instructions({ hasHidden }: { hasHidden: boolean }) {
  return (
    <p className="text-sm text-slate-700">
      Find every word in the list. Words can go in any direction — across, down, diagonal, or backward. Letters can be shared between words.
      {hasHidden && " When you finish, copy the unused letters left-to-right, top-to-bottom into the blanks above to reveal the hidden message."}
    </p>
  );
}
