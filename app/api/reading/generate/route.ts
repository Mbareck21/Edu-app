import { NextResponse } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { WordList, toClient, READING_QUESTION_TYPES } from "@/lib/models/WordList";
import {
  groq,
  CLUE_MODEL,
  READING_SYSTEM_PROMPT,
  rateLimit,
  getClientIp,
} from "@/lib/groq";

export const runtime = "nodejs";
export const maxDuration = 30;

const Body = z.object({ listId: z.string().min(1) });

const ResponseShape = z.object({
  title: z.string().min(2).max(60),
  paragraph: z.string().min(20).max(2000),
  usedWords: z.array(z.string()).default([]),
  questions: z
    .array(
      z.object({
        q: z.string().min(3).max(200),
        type: z.enum(READING_QUESTION_TYPES),
        acceptable: z.array(z.string().min(1).max(120)).min(1).max(8),
        hints: z.array(z.string().min(1).max(200)).length(2),
      })
    )
    .length(4),
});

const MIN_WORDS_BY_LEVEL: Record<number, number> = {
  1: 60,
  2: 80,
  3: 100,
  4: 120,
  5: 140,
};

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
  if (!mongoose.isValidObjectId(parsed.data.listId)) {
    return NextResponse.json({ error: "bad id" }, { status: 400 });
  }

  await connectDB();
  const doc = await WordList.findById(parsed.data.listId);
  if (!doc) return NextResponse.json({ error: "list not found" }, { status: 404 });

  const words = (doc.words || []).map((w) => w.word).filter((w) => /^[a-z]{2,}$/.test(w));
  if (words.length < 3) {
    return NextResponse.json(
      { error: "need at least 3 words on the list to generate a reading" },
      { status: 400 }
    );
  }
  const level = Math.max(1, Math.min(5, Number(doc.readingLevel) || 1));

  // Generate once, retry once if word-usage coverage OR word-count is too low.
  const minWords = MIN_WORDS_BY_LEVEL[level] ?? 60;
  const minVocabUse = Math.ceil(words.length * 0.5);
  let attempt = 0;
  let reading: z.infer<typeof ResponseShape> | null = null;
  let lastErr: string | null = null;
  let lastShortcoming: "vocab" | "length" | "both" | null = null;
  while (attempt < 2 && !reading) {
    attempt++;
    let sterner = "";
    if (attempt === 2 && lastShortcoming) {
      const parts: string[] = [`\n\n⚠ Your previous attempt fell short — fix this:`];
      if (lastShortcoming === "vocab" || lastShortcoming === "both") {
        parts.push(
          `- Use AT LEAST ${Math.ceil(words.length * 0.6)} of these vocabulary words in the paragraph, woven into meaningful story sentences: ${words.join(", ")}.`
        );
      }
      if (lastShortcoming === "length" || lastShortcoming === "both") {
        parts.push(
          `- The paragraph was too SHORT. It must be at least ${minWords} words. A short paragraph reads as a vocab list, not a story. Add more story — name your characters, describe the setting, show what they do, use pronouns to refer back. Imitate the "House" example.`
        );
      }
      sterner = parts.join("\n");
    }
    try {
      const completion = await groq().chat.completions.create({
        model: CLUE_MODEL,
        messages: [
          { role: "system", content: READING_SYSTEM_PROMPT + sterner },
          {
            role: "user",
            content:
              `LEVEL: ${level}\nWORDS he has been studying: ${words.join(", ")}\n\n` +
              `Generate the title + paragraph + 4 questions per the rules.`,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
        max_tokens: 2000,
      });
      const text = completion.choices[0]?.message?.content ?? "{}";
      const json = JSON.parse(text);
      const validated = ResponseShape.safeParse(json);
      if (!validated.success) {
        lastErr = "AI returned malformed reading";
        continue;
      }
      // Coverage + length checks. If either is below the floor on attempt 1,
      // record what was wrong and retry once with a sterner prompt.
      const para = validated.data.paragraph;
      const paraLower = para.toLowerCase();
      const usedCount = words.filter((w) => paraLower.includes(w)).length;
      const wordCount = para.trim().split(/\s+/).filter(Boolean).length;
      const vocabShort = usedCount < minVocabUse;
      const lengthShort = wordCount < minWords;
      if (attempt === 1 && (vocabShort || lengthShort)) {
        lastShortcoming = vocabShort && lengthShort ? "both" : vocabShort ? "vocab" : "length";
        continue;
      }
      reading = validated.data;
    } catch (err) {
      lastErr = err instanceof Error ? err.message : "unknown error";
    }
  }

  if (!reading) {
    return NextResponse.json(
      { error: lastErr || "could not generate reading" },
      { status: 502 }
    );
  }

  const now = new Date();
  doc.set("currentReading", {
    title: reading.title,
    paragraph: reading.paragraph,
    questions: reading.questions,
    level,
    generatedAt: now,
  });
  await doc.save();

  const fresh = await WordList.findById(parsed.data.listId).lean();
  if (!fresh) {
    return NextResponse.json({ error: "list disappeared" }, { status: 500 });
  }
  return NextResponse.json(toClient(fresh));
}
