import assert from "node:assert/strict";
import { test } from "node:test";

import { todayKey } from "@/lib/day";
import {
  clearAllProgress,
  clearProgress,
  loadProgress,
  resumeKey,
  saveProgress,
  stamp,
  unstamp,
} from "@/lib/resume";

/**
 * He swipes down to scroll, the browser reads it as a refresh, and the lesson
 * restarts. Storage is localStorage stamped with his day: it lives until
 * midnight, closed app or not.
 */

type Fake = { store: Map<string, string>; throwOn?: boolean };

function fakeStorage(f: Fake) {
  return {
    get length() {
      return f.store.size;
    },
    key: (i: number) => [...f.store.keys()][i] ?? null,
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
}

function fakeWindow(f: Fake, session: Fake = { store: new Map() }): void {
  (globalThis as { window?: unknown }).window = {
    localStorage: fakeStorage(f),
    sessionStorage: fakeStorage(session),
  };
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
  const today = todayKey();
  const f: Fake = {
    store: new Map([
      ["k", "{not json"],
      ["j", stamp({ wrong: 1 }, today)],
    ]),
  };
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

test("a stamp only opens on the day it was made", () => {
  const raw = stamp({ queue: [1] }, "2026-09-27");
  assert.deepEqual(unstamp(raw, "2026-09-27"), { queue: [1] });
  assert.equal(unstamp(raw, "2026-09-28"), undefined);
  assert.equal(unstamp(JSON.stringify({ queue: [1] }), "2026-09-27"), undefined, "unstamped is old");
  assert.equal(unstamp("{nope", "2026-09-27"), undefined);
});

test("progress survives for the rest of the day, and is gone after midnight", () => {
  const f: Fake = { store: new Map() };
  fakeWindow(f);
  const key = resumeKey("items", "quest:review", "first");
  saveProgress(key, { queue: [5] });
  assert.equal(unstamp(f.store.get(key) ?? "", todayKey()) !== undefined, true, "stamped with today");
  assert.deepEqual(loadProgress(key, isQueue), { queue: [5] });

  // Saved yesterday: not resumed, and removed.
  f.store.set(key, stamp({ queue: [5] }, "2000-01-01"));
  assert.equal(loadProgress(key, isQueue), null);
  assert.equal(f.store.has(key), false);
});

test("clearing everything empties both storages, and only resume keys", () => {
  const f: Fake = { store: new Map() };
  const s: Fake = { store: new Map() };
  fakeWindow(f, s);
  saveProgress(resumeKey("math", "x", 1), { queue: [1] });
  f.store.set("quest:muted", "1");
  s.store.set(resumeKey("math", "old", 1), JSON.stringify({ queue: [] }));
  clearAllProgress();
  assert.deepEqual([...f.store.keys()], ["quest:muted"]);
  assert.equal(s.store.size, 0);
});
