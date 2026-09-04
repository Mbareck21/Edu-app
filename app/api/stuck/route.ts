import { NextResponse } from "next/server";
import { z } from "zod";

import { connectDB } from "@/lib/db";
import { WordList, toClient } from "@/lib/models/WordList";
import { SpellChain } from "@/lib/models/SpellChain";
import { getPool } from "@/lib/word-source";
import { parseWordEntry } from "@/lib/stuck-entry";
import { fillArabic, fillClues } from "@/lib/fill-clues";

export const runtime = "nodejs";

const Body = z.object({ text: z.string().min(1).max(2000) });

/** Add one or several stuck words. Returns the pool and what did not take. */
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

  const entry = parseWordEntry(parsed.data.text);
  if (entry.words.length === 0) {
    return NextResponse.json(
      { error: "No words there. Type one, or several separated by commas.", rejected: entry.rejected },
      { status: 400 }
    );
  }

  const pool = await getPool();
  const existing = new Set(pool.words.map((w) => w.word));
  const fresh = entry.words.filter((w) => !existing.has(w));

  // Every word still without a meaning, new ones and any old ones that missed
  // out. A word with no clue can only reach the spelling tests: everything
  // that asks "which word means this?" needs a meaning to show, so it would
  // sit out the very tests it was added for. One call covers both, and the
  // old ones riding along heals anything that landed while the writer was
  // rate-limited. Best effort throughout: a missing clue never blocks a word.
  const needClue = pool.words.filter((w) => !w.clue.trim()).map((w) => w.word);
  const needArabic = pool.words.filter((w) => !w.arabic.trim()).map((w) => w.word);
  // Both in parallel: he is waiting with the worksheet in front of him.
  const [clues, arabic] = await Promise.all([
    fillClues([...fresh, ...needClue]),
    fillArabic([...fresh, ...needArabic]),
  ]);

  for (const word of new Set([...needClue, ...needArabic])) {
    const patch: Record<string, string> = {};
    if (clues[word]) patch["words.$.clue"] = clues[word];
    if (arabic[word]) patch["words.$.arabic"] = arabic[word];
    if (Object.keys(patch).length === 0) continue;
    await WordList.updateOne({ _id: pool._id, "words.word": word }, { $set: patch });
  }

  if (fresh.length > 0) {
    await WordList.updateOne(
      { _id: pool._id },
      {
        $push: {
          words: {
            $each: fresh.map((word) => ({
              word,
              clue: clues[word] ?? "",
              arabic: arabic[word] ?? "",
            })),
          },
        },
      }
    );
    // A word he has been stuck on before keeps the chain it already had —
    // re-adding it must not wipe a run he earned. $setOnInsert only.
    await SpellChain.bulkWrite(
      fresh.map((word) => ({
        updateOne: { filter: { word }, update: { $setOnInsert: { word } }, upsert: true },
      }))
    );
  }

  await connectDB();
  const after = await WordList.findById(pool._id).lean();
  return NextResponse.json({
    list: after ? toClient(after) : pool,
    added: fresh,
    alreadyThere: entry.words.filter((w) => existing.has(w)),
    rejected: entry.rejected,
  });
}

/** Remove one word from the pool. Its chain record is kept. */
export async function DELETE(req: Request) {
  const word = new URL(req.url).searchParams.get("word")?.trim().toLowerCase();
  if (!word) return NextResponse.json({ error: "word required" }, { status: 400 });
  const pool = await getPool();
  await WordList.updateOne({ _id: pool._id }, { $pull: { words: { word } } });
  const after = await WordList.findById(pool._id).lean();
  return NextResponse.json({ list: after ? toClient(after) : pool });
}
