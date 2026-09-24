import mongoose, { type Connection } from "mongoose";

import { currentLearner } from "@/lib/auth";
import type { LearnerId } from "@/lib/learners";
import { MathProgress, MathProgressSchema } from "@/lib/models/MathProgress";
import { Profile, ProfileSchema } from "@/lib/models/Profile";
import { SpellChain, SpellChainSchema } from "@/lib/models/SpellChain";
import { TimesFact, TimesFactSchema } from "@/lib/models/TimesFact";
import { WordList, WordListSchema, listContent } from "@/lib/models/WordList";

const MONGODB_URI = process.env.MONGODB_URI;

declare global {
  // eslint-disable-next-line no-var
  var __mongooseConn: Promise<typeof mongoose> | undefined;
  var __dbIdentityOk: boolean | undefined;
  var __wissamDbOk: boolean | undefined;
}

/**
 * The record that marks a database: `meta` collection, `_id: "identity"`.
 *
 * On 2026-09-07 a password rotation left Vercel's MONGODB_URI pointing at a
 * different, empty database. Nothing failed: the app made a new profile at
 * zero XP and he spent six days starting over while his real history sat
 * untouched. So the app now checks that it is on the right database before
 * it reads or writes anything, and stops with this message if it is not. A
 * copy made by scripts/copy-db-to-dev.mjs carries the record too.
 */
export const DB_IDENTITY = "nour-quest-original";
/**
 * The test copy's mark. A second leak the same week: MONGODB_DB=eduapp-dev was
 * copied into Vercel with the URI, so the live app ran on the test copy, which
 * carried the same record and passed. Now each side accepts only its own:
 * the live app only Nour's database, local runs only the copy.
 */
export const DEV_COPY_IDENTITY = "nour-quest-dev-copy";

const IS_PRODUCTION = process.env.VERCEL_ENV === "production";
const EXPECTED = IS_PRODUCTION ? DB_IDENTITY : DEV_COPY_IDENTITY;
/** The live app always uses his database by name; MONGODB_DB is for local runs. */
const DB_NAME = IS_PRODUCTION ? "eduapp" : (process.env.MONGODB_DB ?? "eduapp");

async function checkIdentity(m: typeof mongoose): Promise<void> {
  if (global.__dbIdentityOk) return;
  const db = m.connection.db;
  const doc = db
    ? await db.collection<{ _id: string; value?: string }>("meta").findOne({ _id: "identity" })
    : null;
  if (doc?.value !== EXPECTED) {
    throw new Error(
      `Wrong database: "${db?.databaseName ?? "?"}" is marked "${doc?.value ?? "nothing"}", expected ` +
        `"${EXPECTED}". ${IS_PRODUCTION ? "MONGODB_URI must point at Nour's database." : "Local runs use the test copy (scripts/copy-db-to-dev.mjs)."} ` +
        `Refusing to run rather than read or write the wrong one.`
    );
  }
  global.__dbIdentityOk = true;
}

export async function connectDB(): Promise<typeof mongoose> {
  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI is not set. Add it to .env.local");
  }
  if (mongoose.connection.readyState !== 1 && !global.__mongooseConn) {
    global.__mongooseConn = mongoose.connect(MONGODB_URI, {
      bufferCommands: false,
      dbName: DB_NAME,
    });
  }
  const m = mongoose.connection.readyState === 1 ? mongoose : await global.__mongooseConn;
  await checkIdentity(m ?? mongoose);
  return m ?? mongoose;
}

// ── One database per child ────────────────────────────────────────────────

/**
 * Wissam's database. Nour's stays exactly where it was; Wissam's sits beside
 * it on the same cluster, marked the same way, so neither app can read or
 * write the other child's progress.
 */
const WISSAM_DB_NAME = IS_PRODUCTION ? "eduapp-wissam" : `${DB_NAME}-wissam`;
export const WISSAM_IDENTITY = IS_PRODUCTION ? "wissam-quest" : "wissam-quest-dev-copy";

export type LearnerModels = {
  WordList: typeof WordList;
  Profile: typeof Profile;
  MathProgress: typeof MathProgress;
  SpellChain: typeof SpellChain;
  TimesFact: typeof TimesFact;
};

const NOUR_MODELS: LearnerModels = { WordList, Profile, MathProgress, SpellChain, TimesFact };

/**
 * A model on another database. The schema is passed untyped on purpose:
 * asking TypeScript to compare these schema types exhausts its memory.
 */
function bind<K extends keyof LearnerModels>(
  conn: Connection,
  name: K,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: any
): LearnerModels[K] {
  return (conn.models[name] ?? conn.model(name, schema)) as unknown as LearnerModels[K];
}

/**
 * Check Wissam's mark, and on his first sign-in make his database: the mark,
 * then a copy of every word list Nour has (words and meanings only, no
 * progress). An unmarked database that already holds data is refused, the
 * same rule that guards Nour's.
 */
async function checkWissamDb(conn: Connection, nour: LearnerModels): Promise<void> {
  if (global.__wissamDbOk) return;
  const db = conn.db;
  if (!db) throw new Error("Wissam's database is not connected");
  const meta = db.collection<{ _id: string; value?: string; seeded?: boolean }>("meta");
  let mark = await meta.findOne({ _id: "identity" });
  if (!mark) {
    const names = (await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name);
    if (names.some((n) => n !== "meta")) {
      throw new Error(
        `Wrong database: "${db.databaseName}" holds data but no mark. Refusing to use it for Wissam.`
      );
    }
    await meta.updateOne(
      { _id: "identity" },
      { $setOnInsert: { value: WISSAM_IDENTITY, seeded: false } },
      { upsert: true }
    );
    mark = await meta.findOne({ _id: "identity" });
  }
  if (mark?.value !== WISSAM_IDENTITY) {
    throw new Error(
      `Wrong database: "${db.databaseName}" is marked "${mark?.value ?? "nothing"}", expected ` +
        `"${WISSAM_IDENTITY}". Refusing to run rather than read or write the wrong one.`
    );
  }
  if (!mark.seeded) {
    const lists = await nour.WordList.find({ kind: { $ne: "pool" } }).lean();
    const target = bind(conn, "WordList", WordListSchema);
    if (lists.length > 0) {
      await target.bulkWrite(
        lists.map((l) => ({
          updateOne: {
            filter: { _id: l._id },
            update: { $setOnInsert: listContent(l) },
            upsert: true,
          },
        })) as never
      );
    }
    await meta.updateOne({ _id: "identity" }, { $set: { seeded: true } });
  }
  global.__wissamDbOk = true;
}

/** The models for one child's database, checked before first use. */
export async function learnerModels(learner: LearnerId): Promise<LearnerModels> {
  await connectDB();
  if (learner === "nour") return NOUR_MODELS;
  const conn = mongoose.connection.useDb(WISSAM_DB_NAME, { useCache: true });
  await checkWissamDb(conn, NOUR_MODELS);
  return {
    WordList: bind(conn, "WordList", WordListSchema),
    Profile: bind(conn, "Profile", ProfileSchema),
    MathProgress: bind(conn, "MathProgress", MathProgressSchema),
    SpellChain: bind(conn, "SpellChain", SpellChainSchema),
    TimesFact: bind(conn, "TimesFact", TimesFactSchema),
  };
}

/** The signed-in child's models. What every page and route reads through. */
export async function db(): Promise<LearnerModels> {
  return learnerModels(await currentLearner());
}
