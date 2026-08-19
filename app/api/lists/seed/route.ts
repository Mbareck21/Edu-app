import { NextResponse } from "next/server";
import { z } from "zod";

import { connectDB } from "@/lib/db";
import { WordList, toClient } from "@/lib/models/WordList";
import { READING_THEMES, SCIENCE_UNITS } from "@/lib/curriculum";
import { groq, CLUE_MODEL, CLUE_SYSTEM_PROMPT } from "@/lib/groq";

export const runtime = "nodejs";
export const maxDuration = 30;

const Body = z.object({
  kind: z.enum(["science", "theme"]),
  id: z.string().min(1).max(60),
});

/** "School: Waves" — the name the Words tab groups these under. */
function listName(title: string): string {
  return `School: ${title}`;
}

/**
 * One Groq call fills the clues for a freshly seeded list. Failure is fine —
 * the parent can hit "AI suggest clues" in the editor later.
 */
async function fillClues(words: string[]): Promise<Record<string, string>> {
  try {
    const completion = await groq().chat.completions.create({
      model: CLUE_MODEL,
      messages: [
        { role: "system", content: CLUE_SYSTEM_PROMPT },
        { role: "user", content: `Write a clue for each of these words:\n${words.join(", ")}` },
      ],
      response_format: { type: "json_object" },
      temperature: 0.6,
      max_tokens: 1400,
    });
    const payload = JSON.parse(completion.choices[0]?.message?.content || "{}") as {
      clues?: Record<string, string>;
    };
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
    const byNormalized = new Map<string, string>();
    for (const [k, v] of Object.entries(payload.clues ?? {})) {
      if (typeof v === "string" && v.trim()) byNormalized.set(normalize(k), v.trim());
    }
    const out: Record<string, string> = {};
    for (const w of words) {
      const v = byNormalized.get(normalize(w));
      if (v) out[w] = v;
    }
    return out;
  } catch {
    return {};
  }
}

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

  const source =
    parsed.data.kind === "science"
      ? SCIENCE_UNITS.find((u) => u.id === parsed.data.id)
      : READING_THEMES.find((t) => t.id === parsed.data.id);
  if (!source) {
    return NextResponse.json({ error: "unknown unit" }, { status: 404 });
  }

  await connectDB();
  const name = listName(source.title);

  // One tap, one list: tapping again opens the list that is already there.
  const existing = await WordList.findOne({ name }).lean();
  if (existing) {
    return NextResponse.json(toClient(existing), { status: 200 });
  }

  // The word banks carry a few multi-word entries ("rock layer"); the word
  // schema allows spaces, the worksheets handle them.
  const words = source.words
    .map((w) => w.trim().toLowerCase())
    .filter((w) => /^[a-z][a-z\s-]*$/.test(w))
    .slice(0, 20);

  const clues = await fillClues(words);

  const doc = await WordList.create({
    name,
    hiddenMessage: "",
    words: words.map((w) => ({ word: w, clue: clues[w] ?? "", arabic: "", explanation: "" })),
  });

  return NextResponse.json(toClient(doc.toObject()), { status: 201 });
}
