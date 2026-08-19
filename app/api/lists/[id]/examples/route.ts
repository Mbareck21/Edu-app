import { NextResponse } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";

import { connectDB } from "@/lib/db";
import { WordList, toClient } from "@/lib/models/WordList";
import { CLUE_MODEL, getClientIp, groq, rateLimit } from "@/lib/groq";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Words per Groq call. */
const BATCH = 15;
/** Calls per request — the rest waits for the next visit. */
const MAX_BATCHES = 3;

const SYSTEM_PROMPT = `
You write example sentences and word families for a 9-year-old boy who is
learning English. His first language is Arabic and he reads at Grade 3 level.

For EACH word you are given, return:
- "examples": EXACTLY 3 sentences showing the 3 MOST COMMON different uses of
  the word. Different situations, not three versions of the same sentence.
- "family": up to 4 REAL related forms of the word (help / helps / helped /
  helpful). Only forms that are actual English words. Empty list if there are
  none. Never invent a form.

Rules for the sentences:
- Grade 3 words only. Short: 10 words or fewer.
- The word itself (or one of its forms) MUST appear in every sentence.
- Concrete and true. A child can picture it.
- No metaphors, no idioms, no rare senses.
- No quotation marks inside the sentences. End each with a full stop.

Output STRICT JSON, nothing else:
{"words": {"help": {"examples": ["...","...","..."], "family": ["helps","helped","helpful"]}}}
Keys MUST be exactly the lowercase words you were given.
`.trim();

const Shape = z.object({
  examples: z.array(z.string().min(4).max(160)).min(1).max(3),
  family: z.array(z.string().min(1).max(40)).max(6).default([]),
});

type Filled = { examples: string[]; family: string[] };

function parseBatch(raw: string): Map<string, Filled> {
  const out = new Map<string, Filled>();
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return out;
  }
  if (!json || typeof json !== "object") return out;
  const record = json as Record<string, unknown>;
  // Documented shape is {words: {...}}; the model sometimes drops the wrapper.
  const map =
    record.words && typeof record.words === "object"
      ? (record.words as Record<string, unknown>)
      : record;

  for (const [key, value] of Object.entries(map)) {
    const parsed = Shape.safeParse(value);
    if (!parsed.success) continue;
    out.set(String(key).trim().toLowerCase(), {
      examples: parsed.data.examples.map((s) => s.trim()).slice(0, 3),
      family: parsed.data.family.map((s) => s.trim().toLowerCase()).slice(0, 4),
    });
  }
  return out;
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const rl = rateLimit(getClientIp(req));
  if (!rl.ok) {
    return NextResponse.json(
      { error: "rate limit", retryAfterSec: rl.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "bad id" }, { status: 400 });
  }

  await connectDB();
  const doc = await WordList.findById(id);
  if (!doc) return NextResponse.json({ error: "not found" }, { status: 404 });

  const missing = (doc.words ?? [])
    .filter((w) => (w.examples?.length ?? 0) < 3 || (w.family?.length ?? 0) === 0)
    .map((w) => String(w.word).trim().toLowerCase())
    .filter(Boolean);

  if (missing.length === 0) {
    const fresh = await WordList.findById(id).lean();
    return NextResponse.json(toClient(fresh!));
  }

  const batches: string[][] = [];
  for (let i = 0; i < missing.length && batches.length < MAX_BATCHES; i += BATCH) {
    batches.push(missing.slice(i, i + BATCH));
  }

  const filled = new Map<string, Filled>();
  try {
    for (const batch of batches) {
      const completion = await groq().chat.completions.create({
        model: CLUE_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `Write examples and word families for: ${batch.join(", ")}`,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.4,
        max_tokens: 5000,
      reasoning_effort: "low",
      });
      const text = completion.choices[0]?.message?.content ?? "{}";
      for (const [key, value] of parseBatch(text)) {
        if (batch.includes(key)) filled.set(key, value);
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "examples failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  let touched = 0;
  doc.words.forEach((w, index) => {
    const got = filled.get(String(w.word).trim().toLowerCase());
    if (!got) return;
    // Never overwrite what a parent already wrote.
    if ((w.examples?.length ?? 0) < 3 && got.examples.length > 0) {
      doc.set(`words.${index}.examples`, got.examples);
      touched++;
    }
    if ((w.family?.length ?? 0) === 0 && got.family.length > 0) {
      doc.set(`words.${index}.family`, got.family);
      touched++;
    }
  });

  if (touched > 0) {
    doc.markModified("words");
    await doc.save();
  }

  const fresh = await WordList.findById(id).lean();
  return NextResponse.json(toClient(fresh!));
}
