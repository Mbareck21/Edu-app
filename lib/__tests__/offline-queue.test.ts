import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";

import { QUEUE_KEY, flushQueue, postSession, queueSize } from "@/lib/offline-queue";
import type { SessionResult } from "@/lib/types";

// offline-queue only touches storage when `window` exists, so the fake window
// is what makes the queue observable from node.
const store = new Map<string, string>();
const fakeWindow = {
  localStorage: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  },
};

type Responder = (body: SessionResult) => Response | Promise<Response>;

let calls: SessionResult[] = [];
const g = globalThis as unknown as { window?: unknown; fetch: typeof fetch };
const realFetch = g.fetch;

function respondWith(responder: Responder): void {
  g.fetch = (async (_url: string, init?: { body?: string }) => {
    const body = JSON.parse(String(init?.body)) as SessionResult;
    calls.push(body);
    return responder(body);
  }) as unknown as typeof fetch;
}

function okResponse(): Response {
  return new Response(JSON.stringify({ gained: { xp: 1 }, profile: { xp: 1 } }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

const session: SessionResult = {
  kind: "vocab",
  ref: "list:flashcards",
  answered: 4,
  correct: 4,
  fastCount: 1,
  ms: 5000,
  perfect: true,
};

beforeEach(() => {
  store.clear();
  calls = [];
  g.window = fakeWindow;
});

afterEach(() => {
  delete g.window;
  g.fetch = realFetch;
});

test("a rejected payload is dropped, not retried and not queued", async () => {
  respondWith(() => new Response("nope", { status: 400 }));
  const res = await postSession(session);
  assert.deepEqual(res, { saved: false, invalid: true });
  assert.equal(calls.length, 1, "no retry on a 4xx");
  assert.equal(queueSize(), 0);
});

test("a transient failure retries once and then queues", async () => {
  respondWith(() => {
    throw new Error("offline");
  });
  const res = await postSession(session);
  assert.deepEqual(res, { saved: false });
  assert.equal(calls.length, 2);
  assert.equal(queueSize(), 1);
});

test("a 5xx is treated as transient", async () => {
  respondWith(() => new Response("boom", { status: 500 }));
  const res = await postSession(session);
  assert.deepEqual(res, { saved: false });
  assert.equal(calls.length, 2);
  assert.equal(queueSize(), 1);
});

test("the retry and the queued copy carry the same sessionId", async () => {
  respondWith(() => {
    throw new Error("offline");
  });
  await postSession(session);
  const id = calls[0].sessionId;
  assert.ok(id && id.length >= 8, "postSession mints a sessionId");
  assert.equal(calls[1].sessionId, id);
  const queued = JSON.parse(store.get(QUEUE_KEY) ?? "[]") as SessionResult[];
  assert.equal(queued[0].sessionId, id);
});

test("an existing sessionId is kept", async () => {
  respondWith(okResponse);
  await postSession({ ...session, sessionId: "already-mine-1234" });
  assert.equal(calls[0].sessionId, "already-mine-1234");
});

test("flushQueue drops rejects and keeps transient failures", async () => {
  store.set(
    QUEUE_KEY,
    JSON.stringify([
      { ...session, sessionId: "bad-payload-0001" },
      { ...session, sessionId: "good-payload-002" },
    ])
  );
  respondWith((body) =>
    body.sessionId === "bad-payload-0001"
      ? new Response("nope", { status: 400 })
      : new Response("boom", { status: 503 })
  );

  const sent = await flushQueue();
  assert.equal(sent, 0);
  const left = JSON.parse(store.get(QUEUE_KEY) ?? "[]") as SessionResult[];
  assert.deepEqual(
    left.map((i) => i.sessionId),
    ["good-payload-002"]
  );
});

test("flushQueue clears what the server accepted", async () => {
  store.set(QUEUE_KEY, JSON.stringify([{ ...session, sessionId: "good-payload-002" }]));
  respondWith(okResponse);
  assert.equal(await flushQueue(), 1);
  assert.equal(queueSize(), 0);
});
