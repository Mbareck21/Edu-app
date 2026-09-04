import { NextResponse } from "next/server";
import { z } from "zod";

import { connectDB } from "@/lib/db";
import { WordList, toClient } from "@/lib/models/WordList";
import { READING_THEMES, SCIENCE_UNITS } from "@/lib/curriculum";
import { packById } from "@/lib/word-packs";
import { fillClues } from "@/lib/fill-clues";
import { getClientIp, rateLimit } from "@/lib/groq";

export const runtime = "nodejs";
export const maxDuration = 30;

const Body = z.object({
  kind: z.enum(["science", "theme", "pack"]),
  id: z.string().min(1).max(60),
});

/** "School: Waves" — the name the Words tab groups these under. */
function listName(title: string): string {
  return `School: ${title}`;
}

export async function POST(req: Request) {
  const rl = rateLimit(getClientIp(req));
  if (!rl.ok) {
    return NextResponse.json(
      { error: "rate limit", retryAfterSec: rl.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

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

  // A pack ships its own clues, so it skips the AI call entirely.
  const pack = parsed.data.kind === "pack" ? packById(parsed.data.id) : undefined;
  const source =
    parsed.data.kind === "science"
      ? SCIENCE_UNITS.find((u) => u.id === parsed.data.id)
      : parsed.data.kind === "theme"
        ? READING_THEMES.find((t) => t.id === parsed.data.id)
        : undefined;
  if (!pack && !source) {
    return NextResponse.json({ error: "unknown unit" }, { status: 404 });
  }

  await connectDB();
  const name = listName(pack ? pack.name : source ? source.title : "");

  // One tap, one list: tapping again opens the list that is already there.
  // readingHistory is server-only and never reaches the client shape.
  const existing = await WordList.findOne({ name }).select("-readingHistory").lean();
  if (existing) {
    return NextResponse.json(toClient(existing), { status: 200 });
  }

  // The word banks carry a few multi-word entries ("rock layer"); the word
  // schema allows spaces, the worksheets handle them.
  const words = (pack ? pack.words.map((w) => w.word) : source ? source.words : [])
    .map((w) => w.trim().toLowerCase())
    .filter((w) => /^[a-z][a-z\s-]*$/.test(w))
    .slice(0, 24);

  // A pack's clues are hand-written for his exact spelling traps ("forty has
  // no u"). Never overwrite those with a generated one.
  const clues = pack
    ? Object.fromEntries(pack.words.map((w) => [w.word.toLowerCase(), w.clue]))
    : await fillClues(words);

  const doc = await WordList.create({
    name,
    hiddenMessage: "",
    words: words.map((w) => ({ word: w, clue: clues[w] ?? "", arabic: "", explanation: "" })),
  });

  return NextResponse.json(toClient(doc.toObject()), { status: 201 });
}
