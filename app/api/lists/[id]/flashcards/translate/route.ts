import { NextResponse } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { WordList, toClient } from "@/lib/models/WordList";
import {
  groq,
  CLUE_MODEL,
  TRANSLATE_SYSTEM_PROMPT,
  rateLimit,
  getClientIp,
} from "@/lib/groq";

export const runtime = "nodejs";
export const maxDuration = 30;

const ResponseShape = z.object({
  translations: z.record(z.string(), z.string()),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const ip = getClientIp(req);
  const rl = rateLimit(ip);
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

  // Collect every word that still needs a translation. If none, short-circuit
  // — the endpoint is safe to call on every flashcard-page visit.
  const missing: string[] = [];
  for (const w of doc.words || []) {
    if (!w.arabic || !w.arabic.trim()) {
      missing.push(String(w.word).toLowerCase());
    }
  }
  if (missing.length === 0) {
    const fresh = await WordList.findById(id).lean();
    return NextResponse.json(toClient(fresh!));
  }

  try {
    const completion = await groq().chat.completions.create({
      model: CLUE_MODEL,
      messages: [
        { role: "system", content: TRANSLATE_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Translate these English words to Modern Standard Arabic:\n${missing.join(", ")}`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: 800,
    });
    const text = completion.choices[0]?.message?.content ?? "{}";
    const json = JSON.parse(text);
    const validated = ResponseShape.safeParse(json);
    if (!validated.success) {
      return NextResponse.json(
        { error: "AI returned malformed translations" },
        { status: 502 }
      );
    }
    const translations = validated.data.translations;

    // In-place merge. Only fill words that were missing — never overwrite a
    // parent-edited Arabic value.
    let dirty = false;
    for (const w of doc.words) {
      if (w.arabic && w.arabic.trim()) continue;
      const key = String(w.word).toLowerCase();
      const ar = translations[key];
      if (ar && ar.trim()) {
        w.arabic = ar.trim();
        dirty = true;
      }
    }
    if (dirty) {
      doc.markModified("words");
      await doc.save();
    }
    const fresh = await WordList.findById(id).lean();
    return NextResponse.json(toClient(fresh!));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "translation failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
