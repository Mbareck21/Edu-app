// API audit: every route without a session, with a wrong session, and with bad input.
//   node docs/probes/api-audit.mjs          (dev server must be on PORT, default 3000)
//
// Rules it checks:
//   - no session            -> 401 on every route except sign-in
//   - bad or missing input  -> a 4xx, never a 500
//   - an unknown list id    -> 400 or 404, never a 500
//   - a child cannot delete a list the other child added (403)
//   - list changes need the grown-ups unlock (403 without it)
//   - sign-in: the right PIN works, wrong PINs are throttled per phone and
//     per home, and one phone's lockout leaves the other phone free
// Routes that spend Groq tokens only ever get a body that cannot parse, so
// the audit never reaches the model. Local runs use the test copy of the
// database (lib/db.ts), so the writes here never touch the children's data.
// Exit code 1 when any rule is broken.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { SignJWT } from "jose";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const ORIGIN = `http://localhost:${process.env.PORT || 3000}`;

const env = Object.fromEntries(
  (await readFile(path.join(ROOT, ".env.local"), "utf8"))
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);
const key = new TextEncoder().encode(env.AUTH_SECRET);
const sign = (payload) =>
  new SignJWT(payload).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("30m").sign(key);

const adultToken = await sign({ adult: true });
const cookieFor = async (learner, adult = true) =>
  [`eduapp_session=${await sign({ ok: true, learner })}`, `eduapp_learner=${learner}`, adult ? `eduapp_adult=${adultToken}` : ""]
    .filter(Boolean)
    .join("; ");
const NOUR = await cookieFor("nour");
const WISSAM = await cookieFor("wissam");
const NOUR_NO_ADULT = await cookieFor("nour", false);

let broken = 0;
function check(ok, label, detail) {
  if (!ok) broken++;
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${detail ? `  (${detail})` : ""}`);
}

async function call(method, route, { cookie, body, raw } = {}) {
  const headers = { "content-type": "application/json", origin: ORIGIN };
  if (cookie) headers.cookie = cookie;
  const res = await fetch(ORIGIN + route, {
    method,
    headers,
    body: raw !== undefined ? raw : body !== undefined ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    // not JSON
  }
  return { status: res.status, json, headers: res.headers };
}

const lists = (await call("GET", "/api/lists", { cookie: NOUR })).json;
const all = Array.isArray(lists) ? lists : lists?.lists ?? [];
const listId = all[0]?._id ?? "000000000000000000000000";
const nourList = all.find((l) => (l.addedBy ?? "nour") === "nour")?._id;
const MISSING = "0123456789abcdef01234567";

// Groq-backed: only ever sent a body that cannot parse.
const GROQ = new Set([
  "POST /api/chat",
  "POST /api/clues",
  "POST /api/lists/seed",
  `POST /api/lists/${listId}/examples`,
  `POST /api/lists/${listId}/flashcards/explain`,
  `POST /api/lists/${listId}/flashcards/translate`,
  "POST /api/reading/generate",
  "POST /api/transcribe",
]);
const ROUTES = [
  ["POST", "/api/adult"],
  ["DELETE", "/api/adult"],
  ["POST", "/api/chat"],
  ["POST", "/api/clues"],
  ["GET", "/api/lists"],
  ["POST", "/api/lists"],
  ["POST", "/api/lists/seed"],
  ["POST", `/api/lists/${listId}/examples`],
  ["POST", `/api/lists/${listId}/flashcards/explain`],
  ["POST", `/api/lists/${listId}/flashcards/review`],
  ["POST", `/api/lists/${listId}/flashcards/translate`],
  ["GET", `/api/lists/${listId}`],
  ["PATCH", `/api/lists/${listId}`],
  ["DELETE", `/api/lists/${MISSING}`],
  ["GET", "/api/profile"],
  ["PATCH", "/api/profile"],
  ["POST", "/api/reading/complete"],
  ["POST", "/api/reading/generate"],
  ["POST", "/api/sessions/complete"],
  ["POST", "/api/stuck"],
  ["POST", "/api/stuck/write"],
  ["POST", "/api/tables/answer"],
  ["POST", "/api/transcribe"],
  ["GET", "/api/tts"],
];

console.log("-- no session");
for (const [method, route] of ROUTES) {
  const r = await call(method, route, { raw: method === "GET" || method === "DELETE" ? undefined : "{}" });
  check(r.status === 401, `${method} ${route} -> 401`, `got ${r.status}`);
}

console.log("-- bad input, signed in");
const BAD = [
  ["not json", "{not json"],
  ["empty object", "{}"],
  ["wrong types", JSON.stringify({ words: "x", items: 7, answers: "no", pin: 5, text: 5, name: [], sessionId: {}, kind: 3, results: "x", correct: "x", total: "x" })],
  ["array", "[1,2,3]"],
  ["null", "null"],
];
for (const [method, route] of ROUTES) {
  if (method === "GET" || method === "DELETE") continue;
  if (route === "/api/adult") continue; // sign-in: tested below
  const cases = GROQ.has(`${method} ${route}`) ? BAD.slice(0, 1) : BAD;
  for (const [name, raw] of cases) {
    const r = await call(method, route, { cookie: NOUR, raw });
    check(r.status < 500, `${method} ${route} [${name}] -> not 5xx`, `got ${r.status}`);
  }
}
{
  const r = await call("GET", "/api/tts", { cookie: NOUR });
  check(r.status >= 400 && r.status < 500, "GET /api/tts with no text -> 4xx", `got ${r.status}`);
}

console.log("-- unknown list ids");
for (const id of ["not-an-id", MISSING]) {
  for (const method of ["GET", "PATCH", "DELETE"]) {
    const r = await call(method, `/api/lists/${id}`, { cookie: NOUR, raw: method === "PATCH" ? "{}" : undefined });
    check(r.status === 400 || r.status === 404, `${method} /api/lists/${id} -> 400/404`, `got ${r.status}`);
  }
  const r = await call("POST", `/api/lists/${id}/flashcards/review`, { cookie: NOUR, body: { word: "x", easy: true } });
  check(r.status === 400 || r.status === 404, `POST /api/lists/${id}/flashcards/review -> 400/404`, `got ${r.status}`);
}

console.log("-- ownership and grown-ups lock");
if (nourList) {
  const r = await call("DELETE", `/api/lists/${nourList}`, { cookie: WISSAM });
  check(r.status === 403, "Wissam cannot delete a list Nour added -> 403", `got ${r.status}`);
} else {
  console.log("skip  no list owned by Nour in the test copy");
}
if (env.ADULT_PIN) {
  const r = await call("POST", "/api/lists", { cookie: NOUR_NO_ADULT, body: { name: "x", words: [] } });
  check(r.status === 403, "POST /api/lists without the grown-ups unlock -> 403", `got ${r.status}`);
  const d = await call("DELETE", `/api/lists/${MISSING}`, { cookie: NOUR_NO_ADULT });
  check(d.status === 403, "DELETE /api/lists/:id without the grown-ups unlock -> 403", `got ${d.status}`);
} else {
  console.log("skip  ADULT_PIN not set, so nothing is locked");
}

console.log("-- sign-in");
{
  const right = await call("POST", "/api/auth", { body: { pin: env.PARENT_PIN } });
  const setCookie = right.headers.get("set-cookie") ?? "";
  check(right.status === 200 && setCookie.includes("eduapp_session="), "right PIN signs in", `got ${right.status}`);
  check(/httponly/i.test(setCookie), "session cookie is httpOnly");
  if (env.WISSAM_PIN) {
    const w = await call("POST", "/api/auth", { body: { pin: env.WISSAM_PIN } });
    check(w.status === 200 && (w.headers.get("set-cookie") ?? "").includes("eduapp_learner=wissam"), "Wissam's PIN signs in Wissam", `got ${w.status}`);
  }
  for (const [name, raw] of BAD) {
    const r = await call("POST", "/api/auth", { raw });
    check(r.status >= 400 && r.status < 500, `POST /api/auth [${name}] -> 4xx`, `got ${r.status}`);
  }
  // Per phone, then per home: one boy's misses must not lock his brother out.
  const phoneA = "eduapp_device=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const phoneB = "eduapp_device=bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  let throttled = false;
  for (let i = 0; i < 10; i++) {
    const r = await call("POST", "/api/auth", { cookie: phoneA, body: { pin: "0000000" } });
    if (r.status === 429) {
      throttled = true;
      break;
    }
  }
  check(throttled, "wrong PINs from one phone are throttled within 10 tries");
  const other = await call("POST", "/api/auth", { cookie: phoneB, body: { pin: env.PARENT_PIN } });
  check(other.status === 200, "the other phone on the same wifi still signs in", `got ${other.status}`);
  let homeStop = false;
  for (let i = 0; i < 30; i++) {
    const r = await call("POST", "/api/auth", { body: { pin: "0000000" } });
    if (r.status === 429) {
      homeStop = true;
      break;
    }
  }
  check(homeStop, "guessing with no cookie is still stopped by the home limit within 30 tries");
}

console.log(`\n${broken} rule(s) broken`);
process.exit(broken > 0 ? 1 : 0);
