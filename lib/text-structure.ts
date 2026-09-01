// Text structure unit: the five nonfiction structures his class covers this
// week, the teacher's five take-home passages, and the paragraph frames she
// uses. Pure data plus pure functions — the lesson surface renders it, this
// module never touches React or the DB.
//
// The teacher's five passages are verbatim from her handout: he practices on
// the exact text she sent home, so school and app agree word for word. The
// frame slot labels and signal words follow her worksheet's pattern; the
// layout and prose of that worksheet are not reproduced here.
//
// Those five alone were not enough. The lesson used to walk all five in the
// order they are written here, every single time, so after two runs he could
// answer from position — "the third one is cause and effect" — without
// reading a word. Identifying structure is the whole skill, so the pool now
// holds several passages per structure and a session draws one of each in a
// random order. The extra passages ride his science units so the reading is
// not wasted on filler.

import { shuffle } from "@/lib/math/rng";
import type { Rng } from "@/lib/math/types";

export type TextStructureId =
  | "description"
  | "sequence"
  | "cause-effect"
  | "problem-solution"
  | "compare-contrast";

export const STRUCTURE_IDS: readonly TextStructureId[] = [
  "description",
  "sequence",
  "cause-effect",
  "problem-solution",
  "compare-contrast",
];

export type TextStructure = {
  id: TextStructureId;
  /** What the teacher calls it. */
  name: string;
  /** The one question that identifies this structure. Grade-3 reading level. */
  question: string;
  /** Words a reader hunts for to spot this structure. */
  signalWords: readonly string[];
  /** Slot labels of the paragraph frame, in writing order. */
  frame: readonly string[];
};

const STRUCTURES: Record<TextStructureId, TextStructure> = {
  description: {
    id: "description",
    name: "Description",
    question: "Does it tell lots of facts about one topic?",
    signalWords: ["first", "in addition", "for example", "also", "another"],
    frame: ["Topic Sentence", "First", "In addition", "For example", "Concluding Sentence"],
  },
  sequence: {
    id: "sequence",
    name: "Sequence",
    question: "Does it tell what happens in order, step by step?",
    signalWords: ["first", "next", "then", "after that", "finally"],
    frame: ["Topic Sentence", "First", "Next", "Finally", "Concluding Sentence"],
  },
  "cause-effect": {
    id: "cause-effect",
    name: "Cause and Effect",
    question: "Does it tell why something happens and what it makes happen?",
    signalWords: ["because", "so", "cause", "effect", "as a result", "this is why"],
    frame: ["Topic Sentence", "(cause)", "That is why", "Another effect is", "Concluding Sentence"],
  },
  "problem-solution": {
    id: "problem-solution",
    name: "Problem and Solution",
    question: "Does it tell about a problem and ways to fix it?",
    signalWords: ["problem", "solution", "solve", "fix"],
    frame: [
      "Topic Sentence",
      "The problem is",
      "A solution is",
      "Another solution is",
      "Concluding Sentence",
    ],
  },
  "compare-contrast": {
    id: "compare-contrast",
    name: "Compare and Contrast",
    question: "Does it tell how two things are alike and different?",
    signalWords: ["both", "same", "alike", "different", "unlike", "while", "even though"],
    frame: [
      "Topic Sentence",
      "One way they are the same",
      "They both",
      "One way they are different",
      "Unlike",
      "Concluding Sentence",
    ],
  },
};

export const TEXT_STRUCTURES: readonly TextStructure[] = STRUCTURE_IDS.map(
  (id) => STRUCTURES[id]
);

export function structureById(id: TextStructureId): TextStructure {
  return STRUCTURES[id];
}

export type StructurePassage = {
  id: string;
  title: string;
  /** Verbatim from the teacher's handout. */
  text: string;
  structure: TextStructureId;
  /** Only the signal words that really appear in this text (tests verify). */
  signalWords: readonly string[];
  /**
   * "teacher" marks the five from her handout, which must stay word for word.
   * A test pins their text so a later edit cannot quietly reword his homework.
   */
  source: "teacher" | "app";
};

export const STRUCTURE_PASSAGES: readonly StructurePassage[] = [
  {
    id: "sea-otters",
    source: "teacher",
    title: "Sea Otters",
    structure: "description",
    signalWords: ["first", "in addition", "for example"],
    text: "Sea otters are amazing ocean animals with many interesting features. First, sea otters have thick, fluffy fur that keeps them warm in cold water. In addition, they use rocks as tools to crack open shellfish for food. For example, a sea otter will float on its back and bang a clam against a rock resting on its stomach. These features help sea otters survive well in their ocean home.",
  },
  {
    id: "butterfly-grows",
    source: "teacher",
    title: "How a Butterfly Grows",
    structure: "sequence",
    signalWords: ["first", "next", "after that", "finally"],
    text: "A butterfly changes through four amazing stages before it can fly. First, a butterfly starts out as a tiny egg laid on a leaf. Next, the egg hatches into a caterpillar that eats leaves and grows bigger. After that, the caterpillar forms a hard shell called a chrysalis around itself. Finally, a beautiful butterfly comes out of the chrysalis and flies away. Scientists call this amazing process metamorphosis.",
  },
  {
    id: "wildfires",
    source: "teacher",
    title: "Wildfires",
    structure: "cause-effect",
    signalWords: ["cause", "because", "as a result", "effect", "this is why"],
    text: "Dry weather can cause dangerous wildfires to start and spread quickly. Because there is very little rain for a long time, plants and trees become extremely dry. As a result, dry plants can catch fire easily from just one spark. Another effect is that wildfires can destroy homes, forests, and animal habitats. This is why firefighters work so hard to stop wildfires quickly.",
  },
  {
    id: "ocean-plastic",
    source: "teacher",
    title: "Ocean Plastic Pollution",
    structure: "problem-solution",
    signalWords: ["problem", "solution"],
    text: "Plastic trash in the ocean is a big problem for sea animals. The problem is that turtles and fish sometimes eat small pieces of plastic by mistake. A solution is to use reusable bags and water bottles instead of plastic ones. Another solution is to pick up litter at the beach before it can wash into the water. Everyone can help keep the ocean clean and safe for animals.",
  },
  {
    id: "frogs-toads",
    source: "teacher",
    title: "Frogs and Toads",
    structure: "compare-contrast",
    signalWords: [
      "one way they are the same",
      "they both",
      "one way they are different",
      "while",
      "unlike",
      "even though",
    ],
    text: "Frogs and toads look similar, but they have some important differences. One way they are the same is that both are amphibians that hatch from eggs laid in water. They both eat insects and other small bugs. One way they are different is that frogs have smooth, wet skin, while toads have dry, bumpy skin. Unlike frogs, toads spend most of their time on land instead of in water. Even though they look alike, frogs and toads live very different kinds of lives.",
  },
  // ── Extra passages, written for this app ────────────────────────────────
  // Same five structures, different texts, so the answer cannot be memorised
  // from where a passage sits. Topics ride his science units.
  {
    id: "cactus-plants",
    source: "app",
    title: "Cactus Plants",
    structure: "description",
    signalWords: ["first", "in addition", "another", "for example"],
    text: "A cactus is a plant built to live where there is almost no rain. First, a cactus has a thick stem that stores water for many months. In addition, its sharp spines keep hungry animals from biting into it. Another feature is its shallow roots, which spread wide to catch every drop. For example, a saguaro cactus can soak up water from a light shower in minutes. Every part of a cactus helps it live in the dry desert.",
  },
  {
    id: "owls-hunt",
    source: "app",
    title: "How Owls Hunt",
    structure: "description",
    signalWords: ["first", "also", "in addition", "for example"],
    text: "Owls have special body parts that make them great night hunters. First, an owl has huge eyes that let it see in almost no light. Its ears are also placed unevenly on its head, which helps it work out exactly where a sound came from. In addition, the soft edges of an owl's feathers make its wings nearly silent. For example, a mouse often hears nothing at all until the owl is already above it.",
  },
  {
    id: "water-cycle",
    source: "app",
    title: "How Rain Falls",
    structure: "sequence",
    signalWords: ["first", "next", "then", "finally"],
    text: "Water travels in a circle that never really stops. First, the sun heats water in lakes, rivers and the sea until it turns into water vapor. Next, the water vapor rises high into the cool air and gathers into clouds. Then the tiny drops inside the cloud bump together and grow heavier. Finally, the drops fall back to the ground as rain, and the journey starts again. Scientists call this circle the water cycle.",
  },
  {
    id: "planting-seed",
    source: "app",
    title: "Planting a Seed",
    structure: "sequence",
    signalWords: ["first", "next", "after that", "last"],
    text: "Growing a bean plant takes a few careful steps. First, fill a small pot with soft, damp soil. Next, push one bean seed about as deep as your finger and cover it over. After that, put the pot on a sunny windowsill and give it a little water each day. Last, watch for a green shoot to push up through the soil after about a week. With sun and water, that shoot will grow into a whole plant.",
  },
  {
    id: "leaves-change",
    source: "app",
    title: "Why Leaves Change",
    structure: "cause-effect",
    signalWords: ["because", "as a result", "effect", "this is why"],
    text: "Leaves change color in the fall because the days grow shorter and colder. Trees stop making the green food color called chlorophyll when there is less sunlight. As a result, yellow and orange colors that were hiding all summer finally show. Another effect is that the leaf dries out and falls to the ground. This is why bare branches in winter are a normal, healthy sign and not a sick one.",
  },
  {
    id: "shaking-ground",
    source: "app",
    title: "Shaking Ground",
    structure: "cause-effect",
    signalWords: ["cause", "because", "as a result", "so"],
    text: "Huge slabs of rock under our feet can cause the ground to shake. Because these slabs press against each other for years, pressure builds up along their edges. When the rock finally slips, the stored energy races outward as waves. As a result, buildings above can sway, crack or even fall down. The waves lose strength as they travel, so towns far away feel only a gentle rocking.",
  },
  {
    id: "noisy-classroom",
    source: "app",
    title: "The Noisy Classroom",
    structure: "problem-solution",
    signalWords: ["problem", "solution", "solve"],
    text: "Reading is hard in a classroom that is full of noise. The problem is that voices from the hallway carry straight through an open door. One solution is a soft rug and cloth curtains, which soak up sound instead of bouncing it back. Another solution is a quiet corner with headphones for anyone who needs one. Small changes like these solve most of the noise without costing very much.",
  },
  {
    id: "saving-water",
    source: "app",
    title: "Saving Water",
    structure: "problem-solution",
    signalWords: ["problem", "one way to fix", "solution"],
    text: "Many towns run short of clean water in a long, dry summer. The problem is that people use the most water at exactly the time there is least of it. One way to fix this is to water gardens early in the morning, before the sun dries the soil. Another solution is to catch rain from the roof in a barrel and use it later. Saving a little water every day adds up to a great deal by the end of summer.",
  },
  {
    id: "camels-horses",
    source: "app",
    title: "Camels and Horses",
    structure: "compare-contrast",
    signalWords: ["they both", "one way they are different", "while", "unlike", "even though"],
    text: "Camels and horses are large animals that people have ridden for hundreds of years. They both have long legs, eat plants and can carry heavy loads for miles. One way they are different is that a camel stores fat in its hump, while a horse has no hump at all. Unlike a horse, a camel can go for days without drinking. Even though both are strong, each one suits a very different kind of country.",
  },
  {
    id: "rivers-lakes",
    source: "app",
    title: "Rivers and Lakes",
    structure: "compare-contrast",
    signalWords: ["one way they are the same", "they both", "one way they are different", "unlike"],
    text: "Rivers and lakes are both bodies of fresh water, but they behave in different ways. One way they are the same is that they both give homes to fish, birds and water plants. They both also collect the rain that falls on the land around them. One way they are different is that a river always flows downhill toward the sea. Unlike a river, a lake sits still in a low dip in the ground.",
  },
];

// ── "What structure is this?" choices ─────────────────────────────────────

export type StructureChoices = {
  /** The right structure plus distractors, in shuffled order. */
  options: TextStructure[];
  answer: TextStructureId;
};

/**
 * Multiple-choice options for one passage. Every wrong option is another real
 * structure from the unit — with only five structures, all of them are
 * plausible distractors. Same passage + same seed = same options, so the
 * runner and the server agree.
 */
export function structureChoices(
  passage: StructurePassage,
  rng: Rng,
  count = 4
): StructureChoices {
  const size = Math.max(2, Math.min(TEXT_STRUCTURES.length, Math.round(count)));
  const right = structureById(passage.structure);
  const others = TEXT_STRUCTURES.filter((s) => s.id !== passage.structure);
  const distractors = shuffle(rng, others).slice(0, size - 1);
  return {
    options: shuffle(rng, [right, ...distractors]),
    answer: right.id,
  };
}

// ── One session's worth of passages ───────────────────────────────────────

export type StructureRound = {
  passage: StructurePassage;
  choices: StructureChoices;
};

/** Every passage written for one structure. */
export function passagesFor(id: TextStructureId): StructurePassage[] {
  return STRUCTURE_PASSAGES.filter((p) => p.structure === id);
}

/**
 * One round per structure, each drawn from that structure's own passages, in
 * a shuffled order.
 *
 * The order matters as much as the draw. The lesson used to run the five
 * passages in the order they are declared, so the position of a passage was a
 * reliable tell — he could answer "cause and effect" third without reading.
 * Shuffling the order removes the tell; drawing from a pool of three means the
 * text is new about two visits in three as well.
 *
 * The extra round matters as much. With exactly one round per structure he can
 * answer the last one by elimination without reading it — the same shortcut in
 * a different disguise. A sixth round repeats one structure, so counting what
 * is left over no longer settles anything.
 */
export const STRUCTURE_ROUNDS = STRUCTURE_IDS.length + 1;

export function structureSession(rng: Rng, choiceCount = 4): StructureRound[] {
  const pick = (pool: readonly StructurePassage[]): StructurePassage =>
    pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))];

  // Every structure gets practised...
  const chosen = STRUCTURE_IDS.map((id) => pick(passagesFor(id)));
  // ...and one gets a second turn, on a different text where there is one.
  const encore = STRUCTURE_IDS[Math.min(STRUCTURE_IDS.length - 1, Math.floor(rng() * STRUCTURE_IDS.length))];
  const taken = new Set(chosen.map((p) => p.id));
  const spare = passagesFor(encore).filter((p) => !taken.has(p.id));
  chosen.push(pick(spare.length > 0 ? spare : passagesFor(encore)));

  const rounds = chosen.map((passage) => ({
    passage,
    choices: structureChoices(passage, rng, choiceCount),
  }));
  return shuffle(rng, rounds);
}

// ── Signal word highlighting ──────────────────────────────────────────────

export type SignalMatch = {
  /** The signal word as listed, lowercase. */
  word: string;
  /** Position of the match in the text. */
  index: number;
  /** Length of the matched text, so the UI can slice it out. */
  length: number;
};

/** matchAll needs every regex-special character in a phrase escaped first. */
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Every place a signal word shows up in a text, for highlighting. Matches are
 * case-insensitive and stop at word boundaries: "cause" does not light up
 * inside "because", but "First," with its comma is still found.
 */
export function findSignalWords(
  text: string,
  signalWords: readonly string[]
): SignalMatch[] {
  const matches: SignalMatch[] = [];
  for (const word of signalWords) {
    const pattern = new RegExp(`\\b${escapeRegExp(word)}\\b`, "gi");
    for (const hit of text.matchAll(pattern)) {
      if (hit.index !== undefined) {
        matches.push({ word: word.toLowerCase(), index: hit.index, length: hit[0].length });
      }
    }
  }
  return matches.sort((a, b) => a.index - b.index);
}
