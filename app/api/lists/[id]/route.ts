import { NextResponse } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { WordList, toClient } from "@/lib/models/WordList";

export const runtime = "nodejs";

const WordPatch = z.object({
  word: z.string().min(1).max(40).regex(/^[a-zA-Z][a-zA-Z\s-]*$/, "letters, spaces, hyphens only").trim(),
  clue: z.string().max(300).trim().default(""),
});

const PatchBody = z.object({
  name: z.string().min(1).max(120).trim().optional(),
  hiddenMessage: z.string().max(200).trim().optional(),
  words: z.array(WordPatch).max(50).optional(),
});

function badId(id: string) {
  return !mongoose.isValidObjectId(id);
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (badId(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  await connectDB();
  const doc = await WordList.findById(id).lean();
  if (!doc) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(toClient(doc));
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (badId(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const parsed = PatchBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
  }
  await connectDB();
  const update: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) update.name = parsed.data.name;
  if (parsed.data.hiddenMessage !== undefined) update.hiddenMessage = parsed.data.hiddenMessage;
  if (parsed.data.words !== undefined) {
    update.words = parsed.data.words.map((w) => ({
      word: w.word.toLowerCase(),
      clue: w.clue,
    }));
  }
  const doc = await WordList.findByIdAndUpdate(id, update, { new: true }).lean();
  if (!doc) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(toClient(doc));
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (badId(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  await connectDB();
  const doc = await WordList.findByIdAndDelete(id).lean();
  if (!doc) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
