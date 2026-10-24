// Home, the finish screens and the kid-lock gate must agree on where each
// quest beat leads, or a locked child is sent back Home from the beat Home
// just handed him. They agree because one function builds the beats for all
// of them: loadDay (lib/daily-plan-data.ts). A fourth caller of planBeats
// that forgot the report card's catch-up would quietly break that.

import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";

const ROOT = join(__dirname, "..", "..");

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (name === "node_modules" || name === "__tests__" || name.startsWith(".")) return [];
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

test("the quest beats are built in one place", () => {
  const callers = ["app", "lib", "components"]
    .flatMap((d) => sources(join(ROOT, d)))
    .filter((f) => /\bplanBeats\(/.test(readFileSync(f, "utf8")))
    .map((f) => relative(ROOT, f).replaceAll("\\", "/"))
    .sort();
  assert.deepEqual(callers, ["lib/daily-plan-beats.ts", "lib/daily-plan-data.ts"]);
});
