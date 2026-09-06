import { NextResponse } from "next/server";
import { z } from "zod";

import { connectDB } from "@/lib/db";
import { TimesFact } from "@/lib/models/TimesFact";
import { TABLES, TABLE_UP_TO, applyFactAnswer, factFromRow, factKey } from "@/lib/tables";

export const runtime = "nodejs";

const Body = z.object({
  a: z.number().int().min(1).max(TABLE_UP_TO),
  b: z.number().int().min(1).max(TABLE_UP_TO),
  /** What he typed. Never whether it was right. */
  typed: z.string().max(12),
  /** How long the answer took, for the fast mark. */
  ms: z.number().int().min(0).max(10 * 60 * 1000),
});

/**
 * Grade one times-table answer and schedule the fact. The server does the
 * grading from the typed digits, the same as every other counter in the app,
 * so a cell on the grid can only light up for an answer he really gave.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const parsed = Body.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid body" }, { status: 400 });
  const { a, b, typed, ms } = parsed.data;
  if (!TABLES.includes(a) && !TABLES.includes(b)) {
    return NextResponse.json({ error: "not a table he is learning" }, { status: 400 });
  }

  const key = factKey(a, b);
  const clean = typed.trim().replace(/[\s,]/g, "");
  const correct = /^\d+$/.test(clean) && Number(clean) === a * b;

  await connectDB();
  const now = new Date();
  const before = factFromRow(key, await TimesFact.findOne({ key }).lean());
  const after = applyFactAnswer(before, correct, ms, now.toISOString());

  await TimesFact.updateOne(
    { key },
    {
      $set: {
        key,
        streak: after.streak,
        correct: after.correct,
        wrong: after.wrong,
        fast: after.fast,
        lastFast: after.lastFast,
        dueAt: after.dueAt ? new Date(after.dueAt) : null,
        lastAt: now,
      },
    },
    { upsert: true }
  );

  return NextResponse.json({ correct, answer: a * b, state: after });
}
