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
  structureSession,
  STRUCTURE_ROUNDS,
  passagesFor,
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

test("every structure has several passages, not one", () => {
  // One passage each meant the lesson ran the same five texts in the same
  // order every time, so he could answer from position without reading.
  for (const id of STRUCTURE_IDS) {
    assert.ok(passagesFor(id).length >= 3, `only ${passagesFor(id).length} for ${id}`);
  }
  assert.equal(new Set(STRUCTURE_PASSAGES.map((p) => p.id)).size, STRUCTURE_PASSAGES.length);
});

test("the teacher's five passages are still here, word for word", () => {
  // These are his actual homework. A later edit must not quietly reword them.
  const teacher = STRUCTURE_PASSAGES.filter((p) => p.source === "teacher");
  assert.equal(teacher.length, 5);
  assert.deepEqual(
    teacher.map((p) => p.id).sort(),
    ["butterfly-grows", "frogs-toads", "ocean-plastic", "sea-otters", "wildfires"]
  );
  // One structure each, so a session can always draw a teacher passage.
  assert.equal(new Set(teacher.map((p) => p.structure)).size, 5);
  const otters = teacher.find((p) => p.id === "sea-otters");
  assert.ok(
    otters?.text.startsWith("Sea otters are amazing ocean animals with many interesting features."),
    "the sea otters passage has been reworded"
  );
});

test("passages are written in the English his school grades him in", () => {
  // He is at an Arkansas public school and spelling is his weakest skill, so
  // the app must not teach a spelling his teacher marks wrong. Ten passages
  // added on 2026-09-01 shipped colour/vapour/autumn/towards before this.
  const BRITISH = /(colour|colours|vapour|autumn|towards|behaviour|grey|centre|metre|practise|realise|neighbour|favourite)/i;
  for (const passage of STRUCTURE_PASSAGES) {
    const hit = passage.text.match(BRITISH) ?? passage.title.match(BRITISH);
    assert.equal(hit, null, `${passage.id} uses "${hit?.[0]}"`);
  }
});

test("no structure can be answered by elimination", () => {
  // One round per structure meant the fifth answer was free: whatever had not
  // come up yet. The session runs one extra round so counting settles nothing.
  for (let seed = 1; seed <= 60; seed++) {
    const session = structureSession(mulberry32(seed));
    assert.equal(session.length, STRUCTURE_ROUNDS);
    assert.ok(STRUCTURE_ROUNDS > STRUCTURE_IDS.length, "an extra round is what breaks the count");
    const counts = new Map<string, number>();
    for (const r of session) {
      counts.set(r.passage.structure, (counts.get(r.passage.structure) ?? 0) + 1);
    }
    // Still every structure practised, but one appears twice.
    assert.equal(counts.size, STRUCTURE_IDS.length, `seed ${seed} skipped a structure`);
    assert.ok([...counts.values()].some((n) => n === 2), `seed ${seed} has no repeat`);
    // The repeat should be a different text where the pool allows one.
    assert.equal(new Set(session.map((r) => r.passage.id)).size, session.length);
  }
});

test("a session covers all five structures in a varying order", () => {
  const ids = (seed: number) => structureSession(mulberry32(seed)).map((r) => r.passage.structure);
  for (let seed = 1; seed <= 50; seed++) {
    const session = structureSession(mulberry32(seed));
    assert.equal(session.length, STRUCTURE_ROUNDS);
    assert.equal(new Set(session.map((r) => r.passage.structure)).size, 5);
    for (const round of session) {
      assert.equal(round.choices.answer, round.passage.structure);
    }
  }
  // The order is not fixed — this is what stopped him answering by position.
  const orders = new Set(Array.from({ length: 40 }, (_, i) => ids(i + 1).join(",")));
  assert.ok(orders.size >= 10, `only ${orders.size} distinct orders in 40 sessions`);
});

test("a session draws different texts, not just a different order", () => {
  const texts = new Set<string>();
  for (let seed = 1; seed <= 40; seed++) {
    for (const round of structureSession(mulberry32(seed))) texts.add(round.passage.id);
  }
  // Every passage in the pool should be reachable.
  assert.equal(texts.size, STRUCTURE_PASSAGES.length);
});

test("the same seed gives the same session", () => {
  // The page renders on the server and hydrates on the client from one seed.
  const a = structureSession(mulberry32(99)).map((r) => r.passage.id);
  const b = structureSession(mulberry32(99)).map((r) => r.passage.id);
  assert.deepEqual(a, b);
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
