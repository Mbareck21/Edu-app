import { NextResponse } from "next/server";
import { z } from "zod";
import { groq, CLUE_MODEL, CLUE_SYSTEM_PROMPT, rateLimit, getClientIp } from "@/lib/groq";

export const runtime = "nodejs";

const Body = z.object({
  words: z.array(z.string().min(1).max(40).regex(/^[a-zA-Z][a-zA-Z\s-]*$/)).min(1).max(30),
});

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = rateLimit(ip);
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
  const words = parsed.data.words.map((w) => w.trim().toLowerCase());

  try {
    const completion = await groq().chat.completions.create({
      model: CLUE_MODEL,
      messages: [
        { role: "system", content: CLUE_SYSTEM_PROMPT },
        { role: "user", content: `Write a clue for each of these words:\n${words.join(", ")}` },
      ],
      response_format: { type: "json_object" },
      temperature: 0.6,
      max_tokens: 1200,
    });

    const text = completion.choices[0]?.message?.content || "{}";
    let payload: { clues?: Record<string, string> };
    try {
      payload = JSON.parse(text);
    } catch {
      return NextResponse.json({ error: "AI returned malformed JSON" }, { status: 502 });
    }
    const clues = payload.clues || {};

    // Normalize keys for tolerant lookup: the model may return "climate change",
    // "climate_change", "climate-change", or "ClimateChange" for the same input.
    // Collapse everything to lowercase letters-only on both sides before matching.
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
    const byNormalized: Record<string, string> = {};
    for (const [k, v] of Object.entries(clues)) {
      if (typeof v === "string") byNormalized[normalize(k)] = v;
    }
    const out: Record<string, string> = {};
    for (const w of words) {
      const v = byNormalized[normalize(w)];
      if (typeof v === "string" && v.trim().length > 0) {
        out[w] = v.trim();
      }
    }
    return NextResponse.json({ clues: out });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: `Groq error: ${msg}` }, { status: 502 });
  }
}
