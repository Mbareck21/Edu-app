import { NextResponse } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { WordList, toClient } from "@/lib/models/WordList";
import {
  groq,
  CLUE_MODEL,
  EXPLAIN_SYSTEM_PROMPT,
  rateLimit,
  getClientIp,
} from "@/lib/groq";

export const runtime = "nodejs";
export const maxDuration = 30;

const ResponseShape = z.object({
  explanations: z.record(z.string(), z.string()),
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

  // Collect every word that still needs an explanation. If none, short-circuit
  // — the endpoint is safe to call on every flashcard-page visit.
  const missing: string[] = [];
  for (const w of doc.words || []) {
    if (!w.explanation || !w.explanation.trim()) {
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
        { role: "system", content: EXPLAIN_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Write a simple English meaning for each of these words:\n${missing.join(", ")}`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      // Explanations are full sentences (unlike the 1–4-word Arabic values the
      // translate route produces), so a 50-word list needs real headroom or
      // the JSON truncates and JSON.parse throws.
      max_tokens: 2400,
    });
    const text = completion.choices[0]?.message?.content ?? "{}";
    const json = JSON.parse(text);

    // Accept either the documented shape ({explanations: {...}}) or a flat
    // {word: explanation} map — Llama occasionally drops the wrapper.
    const validated = ResponseShape.safeParse(json);
    const rawMap: Record<string, unknown> = validated.success
      ? validated.data.explanations
      : json && typeof json === "object" && !Array.isArray(json)
        ? (json as Record<string, unknown>)
        : {};

    // Normalize keys (trim + lowercase) so case/whitespace drift in the
    // model output still matches the lowercase DB words.
    const normalized = new Map<string, string>();
    for (const [k, v] of Object.entries(rawMap)) {
      if (typeof v !== "string") continue;
      const ex = v.trim();
      if (!ex) continue;
      normalized.set(String(k).trim().toLowerCase(), ex);
    }

    // In-place merge. Only fill words that were missing — never overwrite a
    // parent-edited explanation.
    let filled = 0;
    for (const w of doc.words) {
      if (w.explanation && w.explanation.trim()) continue;
      const ex = normalized.get(String(w.word).trim().toLowerCase());
      if (ex) {
        w.explanation = ex;
        filled++;
      }
    }
    if (filled > 0) {
      doc.markModified("words");
      await doc.save();
    } else {
      // The model returned something but nothing matched our missing words.
      // Surface a diagnostic so the client (and logs) show why instead of
      // silently rendering empty explanations on every card.
      const keySample = Object.keys(rawMap).slice(0, 5);
      return NextResponse.json(
        {
          error:
            "AI returned explanations but none matched the requested words.",
          requested: missing.slice(0, 5),
          received: keySample,
        },
        { status: 502 }
      );
    }
    const fresh = await WordList.findById(id).lean();
    return NextResponse.json(toClient(fresh!));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "explanation failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
