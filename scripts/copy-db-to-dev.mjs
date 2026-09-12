// Refresh the dev database from production: every collection in `eduapp`
// copied into `eduapp-dev` on the same cluster. Dev points at eduapp-dev
// (MONGODB_DB in .env.local) so testing never touches his real progress.
//   node scripts/copy-db-to-dev.mjs
import { readFileSync } from "node:fs";
import { MongoClient } from "mongodb";

const env = readFileSync(".env.local", "utf8");
const uri = env.match(/^MONGODB_URI=(.*)$/m)?.[1].trim().replace(/^"|"$/g, "");
if (!uri) throw new Error("MONGODB_URI not found in .env.local");

const client = new MongoClient(uri);
await client.connect();
const src = client.db("eduapp");
const dst = client.db("eduapp-dev");
for (const { name } of await src.listCollections().toArray()) {
  const docs = await src.collection(name).find().toArray();
  await dst.collection(name).deleteMany({});
  if (docs.length) await dst.collection(name).insertMany(docs);
  console.log(`${name}: ${docs.length}`);
}
// Mark the copy as the copy. The live app refuses it and local runs accept
// only it (lib/db.ts), so neither can ever write to the other's data.
await dst.collection("meta").updateOne(
  { _id: "identity" },
  { $set: { value: "nour-quest-dev-copy", copiedAt: new Date() } },
  { upsert: true }
);
console.log("marked eduapp-dev as the test copy");
await client.close();
