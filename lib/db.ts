import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

declare global {
  // eslint-disable-next-line no-var
  var __mongooseConn: Promise<typeof mongoose> | undefined;
  var __dbIdentityOk: boolean | undefined;
}

/**
 * The record that marks Nour's database: `meta` collection, `_id: "identity"`.
 *
 * On 2026-09-07 a password rotation left Vercel's MONGODB_URI pointing at a
 * different, empty database. Nothing failed: the app made a new profile at
 * zero XP and he spent six days starting over while his real history sat
 * untouched. So the app now checks that it is on the right database before
 * it reads or writes anything, and stops with this message if it is not. A
 * copy made by scripts/copy-db-to-dev.mjs carries the record too.
 */
export const DB_IDENTITY = "nour-quest-original";

async function checkIdentity(m: typeof mongoose): Promise<void> {
  if (global.__dbIdentityOk) return;
  const db = m.connection.db;
  const doc = db
    ? await db.collection<{ _id: string; value?: string }>("meta").findOne({ _id: "identity" })
    : null;
  if (doc?.value !== DB_IDENTITY) {
    throw new Error(
      `Wrong database: "${db?.databaseName ?? "?"}" has no identity record. MONGODB_URI must point at ` +
        `Nour's database. Refusing to run rather than start him again from zero.`
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
      // Dev points at eduapp-dev (see .env.local); production leaves this unset.
      dbName: process.env.MONGODB_DB ?? "eduapp",
    });
  }
  const m = mongoose.connection.readyState === 1 ? mongoose : await global.__mongooseConn;
  await checkIdentity(m ?? mongoose);
  return m ?? mongoose;
}

/**
 * TEMPORARY, for app/api/export only: the connection without the identity
 * check, so the wrong database can still be read out once the app has locked.
 * Removed with that route.
 */
export async function connectDBUnchecked(): Promise<typeof mongoose> {
  if (!MONGODB_URI) throw new Error("MONGODB_URI is not set.");
  if (mongoose.connection.readyState !== 1 && !global.__mongooseConn) {
    global.__mongooseConn = mongoose.connect(MONGODB_URI, {
      bufferCommands: false,
      dbName: process.env.MONGODB_DB ?? "eduapp",
    });
  }
  return mongoose.connection.readyState === 1 ? mongoose : ((await global.__mongooseConn) ?? mongoose);
}
