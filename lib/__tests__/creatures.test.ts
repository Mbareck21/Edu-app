import assert from "node:assert/strict";
import test from "node:test";

import { CREATURES, SET_ONE_SIZE, creatureFor } from "@/lib/creatures";
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

test("set 1 is the first 12 badges and set 2 has 12 more", () => {
  assert.equal(SET_ONE_SIZE, 12);
  assert.equal(BADGES[SET_ONE_SIZE - 1].id, "unit-done");
  assert.equal(BADGES.length - SET_ONE_SIZE, 12);
});
