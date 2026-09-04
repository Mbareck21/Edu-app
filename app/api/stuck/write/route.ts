import { NextResponse } from "next/server";
import { z } from "zod";

import { connectDB } from "@/lib/db";
import { SpellChain } from "@/lib/models/SpellChain";
import { applyWrite, newChain, rungFor, type ChainState } from "@/lib/spell-chain";

export const runtime = "nodejs";

const Body = z.object({
  word: z.string().min(1).max(40),
  /** What he actually typed. Never whether it was right. */
  typed: z.string().max(80),
  /** True when the previous attempt on this word was a miss. */
  afterMiss: z.boolean().default(false),
});

function toState(doc: {
  word: string;
  current?: number;
  best?: number;
  reps?: number;
  attempts?: number;
  graduatedAt?: Date | null;
} | null, word: string): ChainState {
  if (!doc) return newChain(word);
  return {
    word: doc.word,
    current: Number(doc.current) || 0,
    best: Number(doc.best) || 0,
    reps: Number(doc.reps) || 0,
    attempts: Number(doc.attempts) || 0,
    graduatedAt: doc.graduatedAt ? new Date(doc.graduatedAt).toISOString() : null,
  };
}

/**
 * Grade one write and return the new count.
 *
 * The phone sends the letters he typed and nothing else. The server re-grades
 * with the same pure function the screen used, so the two cannot disagree and
 * there is no "I was correct" flag to forge. It is also why a refresh loses
 * nothing: the count on the server is the count.
 */
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
  const word = parsed.data.word.trim().toLowerCase();

  await connectDB();
  const before = toState(await SpellChain.findOne({ word }).lean(), word);
  const now = new Date();
  const step = applyWrite(before, parsed.data.typed, now.toISOString());
  const after = step.state;

  await SpellChain.updateOne(
    { word },
    {
      $set: {
        word,
        current: after.current,
        best: after.best,
        reps: after.reps,
        attempts: after.attempts,
        lastAt: now,
        ...(after.graduatedAt && !before.graduatedAt
          ? { graduatedAt: new Date(after.graduatedAt) }
          : {}),
      },
    },
    { upsert: true }
  );

  return NextResponse.json({
    correct: step.correct,
    state: after,
    /** What to show him for the next write on this word. */
    nextRung: rungFor(after, !step.correct),
  });
}
