// Word packs the app seeds as practice lists. Pure data — no React, no Mongo.
//
// Pack 1 comes straight from a graded worksheet: asked to write numbers in
// word form he scored roughly 0/20 while getting 12/12 in standard form the
// same day. The misses were consistent — "fefty", "therte", "sexte", "ghate",
// "ninel" — so the gap is spelling, not the numbers. The trap letters are the
// "-ty" suffix, the "th" digraph, and "eigh", and the clues call them out.
//
// Packs 2 and 3 are the vocabulary of this week's instructions ("write
// multi-digit numbers in unit, standard, word and expanded form"; "simple,
// compound, and complex sentences") — he cannot follow a direction whose
// words he does not know.
//
// Pack 4 pulls the mathematical terms out of the lesson and skill names he
// meets on screen (MATH_SKILLS in lib/math/skills.ts, IREADY_LESSONS in
// lib/math/iready.ts) — he can do the arithmetic without knowing what a
// title like "Find Perimeter and Area" is asking for. Terms that already
// live in the math-vocabulary pack stay there and are not repeated here.
//
// A clue is the text shown when he is asked "which word means this?", so it
// must define the word without containing it, in one Grade-3 sentence.
// Every word has to pass the app's /^[a-zA-Z][a-zA-Z\s-]*$/ validation:
// letters, spaces, and hyphens only.

export type PackWord = {
  word: string;
  clue: string;
};

export type WordPack = {
  /** Stable id — seeds key off it, so never rename. */
  id: string;
  /** Shown on the Words tab. */
  name: string;
  /** One line under the name. */
  blurb: string;
  words: readonly PackWord[];
};

export const WORD_PACKS: readonly WordPack[] = [
  {
    id: "number-words",
    name: "Number Words",
    blurb: "Spell the numbers you write in word form.",
    words: [
      { word: "eleven", clue: "The number right after ten, spelled with just one L." },
      { word: "twelve", clue: "The number right after eleven." },
      { word: "thirteen", clue: "Ten plus three, and it starts with t-h-i-r, like third." },
      { word: "fourteen", clue: "Ten plus four." },
      { word: "fifteen", clue: "Ten plus five, and the five turns into fif." },
      { word: "sixteen", clue: "Ten plus six." },
      { word: "seventeen", clue: "Ten plus seven." },
      { word: "eighteen", clue: "Ten plus eight, and it starts with e-i-g-h, like eight." },
      { word: "nineteen", clue: "Ten plus nine." },
      { word: "twenty", clue: "Two tens, the number right after nineteen." },
      { word: "thirty", clue: "Three tens, and it starts with t-h-i-r, not with three." },
      { word: "forty", clue: "Four tens, and careful: there is no u even though four has one." },
      { word: "fifty", clue: "Five tens, and the five turns into fif, so it is not five plus ty." },
      { word: "sixty", clue: "Six tens, spelled with an i just like six." },
      { word: "seventy", clue: "Seven tens, the number after sixty-nine." },
      { word: "eighty", clue: "Eight tens, and it starts with e-i-g-h just like eight." },
      { word: "ninety", clue: "Nine tens, and it keeps the e of nine, so it is nine plus ty." },
      { word: "hundred", clue: "The number you get from ten tens." },
      { word: "thousand", clue: "The number you get from ten hundreds." },
      { word: "twenty-one", clue: "Two tens and one more, joined with a hyphen." },
      { word: "fifty-five", clue: "Five tens and five ones, joined with a hyphen." },
      { word: "eighty-one", clue: "Eight tens and one more, joined with a hyphen." },
    ],
  },
  {
    id: "math-vocabulary",
    name: "Math Words",
    blurb: "The words your teacher uses for place value and number forms.",
    words: [
      { word: "digit", clue: "One single number symbol, from zero up to nine." },
      { word: "place value", clue: "How much a spot in a number is worth, like ones, tens, or hundreds." },
      { word: "standard form", clue: "The plain way to write a number, using only its digits." },
      { word: "word form", clue: "Writing a number with letters, the way you say it out loud." },
      { word: "expanded form", clue: "Writing a number as a sum that shows what each digit is worth, like three hundred plus forty plus two." },
      { word: "unit form", clue: "Writing a number by naming each place, like three hundreds four tens two ones." },
      { word: "period", clue: "A group of three places in a big number, like the thousands group." },
      { word: "value", clue: "How much a digit is worth because of where it sits in the number." },
      { word: "compare", clue: "To look at two numbers and decide which one is bigger, smaller, or the same." },
      { word: "round", clue: "To change a number to the nearest ten, hundred, or other easy number." },
      { word: "greater than", clue: "The words we use when the first number is bigger than the second one." },
      { word: "less than", clue: "The words we use when the first number is smaller than the second one." },
      { word: "equal", clue: "Exactly the same amount as something else." },
    ],
  },
  {
    id: "math-lesson-words",
    name: "Lesson Words",
    blurb: "The math words hiding inside your lesson and skill names.",
    words: [
      { word: "rounding", clue: "Changing a number to the nearest ten or hundred, like turning forty-eight into fifty." },
      { word: "sum", clue: "The answer you get when you add, like six plus four makes ten." },
      { word: "difference", clue: "The answer you get when you subtract, like nine take away four leaves five." },
      { word: "product", clue: "The answer you get when you multiply, like six times four makes twenty-four." },
      { word: "quotient", clue: "The answer you get when you divide, like twelve split into three groups makes four." },
      { word: "remainder", clue: "The amount left over after dividing, like seven shared by two leaves one extra." },
      { word: "factor", clue: "A number that divides another number evenly, like three and four both go into twelve." },
      { word: "multiple", clue: "A number you say when you skip count, like five, ten, and fifteen." },
      { word: "estimate", clue: "A careful guess that is close to the exact answer, made by rounding first." },
      { word: "pattern", clue: "A rule that repeats, like the numbers two, four, six, eight." },
      { word: "perimeter", clue: "The distance all the way around the outside of a shape." },
      { word: "area", clue: "The amount of flat space a shape covers, counted in squares." },
      { word: "equivalent", clue: "Showing the same amount in a different way, like one half and two fourths." },
      { word: "fraction", clue: "A number that names part of a whole, like one half or three fourths." },
      { word: "numerator", clue: "The top number in a fraction, counting how many parts you have." },
      { word: "denominator", clue: "The bottom number in a fraction, telling how many equal parts make the whole." },
      { word: "mixed number", clue: "A whole amount and a fraction together, like two and one half." },
      { word: "decimal", clue: "A number with a dot in it that shows part of a whole, like zero point five." },
      { word: "angle", clue: "The opening made where two lines or rays meet at a point." },
      { word: "degree", clue: "The tiny unit used to measure how wide an angle opens." },
      { word: "symmetry", clue: "When one half of a shape is a mirror image of the other half." },
      { word: "polygon", clue: "A closed flat shape with straight sides, like a triangle or a square." },
      { word: "quadrilateral", clue: "Any flat shape with exactly four straight sides, like a square or a trapezoid." },
      { word: "parallel", clue: "Lines that run side by side and never cross, like train tracks." },
      { word: "perpendicular", clue: "Lines that cross each other to make a perfect square corner." },
      { word: "line plot", clue: "A chart that stacks marks above a number line to show how often things happen." },
    ],
  },
  {
    id: "sentence-types",
    name: "Sentence Words",
    blurb: "The words for building simple, compound, and complex sentences.",
    words: [
      { word: "subject", clue: "The naming part of a sentence, the who or what it is about." },
      { word: "predicate", clue: "The action part of a sentence, what the subject is or does." },
      { word: "simple sentence", clue: "One complete thought with a subject and a verb." },
      { word: "compound sentence", clue: "Two complete thoughts joined by a word such as and, but, or so." },
      { word: "complex sentence", clue: "A complete thought joined to a part that cannot stand alone, often starting with because or when." },
      { word: "conjunction", clue: "A joining word such as and, but, or because." },
      { word: "clause", clue: "A group of words that has its own subject and verb." },
      { word: "fragment", clue: "A piece of a sentence that is missing something and cannot stand on its own." },
      { word: "run-on", clue: "Two complete thoughts squished together without a joining word or the right end mark." },
    ],
  },
];

export function packById(id: string): WordPack | undefined {
  return WORD_PACKS.find((p) => p.id === id);
}
