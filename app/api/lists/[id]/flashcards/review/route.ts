import { NextResponse } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { WordList, type SrsState } from "@/lib/models/WordList";
import { scheduleNext } from "@/lib/srs";

export const runtime = "nodejs";

const Body = z.object({
  word: z.string().min(1).max(80).trim().toLowerCase(),
  rating: z.enum(["easy", "hard"]),
});

function srsToClient(srs: unknown): SrsState {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = (srs as any) ?? {};
  return {
    interval: Number(s.interval ?? 0),
    dueAt: s.dueAt ? new Date(s.dueAt).toISOString() : new Date().toISOString(),
    lastReviewed: s.lastReviewed ? new Date(s.lastReviewed).toISOString() : null,
    reviewCount: Number(s.reviewCount ?? 0),
    easyCount: Number(s.easyCount ?? 0),
    hardCount: Number(s.hardCount ?? 0),
  };
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "bad id" }, { status: 400 });
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

  await connectDB();
  const doc = await WordList.findById(id);
  if (!doc) return NextResponse.json({ error: "not found" }, { status: 404 });

  const target = doc.words?.find(
    (w) => String(w.word).toLowerCase() === parsed.data.word
  );
  if (!target) {
    return NextResponse.json({ error: "word not on list" }, { status: 404 });
  }

  const next = scheduleNext(srsToClient(target.srs), parsed.data.rating, new Date());
  // Mongoose subdoc assignment + markModified is the safe pattern for nested
  // arrays of subdocs.
  target.srs = next as unknown as typeof target.srs;
  doc.markModified("words");
  await doc.save();

  return NextResponse.json({ srs: next });
}
