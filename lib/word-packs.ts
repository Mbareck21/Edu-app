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
  /** Set on packs for a later grade: they only lead the list once he is in it. */
  grade?: 5;
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
    // From the Growing Plants investigation his class is running: the seven
    // terms the worksheet lists, plus the words it asks him to DO — form a
    // hypothesis, collect data, draw conclusions. Definitions are written
    // here at his reading level rather than copied from the worksheet.
    id: "growing-plants",
    name: "Growing Plants",
    blurb: "Science words for the plant experiment.",
    words: [
      { word: "seed", clue: "A small hard case with a tiny baby plant asleep inside it." },
      { word: "soil", clue: "The top layer of the ground: tiny bits of rock mixed with rotted plants." },
      { word: "compost", clue: "Rotted food scraps and leaves, mixed into soil to feed plants." },
      { word: "fertilizer", clue: "Plant food you add to soil so a plant grows better." },
      { word: "nutrients", clue: "The parts of food or soil that a living thing needs to grow." },
      { word: "mass", clue: "How much matter is in something. Take it to the moon and this stays the same, but its weight changes." },
      { word: "variable", clue: "The one thing you change in a test to see what happens." },
      { word: "fair test", clue: "A test where you change only one thing, so you know what caused the change." },
      { word: "hypothesis", clue: "Your best guess about what will happen, made before you test it." },
      { word: "experiment", clue: "A test you set up on purpose to answer a question." },
      { word: "data", clue: "The numbers and notes you write down while you watch what happens." },
      { word: "observe", clue: "To watch carefully and notice what changes." },
      { word: "conclusion", clue: "What you decide the data shows, once the test is done." },
      { word: "sprout", clue: "When a seed pushes its first tiny green shoot up out of the soil." },
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
    id: "math-operation-words",
    name: "Operation Words",
    blurb: "The words that tell you which operation a problem wants.",
    words: [
      { word: "addend", clue: "One of the numbers being added together, like the three and the four in three plus four." },
      { word: "dividend", clue: "The number being split up in a division, like the twelve in twelve divided by three." },
      { word: "divisor", clue: "The number you divide by, like the three in twelve divided by three." },
      { word: "equation", clue: "A number sentence with an equals sign that says two sides are the same." },
      { word: "expression", clue: "Numbers and signs put together without an equals sign, like six plus two." },
      { word: "operation", clue: "Something you do to numbers: add, subtract, multiply, or divide." },
      { word: "array", clue: "Objects arranged in equal rows and columns, like eggs in a carton." },
      { word: "even", clue: "A whole number you can split into two equal groups, like four or ten." },
      { word: "odd", clue: "A whole number that leaves one out when split in two, like seven or nine." },
      { word: "prime", clue: "A number bigger than one that only two and itself go into evenly, like seven." },
      { word: "composite", clue: "A number with more than two numbers that go into it evenly, like twelve." },
      { word: "inverse", clue: "The opposite that undoes something, like subtracting undoes adding." },
      { word: "regroup", clue: "To trade ten of one place for one of the next, like ten ones for one ten." },
      { word: "total", clue: "The whole amount after everything is put together." },
      { word: "altogether", clue: "A word in a problem that means everything counted as one big amount." },
      { word: "fewer", clue: "A smaller number of things, like three apples instead of five." },
      { word: "twice", clue: "Two times as many, like four is this compared to two." },
      { word: "double", clue: "To make an amount two times bigger, like turning six into twelve." },
      { word: "half", clue: "One of two equal parts, like five out of ten." },
      { word: "per", clue: "For each one, like the cost for each ticket or the miles in each hour." },
      { word: "dozen", clue: "A group of twelve, like a box of eggs." },
      { word: "unknown", clue: "The missing number in a problem, often shown with a box or a letter." },
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
  // Grade 5 packs: the academic words of the Arkansas / Common Core Grade 5
  // standards (5-PS1, 5-LS2, 5-ESS1, 5-ESS2, 5.NBT, 5.NF, 5.MD, 5.G and the
  // RL/RI reading standards). Offered alongside the Grade 4 packs rather than
  // gated on the calendar: the parent picks what to seed, and a word he meets
  // early is no harm. No word here repeats one from a Grade 4 pack.
  {
    id: "g5-matter",
    grade: 5,
    name: "Grade 5 Matter",
    blurb: "Science words for what everything is made of.",
    words: [
      { word: "matter", clue: "Anything that takes up space and has mass, like air, water, or a rock." },
      { word: "particle", clue: "A piece of something so tiny you cannot see it, even with a magnifying glass." },
      { word: "atom", clue: "One of the tiny building blocks that all things are made of." },
      { word: "solid", clue: "Stuff that keeps its own shape, like ice or a wooden block." },
      { word: "liquid", clue: "Stuff that flows and takes the shape of its cup, like water or juice." },
      { word: "gas", clue: "Stuff that spreads out to fill any space, like the air in a balloon." },
      { word: "property", clue: "Something you can notice about a material, like its color, hardness, or smell." },
      { word: "mixture", clue: "Two or more things put together that you can still pull apart, like trail mix." },
      { word: "dissolve", clue: "When something mixes into a liquid so well it seems to disappear, like sugar in tea." },
      { word: "substance", clue: "One kind of material with its own properties, like salt or pure water." },
      { word: "chemical reaction", clue: "When things mix and make a brand new material, like baking soda and vinegar making bubbles." },
      { word: "conservation of matter", clue: "The rule that the weight stays the same when things mix, melt, or change." },
      { word: "melting", clue: "Changing from a solid to a liquid when it gets warm, like ice turning to water." },
      { word: "freezing", clue: "Changing from a liquid to a solid when it gets very cold." },
      { word: "boiling", clue: "When a liquid gets so hot it bubbles and turns into a gas." },
      { word: "magnetic", clue: "Pulled toward a magnet, like a paper clip or a steel nail." },
      { word: "conductor", clue: "A material that lets heat or electricity pass through it easily, like copper." },
      { word: "insulator", clue: "A material that blocks heat or electricity, like rubber, plastic, or wool." },
    ],
  },
  {
    id: "g5-ecosystems",
    grade: 5,
    name: "Grade 5 Ecosystems",
    blurb: "Science words for how food and energy move through living things.",
    words: [
      { word: "ecosystem", clue: "All the living and nonliving things in one place, working together." },
      { word: "organism", clue: "Any living thing, like a plant, an animal, or a tiny germ." },
      { word: "producer", clue: "A living thing, like a plant, that makes its own food from sunlight." },
      { word: "consumer", clue: "A living thing that gets its food by eating plants or animals." },
      { word: "decomposer", clue: "A living thing, like a mushroom or a worm, that breaks down dead plants and animals." },
      { word: "food chain", clue: "A path that shows who eats whom, one step at a time." },
      { word: "food web", clue: "Many eating paths in one place, crossing and joined together like a net." },
      { word: "predator", clue: "An animal that hunts other animals for food, like a hawk." },
      { word: "prey", clue: "An animal that is hunted and eaten by another animal, like a mouse." },
      { word: "herbivore", clue: "An animal that eats only plants, like a cow or a rabbit." },
      { word: "carnivore", clue: "An animal that eats only meat, like a lion or a shark." },
      { word: "omnivore", clue: "An animal that eats both plants and meat, like a bear or a person." },
      { word: "scavenger", clue: "An animal that eats things that are already dead, like a vulture." },
      { word: "photosynthesis", clue: "How a green plant uses sunlight, water, and air to make its own food." },
      { word: "oxygen", clue: "The gas in the air that people and animals need to breathe." },
      { word: "carbon dioxide", clue: "The gas animals breathe out and plants take in to make food." },
      { word: "population", clue: "All the animals or plants of one kind living in the same place." },
      { word: "microorganism", clue: "A living thing so small you need a microscope to see it, like bacteria." },
    ],
  },
  {
    id: "g5-earth-systems",
    grade: 5,
    name: "Grade 5 Earth Systems",
    blurb: "Science words for land, water, air, and life on Earth.",
    words: [
      { word: "geosphere", clue: "The rock and soil part of Earth, from the ground under you to deep inside." },
      { word: "hydrosphere", clue: "All the water on Earth: oceans, rivers, lakes, ice, and clouds." },
      { word: "atmosphere", clue: "The blanket of air all around Earth." },
      { word: "biosphere", clue: "Every living thing on Earth, all together as one part of the planet." },
      { word: "water cycle", clue: "The trip water takes over and over, from the ground up to the clouds and back down." },
      { word: "evaporation", clue: "When water warms up and turns into a gas that rises into the air." },
      { word: "condensation", clue: "When water in the air cools and turns into drops, like on a cold glass." },
      { word: "precipitation", clue: "Water falling from clouds as rain, snow, sleet, or hail." },
      { word: "groundwater", clue: "Water that soaks into the soil and is stored under the land." },
      { word: "freshwater", clue: "Water that is not salty, like in most rivers and lakes." },
      { word: "runoff", clue: "Rain or melted snow that flows over the land into streams instead of soaking in." },
      { word: "reservoir", clue: "A lake, often made by people, that stores water for a town to use." },
      { word: "climate", clue: "The usual weather a place has over many years." },
      { word: "weather", clue: "What the air outside is like today: hot or cold, rainy or sunny, windy or calm." },
      { word: "pollution", clue: "Trash, smoke, or chemicals that make the air, land, or water dirty." },
      { word: "conserve", clue: "To use something carefully so it lasts, like turning off the tap." },
    ],
  },
  {
    id: "g5-space",
    grade: 5,
    name: "Grade 5 Space",
    blurb: "Science words for the sun, the stars, and gravity.",
    words: [
      { word: "gravity", clue: "The pull that makes things fall down to the ground and keeps the moon near Earth." },
      { word: "orbit", clue: "The curved path one thing takes around another in space, like Earth going around the sun." },
      { word: "axis", clue: "The pretend line through the middle of Earth that it spins around." },
      { word: "rotation", clue: "One full spin of Earth, which takes one day and gives us day and night." },
      { word: "revolution", clue: "One full trip of Earth around the sun, which takes one year." },
      { word: "star", clue: "A giant ball of hot, glowing gas far out in space, like the sun." },
      { word: "planet", clue: "A big round object that travels around the sun, like Earth or Mars." },
      { word: "solar system", clue: "The sun and everything that circles it: planets, moons, and rocks." },
      { word: "galaxy", clue: "A huge group of billions of stars, like our Milky Way." },
      { word: "universe", clue: "Everything that exists: all of space and everything in it." },
      { word: "constellation", clue: "A group of stars that seems to make a picture in the night sky." },
      { word: "telescope", clue: "A tool with lenses or mirrors that makes faraway things in the sky look closer." },
      { word: "shadow", clue: "The dark shape made when something blocks the light." },
      { word: "horizon", clue: "The line far away where the land or sea seems to meet the sky." },
      { word: "season", clue: "One of the four parts of the year: spring, summer, fall, or winter." },
      { word: "brightness", clue: "How strong a light looks to your eyes, like a near star looking stronger than a far one." },
    ],
  },
  {
    id: "g5-math-words",
    grade: 5,
    name: "Grade 5 Math Words",
    blurb: "Math words for volume, the coordinate plane, and decimals.",
    words: [
      { word: "volume", clue: "How much space a solid shape takes up, counted in little cubes." },
      { word: "cubic unit", clue: "A cube one unit long on every side, used to measure space inside a box." },
      { word: "rectangular prism", clue: "A box shape with six flat faces that are all rectangles." },
      { word: "base", clue: "The bottom face of a solid shape, which you multiply by the height." },
      { word: "numerical expression", clue: "Numbers and signs grouped together with no equals sign, like three times four plus two." },
      { word: "coordinate plane", clue: "A flat grid made by two number lines that cross, used to find points." },
      { word: "ordered pair", clue: "Two numbers in parentheses, like three comma five, that tell where a point is." },
      { word: "origin", clue: "The point where the two number lines on a grid cross, at zero and zero." },
      { word: "x-axis", clue: "The number line that goes side to side across the bottom of a grid." },
      { word: "y-axis", clue: "The number line that goes straight up and down on a grid." },
      { word: "tenths", clue: "The first place to the right of the decimal point." },
      { word: "hundredths", clue: "The second place to the right of the decimal point." },
      { word: "thousandths", clue: "The third place to the right of the decimal point." },
      { word: "exponent", clue: "The small raised number that tells how many times to multiply a number by itself." },
      { word: "power of ten", clue: "A number like ten, one hundred, or one thousand, made by multiplying tens together." },
      { word: "parentheses", clue: "A pair of curved marks that show which part of a problem to do first." },
      { word: "evaluate", clue: "To work out what a math problem equals." },
      { word: "common denominator", clue: "A bottom number that two fractions share, so you can add or subtract them." },
    ],
  },
  {
    id: "g5-reading-words",
    grade: 5,
    name: "Grade 5 Reading Words",
    blurb: "The words your teacher uses to talk about stories and poems.",
    words: [
      { word: "summarize", clue: "To tell only the most important parts of a text, in a few sentences of your own." },
      { word: "infer", clue: "To figure out something the author does not say, using clues and what you know." },
      { word: "quote", clue: "To copy the exact words from a text, inside quotation marks." },
      { word: "figurative language", clue: "Words that mean something different from what they say, to paint a picture." },
      { word: "simile", clue: "Comparing two things using like or as, such as fast as a cheetah." },
      { word: "metaphor", clue: "Saying one thing is another thing to compare them, like the classroom was a zoo." },
      { word: "personification", clue: "Giving human actions to a thing that is not a person, like the wind whispered." },
      { word: "hyperbole", clue: "A huge stretch of the truth, like I have told you a million times." },
      { word: "idiom", clue: "A saying that means something different from its words, like it is raining cats and dogs." },
      { word: "first person", clue: "When the storyteller is in the story and says I and me." },
      { word: "third person", clue: "When the storyteller is outside the story and says he, she, and they." },
      { word: "character trait", clue: "A word that tells what someone in a story is like inside, such as brave or kind." },
      { word: "setting", clue: "Where and when a story happens." },
      { word: "plot", clue: "The events of a story, in the order they happen." },
      { word: "conflict", clue: "The main problem a character has to face in a story." },
      { word: "resolution", clue: "How the problem in a story is solved at the end." },
      { word: "stanza", clue: "A group of lines in a poem, set apart like a paragraph." },
      { word: "dialogue", clue: "The words characters say to each other, shown with quotation marks." },
    ],
  },
];

export function packById(id: string): WordPack | undefined {
  return WORD_PACKS.find((p) => p.id === id);
}
