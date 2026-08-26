import assert from "node:assert/strict";
import { test } from "node:test";

import { mulberry32 } from "@/lib/math/rng";
import {
  STRUCTURE_IDS,
  STRUCTURE_PASSAGES,
  TEXT_STRUCTURES,
  findSignalWords,
  structureById,
  structureChoices,
} from "@/lib/text-structure";

test("every passage's declared signal words really appear in its text", () => {
  for (const passage of STRUCTURE_PASSAGES) {
    for (const word of passage.signalWords) {
      const hits = findSignalWords(passage.text, [word]);
      assert.ok(hits.length > 0, `"${word}" not found in ${passage.id}`);
    }
  }
});

test("every structure has a distinct id, name, question and a non-empty frame", () => {
  assert.equal(TEXT_STRUCTURES.length, STRUCTURE_IDS.length);
  assert.equal(new Set(TEXT_STRUCTURES.map((s) => s.id)).size, TEXT_STRUCTURES.length);
  assert.equal(new Set(TEXT_STRUCTURES.map((s) => s.name)).size, TEXT_STRUCTURES.length);
  assert.equal(new Set(TEXT_STRUCTURES.map((s) => s.question)).size, TEXT_STRUCTURES.length);
  for (const structure of TEXT_STRUCTURES) {
    assert.ok(structure.frame.length > 0, `${structure.id} has an empty frame`);
    assert.ok(structure.signalWords.length > 0, `${structure.id} has no signal words`);
  }
});

test("the five passages cover the five structures, one each", () => {
  assert.equal(STRUCTURE_PASSAGES.length, 5);
  const covered = new Set(STRUCTURE_PASSAGES.map((p) => p.structure));
  for (const id of STRUCTURE_IDS) assert.ok(covered.has(id), `no passage for ${id}`);
});

test("structure choices include the right answer and plausible distractors", () => {
  for (const passage of STRUCTURE_PASSAGES) {
    const { options, answer } = structureChoices(passage, mulberry32(7));
    assert.equal(answer, passage.structure);
    assert.equal(options.length, 4);
    assert.ok(options.some((o) => o.id === answer), `${passage.id}: answer missing`);
    assert.equal(new Set(options.map((o) => o.id)).size, options.length);
  }
});

test("structure choices are deterministic for a fixed seed", () => {
  const passage = STRUCTURE_PASSAGES[0];
  const a = structureChoices(passage, mulberry32(42));
  const b = structureChoices(passage, mulberry32(42));
  assert.deepEqual(
    a.options.map((o) => o.id),
    b.options.map((o) => o.id)
  );
  const c = structureChoices(passage, mulberry32(43));
  // A different seed is allowed to give the same order by chance, but the
  // answer must still be there either way.
  assert.ok(c.options.some((o) => o.id === passage.structure));
});

test("signal word finder respects word boundaries", () => {
  // "cause" must not light up inside "because".
  assert.deepEqual(findSignalWords("It happened because of rain.", ["cause"]), []);
  // "first" must not light up inside "firstly" or "thirst".
  assert.deepEqual(findSignalWords("Firstly, he felt thirst.", ["first"]), []);
  // Trailing punctuation is not part of the word — "First," is still found.
  const hits = findSignalWords("First, we mixed the batter.", ["first"]);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].index, 0);
  assert.equal(hits[0].length, 5);
});

test("signal word finder ignores case and finds phrases", () => {
  const text = "IN ADDITION, otters use rocks. As a result, they eat well.";
  const hits = findSignalWords(text, ["in addition", "as a result"]);
  assert.deepEqual(
    hits.map((h) => h.word),
    ["in addition", "as a result"]
  );
  // Matches come back in text order with real positions for slicing.
  assert.equal(text.slice(hits[0].index, hits[0].index + hits[0].length), "IN ADDITION");
});

test("structureById returns the record for every id", () => {
  for (const id of STRUCTURE_IDS) {
    assert.equal(structureById(id).id, id);
  }
});
