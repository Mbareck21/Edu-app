/**
 * Reading-variety probe.
 *
 * The bug this exists to measure: every list's FIRST generated passage opened
 * "Sam walked to ..." — 6 of 6 lists in the live database on 2026-08-31. The
 * generator had no way to know it had already written that story, because the
 * only variety memory it kept was scoped to one word list.
 *
 * What it does: drives the real POST /api/reading/generate route N times
 * against a scratch word list, resetting the variety memory before each call
 * in "cold" mode so every call is a first-generation. Reports how often the
 * same character name and the same opening come back.
 *
 * Run it:  node docs/probes/reading-variety.mjs [n] [cold|warm]
 * Needs a dev server on PORT (default 3000) and .env.local.
 */
import fs from "node:fs";
import { MongoClient } from "mongodb";
import { SignJWT } from "jose";

const ROOT = new URL("../../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const N = Number(process.argv[2] || 10);
const MODE = process.argv[3] === "warm" ? "warm" : "cold";
const PORT = process.env.PORT || 3000;
const BASE = `http://127.0.0.1:${PORT}`;
const PROBE_LIST = "__probe__ reading variety";

const env = Object.fromEntries(
  fs
    .readFileSync(`${ROOT}/.env.local`, "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);

const token = await new SignJWT({ sub: "probe" })
  .setProtectedHeader({ alg: "HS256" })
  .setIssuedAt()
  .setExpirationTime("2h")
  .sign(new TextEncoder().encode(env.AUTH_SECRET));

const client = new MongoClient(env.MONGODB_URI);
await client.connect();
const db = client.db("eduapp");
const lists = db.collection("wordlists");
const profiles = db.collection("profiles");

// Borrow a real list's words so the prompt gets the same shape it gets in
// production, then keep the probe's own document so nothing of his is touched.
const donor = await lists.findOne({ name: /Number Words/ });
await lists.deleteMany({ name: PROBE_LIST });
const { insertedId } = await lists.insertOne({
  name: PROBE_LIST,
  words: donor?.words ?? [],
  readingLevel: 1,
  currentReading: null,
  readingHistory: [],
  createdAt: new Date(),
  updatedAt: new Date(),
});
const listId = String(insertedId);

// Snapshot anything on the profile the probe is about to disturb, so his own
// variety memory survives the run.
const before = await profiles.findOne({ key: "default" });
const savedGlobal = before?.readingSeen ?? null;

// Only count a capitalised word as a name when it appears somewhere other than
// the start of a sentence. A hand-kept stop list could not keep up: the first
// run of this probe scored "Nature", "What", "Together", "Soon", "Suddenly"
// and "Patience" as characters, and the pass/fail verdict is computed from
// that tally.
function charactersIn(text) {
  const names = new Set();
  for (const sentence of text.split(/(?<=[.!?])\s+/)) {
    // Drop the opening word: a sentence-initial capital says nothing.
    const rest = sentence.replace(/^\s*\S+\s*/, "");
    for (const m of rest.matchAll(/\b([A-Z][a-z]{2,9})\b/g)) names.add(m[1]);
  }
  return [...names];
}

// Warm mode measures the real product: one reset, then N in a row with the
// profile-wide memory filling up as it would for him.
if (MODE === "warm") {
  await profiles.updateOne({ key: "default" }, { $set: { readingSeen: [] } });
}

const rows = [];
for (let i = 0; i < N; i++) {
  if (MODE === "cold") {
    await lists.updateOne(
      { _id: insertedId },
      { $set: { readingHistory: [], currentReading: null } }
    );
    await profiles.updateOne({ key: "default" }, { $set: { readingSeen: [] } });
  }
  const res = await fetch(`${BASE}/api/reading/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: `eduapp_session=${token}` },
    body: JSON.stringify({ listId, kind: "story" }),
  });
  const data = await res.json().catch(() => ({}));
  const cr = data.currentReading;
  if (!res.ok || !cr) {
    rows.push({ i, error: data.error || `HTTP ${res.status}` });
    console.log(`${i + 1}/${N}  ERROR  ${data.error || res.status}`);
    continue;
  }
  const opening = cr.paragraph.split(/\s+/).slice(0, 6).join(" ");
  const names = charactersIn(cr.paragraph);
  rows.push({ i, title: cr.title, opening, names });
  console.log(`${i + 1}/${N}  ${JSON.stringify(cr.title)}  ::  ${opening}`);
}

// Restore and clean up.
await lists.deleteOne({ _id: insertedId });
if (savedGlobal === null) await profiles.updateOne({ key: "default" }, { $unset: { readingSeen: "" } });
else await profiles.updateOne({ key: "default" }, { $set: { readingSeen: savedGlobal } });
await client.close();

const ok = rows.filter((r) => !r.error);
const tally = new Map();
for (const r of ok) for (const n of r.names) tally.set(n, (tally.get(n) || 0) + 1);
const first4 = new Set(ok.map((r) => r.opening.split(/\s+/).slice(0, 4).join(" ").toLowerCase()));
const topName = [...tally.entries()].sort((a, b) => b[1] - a[1])[0];

console.log(`\n── ${MODE} · ${ok.length} passages ─────────────────────────`);
console.log("names:", [...tally.entries()].sort((a, b) => b[1] - a[1]).map(([n, c]) => `${n}×${c}`).join("  "));
console.log(`distinct titles      ${new Set(ok.map((r) => r.title)).size}/${ok.length}`);
console.log(`distinct first-4     ${first4.size}/${ok.length}`);
console.log(`most-repeated name   ${topName ? `${topName[0]} in ${topName[1]}/${ok.length}` : "none"}`);

// The predicate: no name in more than a quarter of passages, every opening its own.
const nameOk = !topName || topName[1] <= Math.ceil(ok.length / 4);
const openOk = first4.size === ok.length;
console.log(`\nPREDICATE  names ${nameOk ? "PASS" : "FAIL"}   openings ${openOk ? "PASS" : "FAIL"}`);
process.exit(nameOk && openOk ? 0 : 1);
