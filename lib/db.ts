import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

declare global {
  // eslint-disable-next-line no-var
  var __mongooseConn: Promise<typeof mongoose> | undefined;
  var __dbIdentityOk: boolean | undefined;
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
