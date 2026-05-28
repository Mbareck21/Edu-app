import { notFound } from "next/navigation";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { WordList, toClient } from "@/lib/models/WordList";
import { buildCrossword } from "@/lib/crossword";
import { sampleWords, WORD_GAME_SESSION_SIZE } from "@/lib/session-sample";
import WorksheetFrame from "@/components/WorksheetFrame";
import CrosswordGrid from "@/components/CrosswordGrid";
import { PlayProvider, PlayToggleButton, PlayPaneSwitcher } from "@/components/PlayToggle";
import InteractiveCrossword from "@/components/InteractiveCrossword";

export const dynamic = "force-dynamic";

export default async function CrosswordPage({
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
  const result = buildCrossword(sampled);

  // If the crossword generator fell back, no interactive mode either.
  if (!result.ok) {
    return (
      <WorksheetFrame title="Crossword" listName={list.name} backHref={`/lists/${list._id}`}>
        <FallbackList
          list={{ name: list.name, words: sampled }}
          reason={result.reason}
          skipped={result.skipped}
        />
      </WorksheetFrame>
    );
  }

  return (
    <PlayProvider>
      <WorksheetFrame
        title="Crossword"
        listName={list.name}
        backHref={`/lists/${list._id}`}
        extraHeaderRight={<PlayToggleButton />}
      >
        <PlayPaneSwitcher
          printView={<PrintView listName={list.name} result={result} />}
          playView={
            <InteractiveCrossword
              listName={list.name}
              rows={result.rows}
              cols={result.cols}
              grid={result.grid}
              placed={result.placed}
              across={result.across}
              down={result.down}
            />
          }
        />
      </WorksheetFrame>
    </PlayProvider>
  );
}

function FallbackList({
  list,
  reason,
  skipped,
}: {
  list: { name: string; words: { word: string; clue: string }[] };
  reason: string;
  skipped: string[];
}) {
  return (
    <section>
      <h1 className="mb-2 text-2xl font-bold">Definitions worksheet — {list.name}</h1>
      <p className="mb-4 text-sm text-slate-600">
        Note: a crossword layout could not be generated for these words ({reason}). Here is a definitions list instead.
      </p>
      {skipped.length > 0 && (
        <p className="mb-4 text-sm text-amber-700">
          Skipped (the crossword grid only fits single letter-only words): {skipped.join(", ")}.
        </p>
      )}
      <ol className="space-y-2 text-lg">
        {list.words.map((w, i) => (
          <li key={i}>
            <strong>{i + 1}.</strong> {w.clue || "(no clue yet)"}{" "}
            <span className="ml-4 inline-block min-w-32 border-b border-black">&nbsp;</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function PrintView({
  listName,
  result,
}: {
  listName: string;
  result: Extract<ReturnType<typeof buildCrossword>, { ok: true }>;
}) {
  return (
    <>
      <Page1 listName={listName} result={result} />
      <div className="page-break-after" />
      <Page2 listName={listName} result={result} />
    </>
  );
}

function Page1({
  listName,
  result,
}: {
  listName: string;
  result: Extract<ReturnType<typeof buildCrossword>, { ok: true }>;
}) {
  return (
    <section>
      <h1 className="mb-1 text-3xl font-bold">Crossword Puzzle</h1>
      <p className="mb-4 text-sm text-slate-600">{listName}</p>
      <div className="mb-6">
        <CrosswordGrid {...result} showAnswers={false} />
      </div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <CluesColumn title="ACROSS" entries={result.across} />
        <CluesColumn title="DOWN" entries={result.down} />
      </div>
      {result.unplaced.length > 0 && (
        <p className="mt-6 text-xs text-slate-500">
          Note: these words could not fit in the grid: {result.unplaced.join(", ")}.
        </p>
      )}
      {result.skipped.length > 0 && (
        <p className="mt-2 text-xs text-slate-500">
          Skipped (phrases / non-letters): {result.skipped.join(", ")}.
        </p>
      )}
    </section>
  );
}

function Page2({
  listName,
  result,
}: {
  listName: string;
  result: Extract<ReturnType<typeof buildCrossword>, { ok: true }>;
}) {
  return (
    <section>
      <h1 className="mb-1 text-3xl font-bold">Answer Key</h1>
      <p className="mb-4 text-sm text-slate-600">{listName}</p>
      <CrosswordGrid {...result} showAnswers />
    </section>
  );
}

function CluesColumn({
  title,
  entries,
}: {
  title: string;
  entries: { position: number; clue: string; word: string }[];
}) {
  return (
    <div>
      <h2 className="mb-2 border-b border-black pb-1 text-center text-sm font-bold tracking-wider">{title}</h2>
      <ol className="space-y-1.5 text-sm">
        {entries.map((e) => (
          <li key={e.position}>
            <strong>{e.position}.</strong> {e.clue || `(${e.word.length} letters)`}
          </li>
        ))}
      </ol>
    </div>
  );
}
