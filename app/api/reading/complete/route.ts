import { NextResponse } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { WordList, toClient, READING_QUESTION_TYPES } from "@/lib/models/WordList";

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
    .max(6),
});

const MAX_RECENT_SESSIONS = 20;
const MAX_LEVEL = 5;

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

  await connectDB();
  const doc = await WordList.findById(parsed.data.listId);
  if (!doc) return NextResponse.json({ error: "list not found" }, { status: 404 });

  const perQ = parsed.data.perQuestion;
  const firstTry = perQ.filter((q) => q.firstTryCorrect).length;
  const hintsUsed = perQ.reduce((sum, q) => sum + q.hintsUsed, 0);
  const scorePct = Math.round((firstTry / perQ.length) * 100);
  const perfect = firstTry === perQ.length && hintsUsed === 0;
  const sessionLevel = Number(doc.currentReading?.level) || Number(doc.readingLevel) || 1;

  // Lifetime aggregates
  const stats = doc.readingStats ?? {};
  doc.set("readingStats.totalSessions", (Number(stats.totalSessions) || 0) + 1);
  doc.set("readingStats.totalQuestions", (Number(stats.totalQuestions) || 0) + perQ.length);
  doc.set(
    "readingStats.totalFirstTryCorrect",
    (Number(stats.totalFirstTryCorrect) || 0) + firstTry
  );
  doc.set("readingStats.totalHintsUsed", (Number(stats.totalHintsUsed) || 0) + hintsUsed);

  // Per-type accumulators
  for (const q of perQ) {
    const path = `readingStats.byType.${q.type}`;
    const cur =
      (doc.get(path) as { asked?: number; firstTryCorrect?: number } | undefined) ?? {};
    doc.set(`${path}.asked`, (Number(cur.asked) || 0) + 1);
    if (q.firstTryCorrect) {
      doc.set(`${path}.firstTryCorrect`, (Number(cur.firstTryCorrect) || 0) + 1);
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
  doc.set("readingStats.recentSessions", nextRecent);

  // Level bump only on perfect runs.
  if (perfect) {
    const cur = Number(doc.readingLevel) || 1;
    doc.set("readingLevel", Math.min(MAX_LEVEL, cur + 1));
  }

  // Clear the current reading — next Generate creates a fresh one.
  doc.set("currentReading", null);

  await doc.save();

  const fresh = await WordList.findById(parsed.data.listId).lean();
  if (!fresh) {
    return NextResponse.json({ error: "list disappeared" }, { status: 500 });
  }
  return NextResponse.json(toClient(fresh));
}
