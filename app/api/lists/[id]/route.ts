import { after, NextResponse } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import { currentLearner } from "@/lib/auth";
import { db } from "@/lib/db";
import { fillExamples } from "@/lib/fill-examples";
import { getClientIp } from "@/lib/groq";
import { oneEntryPerWord } from "@/lib/items";
import { LEARNER_NAMES, ownerOf } from "@/lib/learners";
import { SKILL_IDS, toClient } from "@/lib/models/WordList";
import { mayDelete, syncList } from "@/lib/shared-lists";

export const runtime = "nodejs";
// Room for the example sentences written after a save (see after() below).
export const maxDuration = 60;

const WordPatch = z.object({
  word: z.string().trim().min(1).max(40).regex(/^[a-zA-Z][a-zA-Z\s-]*$/, "letters, spaces, hyphens only"),
  clue: z.string().max(300).trim().default(""),
  arabic: z.string().max(80).trim().optional().default(""),
  explanation: z.string().max(300).trim().optional().default(""),
});

/** Words on a school list. */
const LIST_MAX_WORDS = 50;

// The Stuck-words pool has no cap: it grows by itself as he misses words, and
// a 72-word pool refused every save, "Write meanings" and "Add Arabic". So the
// list cap is checked once the list is loaded and its kind is known; this one
// only bounds the request.
const PatchBody = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  hiddenMessage: z.string().max(200).trim().optional(),
  words: z.array(WordPatch).max(1000).optional(),
});

const FIELD_NAMES: Record<string, string> = {
  name: "list name",
  hiddenMessage: "hidden message",
  clue: "clue",
  arabic: "Arabic",
  explanation: "meaning",
};

/**
 * What is wrong with a save, in one sentence the editor can show as it is.
 * The raw zod issues went back as an array, so the editor could only guess,
 * and every refusal read "Words take letters, spaces and hyphens only".
 */
function saveError(issue: z.core.$ZodIssue, body: unknown): string {
  const [top, index, field] = issue.path;
  if (top === "words" && index === undefined) {
    return issue.code === "too_big" ? "Too many words to save at once." : "The words could not be read.";
  }
  const sent = (body as { words?: { word?: unknown }[] } | null)?.words;
  const typed = typeof index === "number" ? sent?.[index]?.word : undefined;
  const named = typeof typed === "string" && typed.trim() ? `"${typed.trim()}"` : "";
  const subject =
    top !== "words"
      ? `The ${FIELD_NAMES[String(top)] ?? String(top)}`
      : field === "word"
        ? named || "A word"
        : `The ${FIELD_NAMES[String(field)] ?? String(field)} for ${named || "a word"}`;
  if (issue.code === "invalid_format") return `${subject} can only have letters, spaces and hyphens.`;
  if (issue.code === "too_big") return `${subject} is too long: ${issue.maximum} characters at most.`;
  if (issue.code === "too_small") return `${subject} is empty.`;
  return `${subject} could not be read.`;
}

/** Answers on record for a stored word: which copy to keep when it is there twice. */
function answersOn(w: { srs?: unknown; skills?: unknown }): number {
  const skills = (w.skills ?? {}) as Record<string, { correct?: number; wrong?: number } | undefined>;
  const reviews = ((w.srs ?? {}) as { reviewCount?: number }).reviewCount ?? 0;
  return SKILL_IDS.reduce((n, id) => n + (skills[id]?.correct ?? 0) + (skills[id]?.wrong ?? 0), reviews);
}

function badId(id: string) {
  return !mongoose.isValidObjectId(id);
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (badId(id)) return NextResponse.json({ error: "That is not a list id." }, { status: 400 });
  const { WordList } = await db();
  const doc = await WordList.findById(id).lean();
  if (!doc) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(toClient(doc));
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (badId(id)) return NextResponse.json({ error: "That is not a list id." }, { status: 400 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "The save could not be read. Try again." }, { status: 400 });
  }
  const parsed = PatchBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: saveError(parsed.error.issues[0], body) }, { status: 400 });
  }
  const learner = await currentLearner();
  const { WordList } = await db();

  // If the patch touches words, do a load+merge+save so we preserve per-word
  // SRS state across saves. A naive findByIdAndUpdate({ words }) would wipe
  // srs (interval, dueAt, easy/hard counts) on every save from the editor.
  if (parsed.data.words !== undefined) {
    const doc = await WordList.findById(id);
    if (!doc) return NextResponse.json({ error: "not found" }, { status: 404 });

    // One entry per word, whatever its case: a word saved twice was taught
    // twice, and its results only ever landed on one copy.
    const words = oneEntryPerWord(parsed.data.words);
    if (doc.kind !== "pool" && words.length > LIST_MAX_WORDS) {
      return NextResponse.json(
        { error: `A list holds ${LIST_MAX_WORDS} words at most. This one has ${words.length}.` },
        { status: 400 }
      );
    }

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
    // A list saved before duplicates were refused may hold a word twice. Keep
    // the copy with answers on it, so no progress is lost in the merge.
    const stored = oneEntryPerWord(doc.words || [], (later, kept) => answersOn(later) > answersOn(kept));
    for (const w of stored) {
      existing.set(w.word.toLowerCase(), {
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
    const keep = new Set(words.map((w) => w.word.toLowerCase()));
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
    const merged = words.map((w) => {
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
    // New words get their sentences now, not once his first lesson on them is
    // already open: a word is new only once, and its first learn card had none.
    const ip = getClientIp(req);
    after(() => fillExamples(id, ip).then(() => undefined, () => undefined));
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
