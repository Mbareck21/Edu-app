import { NextResponse } from "next/server";
import mongoose from "mongoose";

import { db } from "@/lib/db";
import { fillExamples } from "@/lib/fill-examples";
import { toClient } from "@/lib/models/WordList";
import { getClientIp } from "@/lib/groq";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Fill the list's words that have no example sentence, then send the list. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "bad id" }, { status: 400 });
  }

  const outcome = await fillExamples(id, getClientIp(req));
  if (outcome.kind === "not-found") return NextResponse.json({ error: "not found" }, { status: 404 });
  if (outcome.kind === "rate-limited") {
    return NextResponse.json(
      { error: "rate limit", retryAfterSec: outcome.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(outcome.retryAfterSec) } }
    );
  }
  if (outcome.kind === "failed") return NextResponse.json({ error: outcome.error }, { status: 502 });

  const { WordList } = await db();
  // readingHistory is server-only and can be long; nothing here reads it.
  const fresh = await WordList.findById(id).select("-readingHistory").lean();
  if (!fresh) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(toClient(fresh));
}
