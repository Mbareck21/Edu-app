import assert from "node:assert/strict";
import { test } from "node:test";

import {
  continueHref,
  forgetOpenReading,
  isEchoProgress,
  openReading,
  readingMode,
  rememberOpenReading,
} from "@/lib/reading-resume";

/**
 * Leaving a reading for Home and tapping Reading again started it over: the
 * echo reader's sentence was never saved, and Home's Reading beat could open
 * a different list's page from the one he was reading.
 */

function fakeSession(): Map<string, string> {
  const store = new Map<string, string>();
  (globalThis as { window?: unknown }).window = {
    sessionStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
  };
  return store;
}

test("the two modes stay; the dropped ones carry on as read after the robot", () => {
  assert.equal(readingMode("echo"), "echo");
  assert.equal(readingMode("alone"), "alone");
  assert.equal(readingMode("listen"), "echo");
  assert.equal(readingMode("aloud"), "echo");
  assert.equal(readingMode("sing"), null);
  assert.equal(readingMode(undefined), null);
});

test("an echo place is four counts, none negative", () => {
  assert.equal(isEchoProgress({ idx: 3, passed: 2, pctSum: 1.7, pctCount: 2 }), true);
  assert.equal(isEchoProgress({ idx: 3, passed: 2, pctSum: 1.7 }), false);
  assert.equal(isEchoProgress({ idx: -1, passed: 0, pctSum: 0, pctCount: 0 }), false);
  assert.equal(isEchoProgress({ idx: "3", passed: 0, pctSum: 0, pctCount: 0 }), false);
  assert.equal(isEchoProgress(null), false);
});

test("Reading goes back to the page he left today, not the unit's", () => {
  const open = { href: "/learn/b/read?saved=2026-09-25", day: "2026-09-25" };
  assert.equal(continueHref(open, "2026-09-25", "/learn/a/read"), open.href);
});

test("yesterday's page, or nothing, leaves the unit's reading", () => {
  const open = { href: "/learn/b/read", day: "2026-09-24" };
  assert.equal(continueHref(open, "2026-09-25", "/learn/a/read"), "/learn/a/read");
  assert.equal(continueHref(null, "2026-09-25", "/learn/a/read"), "/learn/a/read");
});

test("only a reading page of this app is ever followed", () => {
  const today = "2026-09-25";
  for (const href of ["https://evil.example/learn/a/read", "/learn/a/review", "/me", "//x/learn/a/read"]) {
    assert.equal(continueHref({ href, day: today }, today, "/learn/a/read"), "/learn/a/read", href);
  }
});

test("the open page is remembered, and forgotten only by that page", () => {
  fakeSession();
  assert.equal(openReading(), null);
  rememberOpenReading("/learn/b/read", "2026-09-25");
  assert.deepEqual(openReading(), { href: "/learn/b/read", day: "2026-09-25" });
  forgetOpenReading("/learn/a/read");
  assert.deepEqual(openReading(), { href: "/learn/b/read", day: "2026-09-25" }, "another page's finish");
  forgetOpenReading("/learn/b/read");
  assert.equal(openReading(), null);
  delete (globalThis as { window?: unknown }).window;
});
