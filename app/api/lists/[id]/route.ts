import { NextResponse } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { WordList, toClient } from "@/lib/models/WordList";

export const runtime = "nodejs";

const WordPatch = z.object({
  word: z.string().min(1).max(40).regex(/^[a-zA-Z][a-zA-Z\s-]*$/, "letters, spaces, hyphens only").trim(),
  clue: z.string().max(300).trim().default(""),
  arabic: z.string().max(80).trim().optional().default(""),
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

  // If the patch touches words, do a load+merge+save so we preserve per-word
  // SRS state across saves. A naive findByIdAndUpdate({ words }) would wipe
  // srs (interval, dueAt, easy/hard counts) on every save from the editor.
  if (parsed.data.words !== undefined) {
    const doc = await WordList.findById(id);
    if (!doc) return NextResponse.json({ error: "not found" }, { status: 404 });

    if (parsed.data.name !== undefined) doc.set("name", parsed.data.name);
    if (parsed.data.hiddenMessage !== undefined)
      doc.set("hiddenMessage", parsed.data.hiddenMessage);

    // Build a lookup of existing word subdocs by lowercased word string so
    // we can carry over { srs, arabic-if-omitted } onto the merged list.
    const existing = new Map<string, { word: string; clue?: string; arabic?: string; srs?: unknown }>();
    for (const w of doc.words || []) {
      existing.set(String(w.word).toLowerCase(), {
        word: w.word,
        clue: w.clue,
        arabic: w.arabic,
        srs: w.srs,
      });
    }
    const merged = parsed.data.words.map((w) => {
      const key = w.word.toLowerCase();
      const prev = existing.get(key);
      return {
        word: key,
        clue: w.clue,
        // Empty arabic in the patch = parent didn't fill it; keep any prior value.
        arabic: w.arabic.trim().length > 0 ? w.arabic : (prev?.arabic ?? ""),
        // Preserve SRS across saves; new words get fresh defaults.
        srs: prev?.srs ?? {},
      };
    });
    doc.set("words", merged);
    await doc.save();
    const fresh = await WordList.findById(id).lean();
    if (!fresh) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json(toClient(fresh));
  }

  // Words untouched → simple field-only update is safe.
  const update: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) update.name = parsed.data.name;
  if (parsed.data.hiddenMessage !== undefined) update.hiddenMessage = parsed.data.hiddenMessage;
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
