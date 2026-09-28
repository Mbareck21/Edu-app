import assert from "node:assert/strict";
import test from "node:test";

import { sameSitePath } from "@/lib/same-site-path";

const ORIGIN = "https://quest.example";
(globalThis as unknown as { window: unknown }).window = { location: { origin: ORIGIN } };

/** Where the browser would really go if the router got `path`. */
function lands(path: string): string {
  return new URL(path, ORIGIN).origin;
}

test("next= pages on this site pass through", () => {
  assert.equal(sameSitePath("/learn/abc?x=1#top"), "/learn/abc?x=1#top");
  assert.equal(sameSitePath(null), "/");
  assert.equal(sameSitePath(""), "/");
});

test("next= can never send him to another site after the PIN", () => {
  for (const next of [
    "https://evil.example/login",
    "//evil.example",
    "/\t/evil.example",
    "/.//evil.example",
    "/..//evil.example",
    "/%2e//evil.example",
    "///evil.example",
    "/\\evil.example",
  ]) {
    const path = sameSitePath(next);
    assert.ok(path.startsWith("/") && !path.startsWith("//"), `${next} -> ${path}`);
    assert.equal(lands(path), ORIGIN, `${next} -> ${path} leaves the site`);
  }
});
