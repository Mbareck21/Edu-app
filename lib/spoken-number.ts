// The number in what he said out loud.
//
// Speech recognition writes "56", "fifty-six", "fifty six" or, when he says
// the whole fact back, "7 times 8 is 56". The answer is the last number said.
// A few words are the sound of a number misheard as a word ("ate" for 8).
//
// Pure: safe to import from client components.

import { fromWords } from "@/lib/number-words";

/**
 * Words the recogniser writes when a child says a small number, above all a
 * young English learner saying it quickly. One word on its own gives the
 * recogniser nothing to go on, so "four" comes back as "for", "far" or "floor".
 */
const SOUNDS_LIKE: Record<string, string> = {
  won: "one", wan: "one",
  to: "two", too: "two", tu: "two", tube: "two",
  tree: "three", free: "three", through: "three", thee: "three",
  for: "four", fore: "four", far: "four", fall: "four", floor: "four", ford: "four", foe: "four", forth: "four", fourth: "four", full: "four", pour: "four", poor: "four",
  fife: "five", fine: "five", hive: "five",
  sex: "six", sick: "six", sics: "six", sicks: "six", sikh: "six", seeks: "six",
  heaven: "seven",
  ate: "eight", eat: "eight", hate: "eight", aid: "eight", eighth: "eight",
  nein: "nine", night: "nine", mine: "nine", nigh: "nine",
  tan: "ten", tin: "ten", then: "ten", den: "ten",
};

const NUMBER_WORD = /^(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred)$/;

const isNumberToken = (t: string) => /^\d+$/.test(t) || NUMBER_WORD.test(t);

/** The number a run of tokens ends with, reading back from the end. */
function numberAtEnd(tokens: string[]): number | null {
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
 * The answer in a transcript, or null when there is none.
 *
 * When the fact itself is in there ("two times two is four", or the app's own
 * voice caught at the end of "two times two"), only what comes after the
 * second number counts. Otherwise that echo read as the answer 2.
 */
export function lastNumber(text: string): number | null {
  const tokens = text
    .toLowerCase()
    .replace(/(\d),(\d)/g, "$1$2")
    .replace(/(\d)\s*[x×*]\s*(\d)/g, "$1 times $2")
    .replace(/-/g, " ")
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map((t) => SOUNDS_LIKE[t] ?? t);

  const times = tokens.lastIndexOf("times");
  if (times >= 0) {
    // Skip the fact's second number (always one word or digit: 2 to 10).
    let i = times + 1;
    while (i < tokens.length && !isNumberToken(tokens[i])) i++;
    return numberAtEnd(tokens.slice(i + 1));
  }
  return numberAtEnd(tokens);
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
