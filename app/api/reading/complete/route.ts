import { NextResponse } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import { db } from "@/lib/db";
import { toClient, READING_QUESTION_TYPES } from "@/lib/models/WordList";
import { ARCHIVE_MAX, readingWordsToAdd, type GlossWord } from "@/lib/reading";
import { addPoolWords, getPool } from "@/lib/word-source";

export const runtime = "nodejs";

const Body = z.object({
  listId: z.string().min(1),
  perQuestion: z
    .array(
      z.object({
        type: z.enum(READING_QUESTION_TYPES),
        firstTryCorrect: z.boolean(),
        hintsUsed: z.number().int().min(0).max(5),
      })
    )
    .min(1)
    .max(12),
});

const MAX_RECENT_SESSIONS = 20;

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  if (!mongoose.isValidObjectId(parsed.data.listId)) {
    return NextResponse.json({ error: "bad id" }, { status: 400 });
  }

  const { WordList } = await db();
  const doc = await WordList.findById(parsed.data.listId);
  if (!doc) return NextResponse.json({ error: "list not found" }, { status: 404 });

  const finished = doc.toObject().currentReading as
    | ({ paragraph?: unknown; vocabGlosses?: GlossWord[] } & Record<string, unknown>)
    | null
    | undefined;
  // No passage open means this one was already completed: a repeat post from a
  // page the back button served from cache, or a retry after a lost response.
  // Counting it again would add a second session to his reading stats, so the
  // repeat changes nothing and still reports success.
  if (!finished) return NextResponse.json(toClient(doc.toObject()));

  const perQ = parsed.data.perQuestion;
  const firstTry = perQ.filter((q) => q.firstTryCorrect).length;
  const hintsUsed = perQ.reduce((sum, q) => sum + q.hintsUsed, 0);
  const scorePct = Math.round((firstTry / perQ.length) * 100);
  const perfect = firstTry === perQ.length && hintsUsed === 0;
  const sessionLevel = Number(doc.currentReading?.level) || Number(doc.readingLevel) || 1;

  // Every change goes out in one write, and only onto the passage he read.
  // "New reading" tapped while this was saving used to write the same list
  // at the same moment; one save failed and the new passage was thrown away.
  const set: Record<string, unknown> = {};

  // Lifetime aggregates
  const stats = doc.readingStats ?? {};
  set["readingStats.totalSessions"] = (Number(stats.totalSessions) || 0) + 1;
  set["readingStats.totalQuestions"] = (Number(stats.totalQuestions) || 0) + perQ.length;
  set["readingStats.totalFirstTryCorrect"] = (Number(stats.totalFirstTryCorrect) || 0) + firstTry;
  set["readingStats.totalHintsUsed"] = (Number(stats.totalHintsUsed) || 0) + hintsUsed;

  // Per-type accumulators
  for (const q of perQ) {
    const path = `readingStats.byType.${q.type}`;
    const cur =
      (doc.get(path) as { asked?: number; firstTryCorrect?: number } | undefined) ?? {};
    // Two questions of one type in a passage: count from what this loop set.
    const asked = (set[`${path}.asked`] as number | undefined) ?? (Number(cur.asked) || 0);
    set[`${path}.asked`] = asked + 1;
    if (q.firstTryCorrect) {
      const right =
        (set[`${path}.firstTryCorrect`] as number | undefined) ?? (Number(cur.firstTryCorrect) || 0);
      set[`${path}.firstTryCorrect`] = right + 1;
    }
  }

  // Append session to rolling log (cap at MAX_RECENT_SESSIONS).
  const recent =
    (doc.get("readingStats.recentSessions") as Array<Record<string, unknown>> | undefined) ?? [];
  const nextRecent = [
    ...recent,
    {
      completedAt: new Date(),
      level: sessionLevel,
      scorePct,
      questionsCount: perQ.length,
      hintsUsed,
      perfect,
    },
  ].slice(-MAX_RECENT_SESSIONS);
  set["readingStats.recentSessions"] = nextRecent;

  // The reading ladder now lives on Profile.reading (POST
  // /api/sessions/complete moves it). The list's readingLevel just mirrors the
  // level the generator last used, so nothing bumps it here.

  // Clear the current reading — next Generate creates a fresh one.
  // A finished passage goes on the archive before it is cleared. This is the
  // passage most worth serving again on a day the writer is down, and clearing
  // it without archiving meant only unfinished passages were ever kept.
  if (typeof finished.paragraph === "string" && finished.paragraph) {
    const archive = doc.toObject().readingArchive;
    set["readingArchive"] = [...(Array.isArray(archive) ? archive : []), finished].slice(-ARCHIVE_MAX);
  }
  set["currentReading"] = null;

  const written = await WordList.updateOne(
    { _id: doc._id, "currentReading.generatedAt": finished.generatedAt as Date },
    { $set: set }
  );
  // Another passage took its place in between: this one is no longer open.
  if (written.matchedCount === 0) return NextResponse.json(toClient(doc.toObject()));

  // The highlighted words he met go into Words to fix, with their spelling
  // chains, so the writing trainer and every word test pick them up. Words
  // already there keep what they have.
  const glosses = Array.isArray(finished.vocabGlosses) ? finished.vocabGlosses : [];
  if (glosses.length > 0) {
    const pool = await getPool();
    const lists = await WordList.find({ kind: { $ne: "pool" } }, { words: 1 }).lean();
    const onLists = new Map<string, { clue: string; arabic: string }>();
    for (const l of lists) {
      for (const w of l.words ?? []) {
        const clue = String(w.clue ?? "");
        const arabic = String(w.arabic ?? "");
        const had = onLists.get(String(w.word));
        onLists.set(String(w.word), {
          clue: had?.clue || clue,
          arabic: had?.arabic || arabic,
        });
      }
    }
    const fresh = readingWordsToAdd(glosses, new Set(pool.words.map((w) => w.word)), onLists);
    await addPoolWords(pool._id, fresh);
  }

  const fresh = await WordList.findById(parsed.data.listId).lean();
  if (!fresh) {
    return NextResponse.json({ error: "list disappeared" }, { status: 500 });
  }
  return NextResponse.json(toClient(fresh));
}
