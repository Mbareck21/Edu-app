// A hint after a first wrong answer, before the answer is given away.
//
// Showing the answer on the first miss told him what, not how, and left
// nothing for him to work out. Now the first miss gets a nudge (too big or
// too small, and the kind of thinking the question needs) and a second try.
// Only a second miss shows the answer and the steps. The score still counts
// the first try only, so a hint never buys points.
//
// Pure: safe to import from client components.

import type { MathQuestion } from "@/lib/math/types";

const BY_OP: Record<MathQuestion["op"], string> = {
  "+": "Put the amounts together.",
  "-": "Take the smaller amount away, or find the difference.",
  "×": "Think of equal groups: how many groups, and how many in each?",
  "÷": "Share into equal groups. Which number times the one you know makes it?",
  "?": "Read it again slowly, and use the picture.",
};

/**
 * Divisions with something left over. No number times the one he knows makes
 * the total, so the plain ÷ hint sent him looking for one that is not there.
 */
const LEFT_OVER: readonly (readonly [RegExp, string])[] = [
  [/left over\?$/, "Make as many equal groups as you can. What is left is smaller than the number you divide by."],
  [/boxes are needed\?$/, "Fill as many boxes as you can. Do the ones left over need a box too?"],
  [/full boxes\?$/, "Fill as many boxes as you can. The ones left over do not fill a box."],
  [/whole groups\?$/, "Make as many equal groups as you can. Some will be left over."],
];

export function mathHint(question: MathQuestion, given: number): string {
  const answer = question.answer;
  const near = answer !== 0 && Math.abs(given - answer) / Math.abs(answer) <= 0.1;
  const size = near
    ? "So close! Check each digit."
    : given > answer
      ? "Too big."
      : "Too small.";
  const leftOver = question.op === "÷" ? LEFT_OVER.find(([re]) => re.test(question.prompt)) : undefined;
  // "Use the picture" sent him looking for one on a question that has none.
  const how = leftOver
    ? leftOver[1]
    : question.op === "?" && question.visual.kind === "none"
      ? "Read it again slowly, one part at a time."
      : BY_OP[question.op];
  return `${size} ${how}`;
}
