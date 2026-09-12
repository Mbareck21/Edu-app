import { NextResponse } from "next/server";
import mongoose from "mongoose";

import { connectDBUnchecked } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * TEMPORARY. Dumps the progress collections of whatever database the app is
 * connected to, as Extended JSON so ids and dates survive. Exists only to lift
 * the six days the live app spent on the wrong database back into the
 * original (scripts/merge-live-into-original.mjs --source-file). Behind the
 * session cookie like every /api route; removed once the merge is done.
 */
const COLLECTIONS = ["profiles", "wordlists", "spellchains", "timesfacts", "mathprogresses"];

export async function GET() {
  await connectDBUnchecked();
  const db = mongoose.connection.db;
  if (!db) return NextResponse.json({ error: "no database" }, { status: 500 });
  const out: Record<string, unknown[]> = {};
  for (const name of COLLECTIONS) out[name] = await db.collection(name).find().toArray();
  return new NextResponse(mongoose.mongo.BSON.EJSON.stringify(out, { relaxed: false }), {
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}
