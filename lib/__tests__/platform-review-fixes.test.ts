import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";

import { EdgeTTS } from "@andresaya/edge-tts";
import mongoose from "mongoose";

import { GET as speak } from "@/app/api/tts/route";
import { fillArabic, fillClues } from "@/lib/fill-clues";
import { AI_ARABIC_VOICE, AI_ENGLISH_VOICE, groq } from "@/lib/groq";
import {
  QUEUE_KEY,
  READING_QUEUE_KEY,
  flushQueue,
  postReadingDone,
  postSession,
  queueSize,
} from "@/lib/offline-queue";
import type { SessionResult } from "@/lib/types";

// ── Offline queue ─────────────────────────────────────────────────────────
// Same fake window as offline-queue.test.ts: the queue only touches storage
// when `window` exists.

const store = new Map<string, string>();
const g = globalThis as unknown as { window?: unknown; fetch: typeof fetch };
const realFetch = g.fetch;

const session: SessionResult = {
  kind: "vocab",
  ref: "list:match",
  answered: 4,
  correct: 4,
  fastCount: 1,
  ms: 5000,
  perfect: true,
};

function answer(status: number): void {
  g.fetch = (async () => new Response("", { status })) as unknown as typeof fetch;
}

function queued(): SessionResult[] {
  return JSON.parse(store.get(QUEUE_KEY) ?? "[]") as SessionResult[];
}

beforeEach(() => {
  store.clear();
  g.window = {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    },
  };
});

afterEach(() => {
  delete g.window;
  g.fetch = realFetch;
});

test("sign-out counts only the signed-in child's waiting games", () => {
  store.set(
    QUEUE_KEY,
    JSON.stringify([
      { ...session, sessionId: "nour-000001", learner: "nour" },
      { ...session, sessionId: "wissam-00001", learner: "wissam" },
      // From before sessions were stamped: it goes to whoever is signed in.
      { ...session, sessionId: "unstamped-01" },
    ])
  );
  assert.equal(queueSize("wissam"), 2);
  assert.equal(queueSize("nour"), 2);
  assert.equal(queueSize(), 3, "no child known: every item counts");
});

for (const status of [408, 425, 429]) {
  test(`a ${status} keeps the session for a retry instead of dropping it`, async () => {
    answer(status);
    const res = await postSession(session);
    assert.deepEqual(res, { saved: false });
    assert.equal(queueSize(), 1);

    assert.equal(await flushQueue(), 0);
    assert.equal(queueSize(), 1, "a flush keeps it too");
  });

  test(`a ${status} keeps a finished passage for the next flush`, async () => {
    answer(status);
    await postReadingDone({ listId: "list-1", perQuestion: [] });
    assert.equal((JSON.parse(store.get(READING_QUEUE_KEY) ?? "[]") as unknown[]).length, 1);
  });
}

test("a long offline stretch keeps every session", async () => {
  g.fetch = (async () => {
    throw new TypeError("Failed to fetch");
  }) as unknown as typeof fetch;
  for (let i = 0; i < 120; i++) {
    await postSession({ ...session, sessionId: `offline-${String(i).padStart(4, "0")}` });
  }
  const ids = queued().map((s) => s.sessionId);
  assert.equal(ids.length, 120);
  assert.equal(ids[0], "offline-0000");
});

test("the queue still has a ceiling, so storage cannot grow without end", async () => {
  store.set(
    QUEUE_KEY,
    JSON.stringify(Array.from({ length: 500 }, (_, i) => ({ ...session, sessionId: `old-${i}` })))
  );
  g.fetch = (async () => {
    throw new TypeError("Failed to fetch");
  }) as unknown as typeof fetch;
  await postSession({ ...session, sessionId: "newest-0001" });
  const ids = queued().map((s) => s.sessionId);
  assert.equal(ids.length, 500);
  assert.equal(ids.at(-1), "newest-0001");
});

// ── Database connection ───────────────────────────────────────────────────

test("a failed database connect is tried again on the next call", async () => {
  process.env.MONGODB_URI = "mongodb://stub.invalid/x";
  const flags = globalThis as { __dbIdentityOk?: boolean; __mongooseConn?: unknown };
  // The database mark is not what this test is about.
  flags.__dbIdentityOk = true;
  const m = mongoose as unknown as { connect: unknown };
  const realConnect = m.connect;
  let calls = 0;
  let fail = true;
  m.connect = async () => {
    calls++;
    if (fail) throw new Error("querySrv ETIMEOUT");
    return mongoose;
  };
  try {
    const { connectDB } = await import("@/lib/db");
    await assert.rejects(connectDB(), /ETIMEOUT/);
    fail = false; // the network is back
    await connectDB();
    assert.equal(calls, 2);
  } finally {
    m.connect = realConnect;
    delete flags.__mongooseConn;
    delete flags.__dbIdentityOk;
  }
});

// ── Stuck words: clue batches ─────────────────────────────────────────────

test("one clue or translation call asks for 30 words at most, the first ones", async () => {
  process.env.GROQ_API_KEY ??= "test-key";
  const completions = groq().chat.completions as unknown as { create: unknown };
  const realCreate = completions.create;
  const asked: string[][] = [];
  completions.create = async (req: { messages: { content: string }[] }) => {
    asked.push(req.messages[1].content.split("\n")[1].split(", "));
    return { choices: [{ message: { content: "{}" } }] };
  };
  const words = Array.from({ length: 100 }, (_, i) => `word${String.fromCharCode(97 + (i % 26))}${i}`);
  try {
    await fillClues(words);
    await fillArabic(words);
  } finally {
    completions.create = realCreate;
  }
  assert.equal(asked.length, 2);
  for (const list of asked) assert.deepEqual(list, words.slice(0, 30));
});

// ── Read-aloud chunks ─────────────────────────────────────────────────────

type Voiced = { text: string; voice: string };

async function voiceCalls(text: string): Promise<Voiced[]> {
  const proto = EdgeTTS.prototype as unknown as { synthesize: unknown; toBuffer: unknown };
  const real = { synthesize: proto.synthesize, toBuffer: proto.toBuffer };
  const calls: Voiced[] = [];
  proto.synthesize = async (t: string, voice: string) => void calls.push({ text: t, voice });
  proto.toBuffer = () => Buffer.alloc(1);
  try {
    const res = await speak(new Request(`http://x/api/tts?text=${encodeURIComponent(text)}`));
    assert.equal(res.status, 200);
  } finally {
    Object.assign(proto, real);
  }
  return calls;
}

test("letters that switch language every time make 20 voice calls at most", async () => {
  const text = "aب".repeat(1000);
  const calls = await voiceCalls(text);
  assert.ok(calls.length <= 20, `${calls.length} calls`);
  assert.equal(calls.map((c) => c.text).join(""), text, "no text is lost");
});

test("many real switches are capped at 20 calls and keep every word", async () => {
  const text = "ab بت ".repeat(300).trim();
  const calls = await voiceCalls(text);
  assert.ok(calls.length <= 20, `${calls.length} calls`);
  assert.equal(calls.map((c) => c.text).join(""), text);
});

test("an English word inside Arabic keeps its own voice", async () => {
  const calls = await voiceCalls("هذه الكلمة brave تعني شجاع");
  assert.deepEqual(
    calls.map((c) => c.voice),
    [AI_ARABIC_VOICE, AI_ENGLISH_VOICE, AI_ARABIC_VOICE]
  );
});
