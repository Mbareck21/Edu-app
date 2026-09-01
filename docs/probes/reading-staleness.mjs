/**
 * Staleness probe for the Read step.
 *
 * The bug this exists to measure: the Read step handed back whatever passage
 * was last saved on the list, however old. On 2026-08-31 two of his lists held
 * a `currentReading` written on 2026-08-22 and 2026-08-29, so opening either
 * one gave him a story he had already read, with no way to ask for another
 * short of answering every question on it first.
 *
 * What it does: renders the real /learn/<id>/read page twice against a scratch
 * list — once with a passage dated yesterday, once with the same passage dated
 * today — and asserts the page offers a fresh one in the first case and shows
 * the passage plus an escape hatch in the second.
 *
 * Run it:  node docs/probes/reading-staleness.mjs
 * Needs a dev server on PORT (default 3000) and .env.local. Costs no AI calls.
 */
import fs from "node:fs";
import { MongoClient } from "mongodb";
import { SignJWT } from "jose";

const ROOT = new URL("../../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const PORT = process.env.PORT || 3000;
const PROBE_LIST = "__probe__ staleness";

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
const lists = client.db("eduapp").collection("wordlists");

const TITLE = "A Passage From Before";
const reading = (generatedAt) => ({
  title: TITLE,
  paragraph: "Rain tapped the window all morning long. Nobody wanted to go outside.",
  questions: [
    { q: "What tapped the window?", type: "detail", acceptable: ["rain"], hints: ["h1", "h2"], options: [], answerIndex: -1, source: "" },
    { q: "Why stay in?", type: "inference", acceptable: ["it rained"], hints: ["h1", "h2"], options: [], answerIndex: -1, source: "" },
  ],
  vocabGlosses: [],
  level: 1,
  passageKind: "story",
  topic: "weather",
  generatedAt,
});

await lists.deleteMany({ name: PROBE_LIST });
const { insertedId } = await lists.insertOne({
  name: PROBE_LIST,
  words: [],
  readingLevel: 1,
  readingHistory: [],
  currentReading: reading(new Date(Date.now() - 3 * 86_400_000)),
  createdAt: new Date(),
  updatedAt: new Date(),
});

/**
 * The rendered markup only. The props travel down inside <script> payloads
 * too, so a plain string search on the whole response finds the old title
 * whether or not anything puts it on screen — the first version of this probe
 * failed on exactly that.
 */
const render = async () => {
  const res = await fetch(`http://127.0.0.1:${PORT}/learn/${insertedId}/read`, {
    headers: { cookie: `eduapp_session=${token}` },
  });
  const html = await res.text();
  return html.replace(/<script[\s\S]*?<\/script>/g, "");
};

const results = [];
const check = (name, pass, detail) => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
};

const old = await render();
check("a passage from an earlier day is not shown", !old.includes(TITLE));
check("he is offered a fresh one instead", old.includes("Write my reading"));

await lists.updateOne({ _id: insertedId }, { $set: { currentReading: reading(new Date()) } });
const today = await render();
check("today's passage is still shown", today.includes(TITLE));
check("and he can ask for a different one", today.includes("I want a different story"));

await lists.deleteOne({ _id: insertedId });
await client.close();

const failed = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed === 0 ? 0 : 1);
