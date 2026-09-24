import { NextResponse } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import { currentLearner } from "@/lib/auth";
import { db } from "@/lib/db";
import { LEARNER_NAMES, ownerOf } from "@/lib/learners";
import { toClient } from "@/lib/models/WordList";
import { mayDelete, syncList } from "@/lib/shared-lists";

export const runtime = "nodejs";

const WordPatch = z.object({
  word: z.string().trim().min(1).max(40).regex(/^[a-zA-Z][a-zA-Z\s-]*$/, "letters, spaces, hyphens only"),
  clue: z.string().max(300).trim().default(""),
  arabic: z.string().max(80).trim().optional().default(""),
  explanation: z.string().max(300).trim().optional().default(""),
});

const PatchBody = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  hiddenMessage: z.string().max(200).trim().optional(),
  words: z.array(WordPatch).max(50).optional(),
});

function badId(id: string) {
  return !mongoose.isValidObjectId(id);
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (badId(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  const { WordList } = await db();
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
  const learner = await currentLearner();
  const { WordList } = await db();

  // If the patch touches words, do a load+merge+save so we preserve per-word
  // SRS state across saves. A naive findByIdAndUpdate({ words }) would wipe
  // srs (interval, dueAt, easy/hard counts) on every save from the editor.
  if (parsed.data.words !== undefined) {
    const doc = await WordList.findById(id);
    if (!doc) return NextResponse.json({ error: "not found" }, { status: 404 });

    if (parsed.data.name !== undefined) doc.set("name", parsed.data.name);
    if (parsed.data.hiddenMessage !== undefined)
      doc.set("hiddenMessage", parsed.data.hiddenMessage);

    // Build a lookup of existing word subdocs by lowercased word string so we
    // can carry over { srs, skills, examples, family, arabic-if-omitted } onto
    // the merged list.
    const existing = new Map<
      string,
      {
        word: string;
        clue?: string;
        arabic?: string;
        explanation?: string;
        examples?: unknown;
        family?: unknown;
        srs?: unknown;
        skills?: unknown;
        addedBy?: string;
      }
    >();
    for (const w of doc.words || []) {
      existing.set(String(w.word).toLowerCase(), {
        word: w.word,
        clue: w.clue,
        arabic: w.arabic,
        explanation: w.explanation,
        examples: w.examples,
        family: w.family,
        srs: w.srs,
        skills: w.skills,
        addedBy: w.addedBy,
      });
    }
    // Lists are shared, and a child may only take out words they put in.
    // The Stuck-words pool is not shared: every word in it is this child's.
    const keep = new Set(parsed.data.words.map((w) => w.word.toLowerCase()));
    const theirs = [...existing]
      .filter(([key, w]) => doc.kind !== "pool" && !keep.has(key) && ownerOf(w.addedBy) !== learner)
      .map(([key, w]) => ({ key, owner: ownerOf(w.addedBy) }));
    if (theirs.length > 0) {
      return NextResponse.json(
        {
          error: `Only ${LEARNER_NAMES[theirs[0].owner]} can remove "${theirs[0].key}".`,
          words: theirs.map((t) => t.key),
        },
        { status: 403 }
      );
    }
    const merged = parsed.data.words.map((w) => {
      const key = w.word.toLowerCase();
      const prev = existing.get(key);
      return {
        word: key,
        clue: w.clue,
        // Empty arabic in the patch = parent didn't fill it; keep any prior value.
        arabic: w.arabic.trim().length > 0 ? w.arabic : (prev?.arabic ?? ""),
        // Same for the flashcard explanation — callers that don't send it
        // (e.g. the list editor) must not wipe an existing meaning.
        explanation:
          w.explanation.trim().length > 0 ? w.explanation : (prev?.explanation ?? ""),
        // Preserve SRS + per-skill mastery across saves; new words get fresh
        // defaults. AI-filled examples and word family survive editor saves.
        examples: prev?.examples ?? [],
        family: prev?.family ?? [],
        srs: prev?.srs ?? {},
        skills: prev?.skills ?? {},
        addedBy: prev ? (prev.addedBy ?? "") : learner,
      };
    });
    doc.set("words", merged);
    await doc.save();
    await syncList(learner, id);
    const fresh = await WordList.findById(id).lean();
    if (!fresh) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json(toClient(fresh));
  }

  // Words untouched → simple field-only update is safe.
  const update: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) update.name = parsed.data.name;
  if (parsed.data.hiddenMessage !== undefined) update.hiddenMessage = parsed.data.hiddenMessage;
  const doc = await WordList.findByIdAndUpdate(id, update, { returnDocument: "after" }).lean();
  if (!doc) return NextResponse.json({ error: "not found" }, { status: 404 });
  await syncList(learner, id);
  return NextResponse.json(toClient(doc));
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (badId(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });
  const learner = await currentLearner();
  const { WordList } = await db();
  const doc = await WordList.findById(id).select("addedBy kind").lean();
  if (!doc) return NextResponse.json({ error: "not found" }, { status: 404 });
  // The Stuck-words pool is in this child's own database: always theirs.
  if (doc.kind !== "pool" && !mayDelete(learner, doc)) {
    return NextResponse.json(
      { error: `Only ${LEARNER_NAMES[ownerOf(doc.addedBy)]} can delete this list.` },
      { status: 403 }
    );
  }
  await WordList.deleteOne({ _id: id });
  // Gone from the other child's lists too.
  await syncList(learner, id);
  return NextResponse.json({ ok: true });
}
