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
 *                    what review, the drill and the daily beats want.
 *   getPool()      — the pool itself, created on first use.
 *
 * Server-only: these touch Mongoose.
 */

import { connectDB } from "@/lib/db";
import { SpellChain } from "@/lib/models/SpellChain";
import { WordList, toClient, type ClientWordList } from "@/lib/models/WordList";

/** The one pool document's name. Also what the parent sees it called. */
export const POOL_NAME = "Stuck words";

/** School lists. Never the pool. */
export async function getUnits(): Promise<ClientWordList[]> {
  await connectDB();
  const docs = await WordList.find({ kind: { $ne: "pool" } })
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
  await connectDB();
  const docs = await WordList.find().sort({ updatedAt: -1 }).lean();
  const all = docs.map(toClient);
  return [
    ...all.filter((l) => l.kind === "pool"),
    ...all.filter((l) => l.kind !== "pool"),
  ];
}

/**
 * The pool, made on first use.
 *
 * Upsert rather than find-then-create: two tabs adding a word at once would
 * otherwise race and leave him with two pools, and a split pool is a split
 * chain count.
 */
export async function getPool(): Promise<ClientWordList> {
  await connectDB();
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
  await WordList.updateOne({ _id: poolId }, { $push: { words: { $each: words } } });
  // A word he has been stuck on before keeps the chain it already had —
  // re-adding it must not wipe a run he earned. $setOnInsert only.
  await SpellChain.bulkWrite(
    words.map(({ word }) => ({
      updateOne: { filter: { word }, update: { $setOnInsert: { word } }, upsert: true },
    }))
  );
}
