import assert from "node:assert/strict";
import { test } from "node:test";

import { clearProgress, loadProgress, resumeKey, saveProgress } from "@/lib/resume";

/**
 * He swipes down to scroll, the browser reads it as a refresh, and the lesson
 * restarts. Storage is sessionStorage: it lives as long as the tab.
 */

type Fake = { store: Map<string, string>; throwOn?: boolean };

function fakeWindow(f: Fake): void {
  const ss = {
    getItem: (k: string) => {
      if (f.throwOn) throw new Error("blocked");
      return f.store.get(k) ?? null;
    },
    setItem: (k: string, v: string) => {
      if (f.throwOn) throw new Error("blocked");
      f.store.set(k, v);
    },
    removeItem: (k: string) => {
      f.store.delete(k);
    },
  };
  (globalThis as { window?: unknown }).window = { sessionStorage: ss };
}

const isQueue = (v: unknown): v is { queue: number[] } =>
  typeof v === "object" && v !== null && Array.isArray((v as { queue?: unknown }).queue);

test("a run's key is one per seed, so Again is a fresh start", () => {
  assert.notEqual(resumeKey("math", "place-value", 1), resumeKey("math", "place-value", 2));
  assert.equal(resumeKey("math", "place-value", 7), resumeKey("math", "place-value", 7));
});

test("saved progress comes back, and is gone once cleared", () => {
  const f: Fake = { store: new Map() };
  fakeWindow(f);
  const key = resumeKey("math", "x", 1);
  assert.equal(loadProgress(key, isQueue), null);
  saveProgress(key, { queue: [3, 4] });
  assert.deepEqual(loadProgress(key, isQueue), { queue: [3, 4] });
  clearProgress(key);
  assert.equal(loadProgress(key, isQueue), null);
});

test("garbage in storage is treated as nothing saved", () => {
  const f: Fake = { store: new Map([["k", "{not json"], ["j", JSON.stringify({ wrong: 1 })]]) };
  fakeWindow(f);
  assert.equal(loadProgress("k", isQueue), null);
  assert.equal(loadProgress("j", isQueue), null, "the shape is checked, not just the parse");
});

test("blocked storage never breaks a lesson", () => {
  const f: Fake = { store: new Map(), throwOn: true };
  fakeWindow(f);
  assert.doesNotThrow(() => saveProgress("k", { queue: [] }));
  assert.equal(loadProgress("k", isQueue), null);
});

test("no window means no storage, quietly", () => {
  delete (globalThis as { window?: unknown }).window;
  assert.equal(loadProgress("k", isQueue), null);
  assert.doesNotThrow(() => saveProgress("k", { queue: [] }));
  assert.doesNotThrow(() => clearProgress("k"));
});
