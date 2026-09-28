/**
 * Every "give me his word lists" query, in one place.
 *
 * There were six unfiltered `WordList.find()` calls scattered across the app —
 * the lists API, the vocab drill, the daily beats, the Me page, the Words page
 * and lib/lists.ts. Adding a Stuck-words pool that is itself a WordList means
 * each of those has to decide whether the pool counts, and a decision copied
 * into six places is a decision that will be forgotten in the seventh.
 *
 * So the decision lives here once, in the name of the function you call:
 *
 *   getUnits()     — school lists only. The pool is not a unit; it must not
 *                    appear on the units strip or get a path to complete.
 *   getPractice()  — everything he can be tested on, pool included. This is
 *                    what review, the drill and the daily beats want. The
 *                    pool comes without its waiting words (splitStuck).
 *   getPool()      — the pool itself, created on first use.
 *
 * Server-only: these touch Mongoose.
 */

import { db } from "@/lib/db";
import { settledStuck } from "@/lib/mastery";
import { toClient, type ClientWordList } from "@/lib/models/WordList";
import { fromRow, splitStuck, type ChainState } from "@/lib/spell-chain";

/** The one pool document's name. Also what the parent sees it called. */
export const POOL_NAME = "Stuck words";

/**
 * The whole-passage archive and the reading history are server-only and never
 * reach toClient, yet they are the bulk of a list that has been read a lot.
 */
const NOT_FOR_CLIENT = "-readingArchive -readingHistory";

/** School lists. Never the pool. */
export async function getUnits(): Promise<ClientWordList[]> {
  const { WordList } = await db();
  const docs = await WordList.find({ kind: { $ne: "pool" } })
    .select(NOT_FOR_CLIENT)
    .sort({ updatedAt: -1 })
    .lean();
  return docs.map(toClient);
}

/**
 * Everything he can be tested on, pool first.
 *
 * Pool first because these lists feed builders that take the head of the list
 * when they need one, and the words he is stuck on are the ones that should
 * get that slot.
 */
export async function getPractice(): Promise<ClientWordList[]> {
  const { WordList } = await db();
  const docs = await WordList.find().select(NOT_FOR_CLIENT).sort({ updatedAt: -1 }).lean();
  const all = docs.map(toClient);
  const units = all.filter((l) => l.kind !== "pool");
  const pools = await Promise.all(all.filter((l) => l.kind === "pool").map((p) => activePool(p, units)));
  return [...pools, ...units];
}

/** The pool as practice sees it: fixed words gone, waiting words held back. */
async function activePool(pool: ClientWordList, units: readonly ClientWordList[]): Promise<ClientWordList> {
  const kept = await clearSettledStuck(pool, units);
  const words = kept.words.map((w) => w.word);
  if (words.length === 0) return kept;
  const { SpellChain } = await db();
  const rows = await SpellChain.find({ word: { $in: words } }).lean();
  const chains: Record<string, ChainState> = {};
  for (const word of words) chains[word] = fromRow(word, rows.find((r) => r.word === word));
  const { waiting } = splitStuck(words, chains, new Date().toISOString());
  return { ...kept, words: kept.words.filter((w) => !waiting.includes(w.word)) };
}

/**
 * Take out of the pool every word he has since fixed on a unit list (see
 * settledStuck), and return the pool without them. Its spelling chain stays:
 * if he gets stuck on it again, it comes back with the run he had.
 */
export async function clearSettledStuck(
  pool: ClientWordList,
  units: readonly ClientWordList[]
): Promise<ClientWordList> {
  const settled = settledStuck(
    pool.words.map((w) => w.word),
    units.flatMap((l) => l.words)
  );
  if (settled.length === 0) return pool;
  const { WordList } = await db();
  await WordList.updateOne({ _id: pool._id }, { $pull: { words: { word: { $in: settled } } } });
  return { ...pool, words: pool.words.filter((w) => !settled.includes(w.word)) };
}

/**
 * The pool, made on first use.
 *
 * Upsert rather than find-then-create: two tabs adding a word at once would
 * otherwise race and leave him with two pools, and a split pool is a split
 * chain count.
 */
export async function getPool(): Promise<ClientWordList> {
  const { WordList } = await db();
  const doc = await WordList.findOneAndUpdate(
    { kind: "pool" },
    { $setOnInsert: { kind: "pool", name: POOL_NAME, words: [] } },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
  ).lean();
  if (!doc) throw new Error("could not open the stuck-words pool");
  return toClient(doc);
}

/**
 * Put new words into the pool, each with its spelling chain. The caller has
 * already dropped words the pool holds. Used by the parent's add box and by a
 * finished reading, so both land words the same way.
 */
export async function addPoolWords(
  poolId: string,
  words: readonly { word: string; clue: string; arabic: string }[]
): Promise<void> {
  if (words.length === 0) return;
  const { WordList, SpellChain } = await db();
  await WordList.updateOne({ _id: poolId }, { $push: { words: { $each: words } } });
  // A word he has been stuck on before keeps the chain it already had —
  // re-adding it must not wipe a run he earned. $setOnInsert only.
  await SpellChain.bulkWrite(
    words.map(({ word }) => ({
      updateOne: { filter: { word }, update: { $setOnInsert: { word } }, upsert: true },
    }))
  );
}
