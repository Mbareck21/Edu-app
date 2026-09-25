import assert from "node:assert/strict";
import test from "node:test";

import { CREATURES, creatureFor } from "@/lib/creatures";
import { BADGES } from "@/lib/rewards";

test("every badge has its own creature", () => {
  for (const badge of BADGES) assert.ok(CREATURES[badge.id], `no creature for ${badge.id}`);
  const names = BADGES.map((b) => creatureFor(b.id).name);
  assert.equal(new Set(names).size, names.length, "two badges share a creature");
});

test("an unknown badge still gets a friendly mystery creature", () => {
  assert.equal(creatureFor("nope").name, "Mystery Friend");
});
