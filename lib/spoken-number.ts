// The number in what he said out loud.
//
// Speech recognition writes "56", "fifty-six", "fifty six" or, when he says
// the whole fact back, "7 times 8 is 56". The answer is the last number said.
// A few words are the sound of a number misheard as a word ("ate" for 8).
//
// Pure: safe to import from client components.

import { fromWords } from "@/lib/number-words";

const SOUNDS_LIKE: Record<string, string> = {
  ate: "eight",
  for: "four",
  fore: "four",
  to: "two",
  too: "two",
  won: "one",
  tree: "three",
  free: "three",
  sex: "six",
};

const NUMBER_WORD = /^(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred)$/;

/** The last number in a transcript, or null when there is none. */
export function lastNumber(text: string): number | null {
  const tokens = text
    .toLowerCase()
    .replace(/(\d),(\d)/g, "$1$2")
    .replace(/-/g, " ")
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map((t) => SOUNDS_LIKE[t] ?? t);

  // Walk back from the end: a run of number words ("fifty six") or digits.
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (/^\d+$/.test(tokens[i])) return Number(tokens[i]);
    if (NUMBER_WORD.test(tokens[i])) {
      let start = i;
      while (start > 0 && NUMBER_WORD.test(tokens[start - 1])) start--;
      // "seven times eight is fifty six": only the run at the end counts.
      return fromWords(tokens.slice(start, i + 1).join(" "));
    }
  }
  return null;
}

/**
 * What he said, judged against the answer. `alternatives` are the
 * recogniser's guesses, best first; any guess that heard the right number
 * counts, since an accent more often costs the first guess than the answer.
 */
export function judgeSpoken(
  alternatives: readonly string[],
  answer: number
): { heard: number | null; correct: boolean } {
  const numbers = alternatives.map(lastNumber);
  const correct = numbers.includes(answer);
  const heard = correct ? answer : (numbers.find((n) => n !== null) ?? null);
  return { heard, correct };
}
