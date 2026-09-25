import assert from "node:assert/strict";
import test from "node:test";

import { CREATURES, SET_STARTS, creatureFor } from "@/lib/creatures";
import { BADGES } from "@/lib/rewards";

test("every badge has its own creature", () => {
  for (const badge of BADGES) assert.ok(CREATURES[badge.id], `no creature for ${badge.id}`);
  const names = BADGES.map((b) => creatureFor(b.id).name);
  assert.equal(new Set(names).size, names.length, "two badges share a creature");
});

test("an unknown badge still gets a friendly mystery creature", () => {
  assert.equal(creatureFor("nope").name, "Mystery Friend");
});

test("no creature is left without a badge, and grid names are unique", () => {
  const ids = new Set(BADGES.map((b) => b.id));
  for (const id of Object.keys(CREATURES)) assert.ok(ids.has(id), `creature ${id} has no badge`);
  // The grid shows only the first word of the name.
  const first = BADGES.map((b) => creatureFor(b.id).name.split(" ")[0]);
  assert.equal(new Set(first).size, first.length);
});

test("sets of 12, 12 and 10, each ending where it should", () => {
  assert.deepEqual(SET_STARTS, [0, 12, 24]);
  assert.equal(BADGES[SET_STARTS[1] - 1].id, "unit-done");
  assert.equal(BADGES[SET_STARTS[2] - 1].id, "level-20");
  assert.equal(BADGES[SET_STARTS[2]].id, "words-25");
  assert.equal(BADGES.length - SET_STARTS[2], 10);
});
