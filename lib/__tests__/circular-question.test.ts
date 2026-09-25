import assert from "node:assert/strict";
import { test } from "node:test";

import { circularReason, hasCausalMarker, shownAnswer } from "@/lib/circular-question";

test("the screenshot question is flagged: a sentence turned into a why", () => {
  const why = circularReason({
    q: "Why do strong stems protect buds from pressure?",
    type: "cause_effect",
    answer: "they keep buds safe",
    source: "Strong stems protect buds from pressure.",
  });
  assert.ok(why);
});

test("the screenshot answer is flagged even with no marked sentence", () => {
  assert.ok(
    circularReason({
      q: "Why do strong stems protect buds from pressure?",
      type: "cause_effect",
      answer: "they keep buds safe",
      source: "",
    })
  );
});

test("an answer made of the question's own words is flagged", () => {
  assert.match(
    circularReason({
      q: "Why do strong stems protect buds?",
      type: "cause_effect",
      answer: "strong stems protect the buds",
      source: "Strong stems protect buds so the flowers can open later.",
    }) ?? "",
    /repeats the question/
  );
});

test("a why whose marked sentence states no reason is flagged", () => {
  assert.match(
    circularReason({
      q: "Why do roots grow deep?",
      type: "cause_effect",
      answer: "to find water",
      source: "Roots grow deep in dry places.",
    }) ?? "",
    /states no reason/
  );
});

test("a real why with a stated reason is not flagged", () => {
  assert.equal(
    circularReason({
      q: "Why do stems stand up tall?",
      type: "cause_effect",
      answer: "so the leaves can reach the sun",
      source: "Stems stand up tall so the leaves can reach the sun.",
    }),
    null
  );
  assert.equal(
    circularReason({
      q: "According to the passage, why does the turtle hide in its shell?",
      type: "detail",
      answer: "to stay safe",
      source: "The turtle hides in its shell to stay safe from foxes.",
    }),
    null
  );
  assert.equal(
    circularReason({
      q: "Why did Omar put on his coat?",
      type: "cause_effect",
      answer: "because it was cold",
      source: "Omar put on his coat because the wind was cold.",
    }),
    null
  );
});

test("literal, vocab, evidence and character questions are not flagged", () => {
  const ok = [
    {
      q: "According to the passage, what do roots take in from the soil?",
      type: "detail",
      answer: "water",
      source: "Roots take in water from the soil.",
    },
    {
      q: 'What does the word "sturdy" mean in this passage?',
      type: "vocab",
      answer: "strong and hard to break",
      source: "The sturdy stem held the heavy flower.",
    },
    {
      q: "Which sentence from the story best shows that Layla is patient?",
      type: "evidence",
      answer: "Layla waited by the ladder and tried again.",
      source: "Layla waited by the ladder and tried again.",
    },
    {
      q: "Why does Layla stay by the ladder?",
      type: "inference",
      answer: "she wants the goat to feel calm",
      source: "Layla sat very still by the ladder.",
    },
    {
      q: "What is this passage mostly about?",
      type: "main_idea",
      answer: "how the parts of a plant help it live",
      source: "",
    },
    {
      q: "Which is bigger, the sun or the moon?",
      type: "detail",
      answer: "the sun",
      source: "The sun is much bigger than the moon.",
    },
  ];
  for (const item of ok) assert.equal(circularReason(item), null, item.q);
});

test("causal markers: reasons count, a place after 'to' does not", () => {
  assert.ok(hasCausalMarker("Bees visit flowers to collect nectar."));
  assert.ok(hasCausalMarker("The pond froze because the night was cold."));
  assert.ok(hasCausalMarker("Thick bark, which helps the tree, keeps out bugs."));
  assert.ok(!hasCausalMarker("Omar walked to the park."));
  assert.ok(!hasCausalMarker("Strong stems protect buds from pressure."));
});

test("shownAnswer is the right option, else the first acceptable", () => {
  assert.equal(shownAnswer({ options: ["a", "b"], answerIndex: 1, acceptable: ["b"] }), "b");
  assert.equal(shownAnswer({ options: [], answerIndex: -1, acceptable: ["x", "y"] }), "x");
});
