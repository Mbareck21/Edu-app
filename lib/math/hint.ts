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

export function mathHint(question: MathQuestion, given: number): string {
  const answer = question.answer;
  const near = answer !== 0 && Math.abs(given - answer) / Math.abs(answer) <= 0.1;
  const size = near
    ? "So close! Check each digit."
    : given > answer
      ? "Too big."
      : "Too small.";
  return `${size} ${BY_OP[question.op]}`;
}
