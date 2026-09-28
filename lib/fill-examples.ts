// Example sentences and word families for a list's words, written by the AI.
//
// Used by the examples route (a lesson asks for them when it starts) and, in
// the background with after(), by the routes that add words: a list saved in
// the editor and a school list seeded from the Words tab. Before that, a new
// word's first learn card never had a sentence, because the fill only started
// once that very lesson was open, and a word is new only once.

import mongoose from "mongoose";
import { z } from "zod";

import { currentLearner } from "@/lib/auth";
import { db } from "@/lib/db";
import { CLUE_MODEL, friendlyAiError, groq, rateLimit } from "@/lib/groq";
import { syncList } from "@/lib/shared-lists";

/** Words per Groq call. */
const BATCH = 15;
/** Calls per request — the rest waits for the next visit. */
const MAX_BATCHES = 3;

const SYSTEM_PROMPT = `
You write example sentences and word families for a 9-year-old boy who is
learning English. His first language is Arabic and he reads at Grade 3 level.

For EACH word you are given, return:
- "examples": EXACTLY 3 sentences showing the 3 MOST COMMON different uses of
  the word. Different situations, not three versions of the same sentence.
- "family": up to 4 REAL related forms of the word (help / helps / helped /
  helpful). Only forms that are actual English words. Empty list if there are
  none. Never invent a form.

Rules for the sentences:
- Grade 3 words only. Short: 10 words or fewer.
- The word itself (or one of its forms) MUST appear in every sentence.
- Concrete and true. A child can picture it.
- No metaphors, no idioms, no rare senses.
- No quotation marks inside the sentences. End each with a full stop.

Output STRICT JSON, nothing else:
{"words": {"help": {"examples": ["...","...","..."], "family": ["helps","helped","helpful"]}}}
Keys MUST be exactly the lowercase words you were given.
`.trim();

const Shape = z.object({
  examples: z.array(z.string().min(4).max(160)).min(1).max(3),
  family: z.array(z.string().min(1).max(40)).max(6).default([]),
});

type Filled = { examples: string[]; family: string[] };

function parseBatch(raw: string): Map<string, Filled> {
  const out = new Map<string, Filled>();
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return out;
  }
  if (!json || typeof json !== "object") return out;
  const record = json as Record<string, unknown>;
  // Documented shape is {words: {...}}; the model sometimes drops the wrapper.
  const map =
    record.words && typeof record.words === "object"
      ? (record.words as Record<string, unknown>)
      : record;

  for (const [key, value] of Object.entries(map)) {
    const parsed = Shape.safeParse(value);
    if (!parsed.success) continue;
    out.set(String(key).trim().toLowerCase(), {
      examples: parsed.data.examples.map((s) => s.trim()).slice(0, 3),
      family: parsed.data.family.map((s) => s.trim().toLowerCase()).slice(0, 4),
    });
  }
  return out;
}

export type FillOutcome =
  | { kind: "nothing" }
  | { kind: "not-found" }
  | { kind: "rate-limited"; retryAfterSec: number }
  | { kind: "failed"; error: string }
  | { kind: "filled"; count: number };

/**
 * Fill the words of list `id` that have no example sentence at all. A parent
 * who wrote one sentence keeps it, and an empty family alone is never a reason
 * to call the model.
 */
export async function fillExamples(id: string, ip: string): Promise<FillOutcome> {
  if (!mongoose.isValidObjectId(id)) return { kind: "not-found" };
  const { WordList } = await db();
  const doc = await WordList.findById(id).select("words.word words.examples");
  if (!doc) return { kind: "not-found" };

  const missing = (doc.words ?? [])
    .filter((w) => (w.examples?.length ?? 0) === 0)
    .map((w) => String(w.word).trim().toLowerCase())
    .filter(Boolean);
  if (missing.length === 0) return { kind: "nothing" };

  // Only a real model call spends the allowance: the examples route runs on
  // every lesson start, and a visit with nothing to fill used to use it up.
  const rl = rateLimit(ip, "examples");
  if (!rl.ok) return { kind: "rate-limited", retryAfterSec: rl.retryAfterSec };

  const batches: string[][] = [];
  for (let i = 0; i < missing.length && batches.length < MAX_BATCHES; i += BATCH) {
    batches.push(missing.slice(i, i + BATCH));
  }

  const filled = new Map<string, Filled>();
  // A batch that blows up stops the run but keeps what earlier batches filled;
  // the rest waits for the next visit.
  let failure: string | null = null;
  // Each call may take up to the client's 25s timeout; a third one started
  // late would outlive maxDuration and lose the two that worked.
  const started = Date.now();
  for (const batch of batches) {
    if (Date.now() - started > 30_000) break;
    // The model writes "fair_test" for "fair test" (the clues route met it
    // first), and a key that matched nothing left the word empty for good.
    const byLetters = new Map(batch.map((w) => [w.replace(/[^a-z]/g, ""), w]));
    try {
      const completion = await groq().chat.completions.create({
        model: CLUE_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `Write examples and word families for: ${batch.join(", ")}`,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.4,
        max_tokens: 5000,
        reasoning_effort: "low",
      });
      const text = completion.choices[0]?.message?.content ?? "{}";
      for (const [key, value] of parseBatch(text)) {
        const word = batch.includes(key) ? key : byLetters.get(key.replace(/[^a-z]/g, ""));
        if (word) filled.set(word, value);
      }
    } catch (err) {
      failure = friendlyAiError(err, "The examples would not come. Try again.");
      break;
    }
  }

  if (failure && filled.size === 0) return { kind: "failed", error: failure };

  // Only the example and family fields of the words that were filled are
  // written, matched by the word itself. The model call takes seconds, and
  // saving the whole words array loaded before it overwrote any review
  // progress a session wrote to this list in the meantime. The filters are
  // re-checked at write time, so a sentence a parent typed during the wait is
  // never overwritten either. The family rides along with a fresh examples
  // fill; it is never written on its own.
  // "x.0" not existing is Mongo's test for an array that is empty or missing.
  const empty = { $exists: false };
  // The keys are trimmed and lower-cased; the filter has to match the word as stored.
  const stored = new Map((doc.words ?? []).map((w) => [String(w.word).trim().toLowerCase(), String(w.word)]));
  const updates = [...filled].map(([key, got]) => {
    const word = stored.get(key) ?? key;
    const withFamily = got.family.length > 0;
    return {
      updateOne: {
        filter: { _id: doc._id },
        update: {
          $set: {
            "words.$[w].examples": got.examples,
            ...(withFamily ? { "words.$[f].family": got.family } : {}),
          },
        },
        arrayFilters: [
          { "w.word": word, "w.examples.0": empty },
          ...(withFamily ? [{ "f.word": word, "f.examples.0": empty, "f.family.0": empty }] : []),
        ],
      },
    };
  });
  if (updates.length === 0) return { kind: "filled", count: 0 };

  await WordList.bulkWrite(updates);
  // Examples are shared: the other child's copy gets them too.
  await syncList(await currentLearner(), id);
  return { kind: "filled", count: updates.length };
}
