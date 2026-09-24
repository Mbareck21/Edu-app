import { NextResponse } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import { db } from "@/lib/db";
import { currentLearner } from "@/lib/auth";
import { toClient } from "@/lib/models/WordList";
import { syncList } from "@/lib/shared-lists";
import { CLUE_MODEL, TRANSLATE_SYSTEM_PROMPT, friendlyAiError, getClientIp, groq, rateLimit } from "@/lib/groq";

export const runtime = "nodejs";
export const maxDuration = 30;

const ResponseShape = z.object({
  translations: z.record(z.string(), z.string()),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "bad id" }, { status: 400 });
  }

  const { WordList } = await db();
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

  // Only a real model call spends the allowance: this route runs on every
  // visit, and a visit with nothing to fill used to use it up.
  const ip = getClientIp(req);
  const rl = rateLimit(ip);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "rate limit", retryAfterSec: rl.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
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
      max_tokens: 3000,
      reasoning_effort: "low",
    });
    const text = completion.choices[0]?.message?.content ?? "{}";
    const json = JSON.parse(text);

    // Accept either the documented shape ({translations: {...}}) or a flat
    // {word: arabic} map — Llama occasionally drops the wrapper.
    const validated = ResponseShape.safeParse(json);
    const rawMap: Record<string, unknown> = validated.success
      ? validated.data.translations
      : json && typeof json === "object" && !Array.isArray(json)
        ? (json as Record<string, unknown>)
        : {};

    // Normalize keys (trim + lowercase) so case/whitespace drift in the
    // model output still matches the lowercase DB words.
    const normalized = new Map<string, string>();
    for (const [k, v] of Object.entries(rawMap)) {
      if (typeof v !== "string") continue;
      const ar = v.trim();
      if (!ar) continue;
      normalized.set(String(k).trim().toLowerCase(), ar);
    }

    // Only the arabic of each filled word is written, matched by the word
    // itself. The model call takes seconds, and saving the whole words array
    // loaded before it overwrote any review progress a session wrote to this
    // list in the meantime. The filter is re-checked at write time, so a
    // value a parent typed during the wait is never overwritten.
    const updates = [];
    for (const w of doc.words) {
      if (w.arabic && w.arabic.trim()) continue;
      const ar = normalized.get(String(w.word).trim().toLowerCase());
      if (!ar) continue;
      updates.push({
        updateOne: {
          filter: { _id: doc._id },
          update: { $set: { "words.$[w].arabic": ar } },
          arrayFilters: [{ "w.word": w.word, "w.arabic": { $not: /\S/ } }],
        },
      });
    }
    if (updates.length > 0) {
      await WordList.bulkWrite(updates);
      // The meanings are shared: the other child's copy gets them too.
      await syncList(await currentLearner(), id);
    } else {
      // The model returned something but nothing matched our missing words.
      // Surface a diagnostic so the client (and logs) show why instead of
      // silently rendering empty Arabic on every card.
      const keySample = Object.keys(rawMap).slice(0, 5);
      return NextResponse.json(
        {
          error:
            "AI returned translations but none matched the requested words.",
          requested: missing.slice(0, 5),
          received: keySample,
        },
        { status: 502 }
      );
    }
    const fresh = await WordList.findById(id).lean();
    return NextResponse.json(toClient(fresh!));
  } catch (err) {
    const msg = friendlyAiError(err, "That translation would not come. Try again.");
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
