// Text structure unit: the five nonfiction structures his class covers this
// week, the teacher's five take-home passages, and the paragraph frames she
// uses. Pure data plus pure functions — the lesson surface renders it, this
// module never touches React or the DB.
//
// The passages are verbatim from the teacher's handout: he practices on the
// exact text she sent home, so school and app agree word for word. The frame
// slot labels and signal words follow her worksheet's pattern; the layout and
// prose of that worksheet are not reproduced here.

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
};

export const STRUCTURE_PASSAGES: readonly StructurePassage[] = [
  {
    id: "sea-otters",
    title: "Sea Otters",
    structure: "description",
    signalWords: ["first", "in addition", "for example"],
    text: "Sea otters are amazing ocean animals with many interesting features. First, sea otters have thick, fluffy fur that keeps them warm in cold water. In addition, they use rocks as tools to crack open shellfish for food. For example, a sea otter will float on its back and bang a clam against a rock resting on its stomach. These features help sea otters survive well in their ocean home.",
  },
  {
    id: "butterfly-grows",
    title: "How a Butterfly Grows",
    structure: "sequence",
    signalWords: ["first", "next", "after that", "finally"],
    text: "A butterfly changes through four amazing stages before it can fly. First, a butterfly starts out as a tiny egg laid on a leaf. Next, the egg hatches into a caterpillar that eats leaves and grows bigger. After that, the caterpillar forms a hard shell called a chrysalis around itself. Finally, a beautiful butterfly comes out of the chrysalis and flies away. Scientists call this amazing process metamorphosis.",
  },
  {
    id: "wildfires",
    title: "Wildfires",
    structure: "cause-effect",
    signalWords: ["cause", "because", "as a result", "effect", "this is why"],
    text: "Dry weather can cause dangerous wildfires to start and spread quickly. Because there is very little rain for a long time, plants and trees become extremely dry. As a result, dry plants can catch fire easily from just one spark. Another effect is that wildfires can destroy homes, forests, and animal habitats. This is why firefighters work so hard to stop wildfires quickly.",
  },
  {
    id: "ocean-plastic",
    title: "Ocean Plastic Pollution",
    structure: "problem-solution",
    signalWords: ["problem", "solution"],
    text: "Plastic trash in the ocean is a big problem for sea animals. The problem is that turtles and fish sometimes eat small pieces of plastic by mistake. A solution is to use reusable bags and water bottles instead of plastic ones. Another solution is to pick up litter at the beach before it can wash into the water. Everyone can help keep the ocean clean and safe for animals.",
  },
  {
    id: "frogs-toads",
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
