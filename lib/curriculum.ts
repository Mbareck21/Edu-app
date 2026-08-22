/**
 * Fayetteville Public Schools (Asbell Elementary) Grade 4 curriculum data, 2026-27.
 *
 * Pure data + pure functions. No imports from the app, no side effects.
 * Sources and provenance: docs/curriculum-fps-grade4.md
 */

/* ------------------------------------------------------------------ *
 * Calendar
 * ------------------------------------------------------------------ */

export type Quarter = { id: "Q1" | "Q2" | "Q3" | "Q4"; start: string; end: string; days: number };

/** FPS Year-at-a-Glance quarter windows (ELA, Math and Science all use these). */
export const FPS_QUARTERS: Quarter[] = [
  { id: "Q1", start: "2026-08-11", end: "2026-10-08", days: 42 },
  { id: "Q2", start: "2026-10-13", end: "2026-12-18", days: 43 },
  { id: "Q3", start: "2027-01-05", end: "2027-03-11", days: 45 },
  { id: "Q4", start: "2027-03-12", end: "2027-05-20", days: 44 },
];

/** First instructional day of the year. Week 1 of the science calendar starts here. */
export const SCHOOL_YEAR_START = "2026-08-11";
export const SCHOOL_YEAR_END = "2027-05-20";

/** Days since the Unix epoch for an ISO date, timezone-free. */
function dayNum(dateISO: string): number {
  const [y, m, d] = dateISO.slice(0, 10).split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

/** The Monday on or before `n`. (1970-01-01 was a Thursday.) */
function mondayOf(n: number): number {
  return n - ((n + 3) % 7);
}

/**
 * Mondays of every week that carries at least one instructional day.
 * Weeks that fall entirely inside a quarter gap (winter break) are dropped.
 */
function schoolWeeks(): number[] {
  const ranges = FPS_QUARTERS.map((q) => [dayNum(q.start), dayNum(q.end)] as const);
  const last = dayNum(SCHOOL_YEAR_END);
  const weeks: number[] = [];
  for (let m = mondayOf(dayNum(SCHOOL_YEAR_START)); m <= last; m += 7) {
    const friday = m + 4;
    if (ranges.some(([a, b]) => friday >= a && m <= b)) weeks.push(m);
  }
  return weeks;
}

const SCHOOL_WEEKS = schoolWeeks();

/** Which grading quarter a date falls in, or "summer" for breaks and out-of-year dates. */
export function currentQuarter(dateISO: string): Quarter["id"] | "summer" {
  const n = dayNum(dateISO);
  for (const q of FPS_QUARTERS) {
    if (n >= dayNum(q.start) && n <= dayNum(q.end)) return q.id;
  }
  return "summer";
}

/* ------------------------------------------------------------------ *
 * ELA essential standards
 * ------------------------------------------------------------------ */

export type ElaStandard = {
  code: string;
  plain: string;
  quarters: Quarter["id"][];
  itemTypes: string[];
};

/**
 * The nine FPS Grade 4 ELA "district essential" standards, in plain words,
 * with the app item types that exercise each one.
 */
export const ELA_STANDARDS: ElaStandard[] = [
  {
    code: "4.FR.6.F",
    plain: "Read a passage out loud correctly, smoothly and with expression, at a speed that still lets you understand it, and fix your own mistakes as you go.",
    quarters: ["Q1", "Q2", "Q3", "Q4"],
    itemTypes: ["read-aloud-timed", "reading"],
  },
  {
    code: "4.FR.1.PD",
    plain: "Read long words by spotting their Latin parts: the prefix at the front, the base in the middle, the suffix at the end, and the letter that joins them.",
    quarters: ["Q1", "Q2", "Q3", "Q4"],
    itemTypes: ["word-part-meaning", "word-part-build", "recognize"],
  },
  {
    code: "4.FR.4.PE",
    plain: "Spell long words by putting those same Latin parts back together, including prefixes that change shape next to the base (in- becoming im-, ad- becoming ac-).",
    quarters: ["Q2", "Q3", "Q4"],
    itemTypes: ["word-part-spell", "spell"],
  },
  {
    code: "4.V.2",
    plain: "Work out what a new word means from the rest of the sentence - the cause and effect, or the comparison, that the writer put around it.",
    quarters: ["Q1", "Q2", "Q3", "Q4"],
    itemTypes: ["context-clue", "use"],
  },
  {
    code: "4.RC.2.RF",
    plain: "Answer questions about a text, both the ones the text says straight out and the ones you have to work out, and point to the details you used.",
    quarters: ["Q1", "Q2", "Q3", "Q4"],
    itemTypes: ["reading-detail", "reading-inference"],
  },
  {
    code: "4.RC.3.RF",
    plain: "Sum up a text of several paragraphs in your own words, keeping the key details that show what it was mainly about.",
    quarters: ["Q3", "Q4"],
    itemTypes: ["retell-pick", "reading"],
  },
  {
    code: "4.RC.9.RL",
    plain: "Say what the lesson or big idea of a story is - the theme - not just what happened in it.",
    quarters: ["Q2", "Q3"],
    itemTypes: ["theme-pick"],
  },
  {
    code: "4.RC.14.RI",
    plain: "Explain how a writer backs up a point: which reasons and which pieces of evidence he used for it.",
    quarters: ["Q3", "Q4"],
    itemTypes: ["evidence-pick", "reading-author"],
  },
  {
    code: "4.L.14.S",
    plain: "Write complex sentences by adding a dependent clause with a joining word like because, although, when, if or since.",
    quarters: ["Q1"],
    itemTypes: ["sentence-combine", "use"],
  },
  {
    code: "4.W.4.P",
    plain: "Write clearly so a reader follows you: exact words, details that matter, ideas developed, and Grade 4 spelling and punctuation.",
    quarters: ["Q1", "Q2", "Q3", "Q4"],
    itemTypes: ["sentence-combine", "use", "retell-pick"],
  },
];

/* ------------------------------------------------------------------ *
 * Reading themes (Benchmark Advance Grade 4 units)
 * ------------------------------------------------------------------ */

export type ReadingTheme = {
  id: string;
  title: string;
  /** true = unit title, essential question and word bank verified in published district scope-and-sequence documents. */
  confirmed: boolean;
  words: string[];
  prompts: string[];
};

/**
 * The ten Benchmark Advance Grade 4 units, in publisher order.
 * FPS does not publish its own unit sequence, so the order here is the publisher's.
 */
export const READING_THEMES: ReadingTheme[] = [
  {
    id: "observing-nature",
    title: "Observing Nature",
    confirmed: true,
    words: ["observe", "encounter", "appreciate", "interact", "nature", "sensory", "vast", "solitary", "vegetation", "shimmering", "winding", "scrawny"],
    prompts: [
      "How do we respond to nature?",
      "What does the writer want you to notice about this place?",
      "How does the character change after being outside?",
    ],
  },
  {
    id: "actions-and-reactions",
    title: "Characters' Actions and Reactions",
    confirmed: true,
    words: ["actions", "reactions", "connect", "communicate", "interact", "relationships", "tedious", "earnestly", "mischievous", "dejectedly", "appalled", "overrated"],
    prompts: [
      "How do we reveal ourselves to others?",
      "What do this character's actions tell you about him?",
      "Which word best describes how she reacted, and what in the text shows it?",
    ],
  },
  {
    id: "government-in-action",
    title: "Government in Action",
    confirmed: true,
    words: ["function", "powers", "solve", "levels", "services", "society", "crisis", "adversity", "liberties", "delegated", "tyrannical", "urgency"],
    prompts: [
      "How can government influence the way we live?",
      "Which services does this level of government provide?",
      "What reason does the author give for this rule?",
    ],
  },
  {
    id: "points-of-view",
    title: "Understanding Different Points of View",
    confirmed: true,
    words: ["point of view", "perspective", "narrator", "influence", "distinctive", "realistic fiction", "accustomed", "weariness", "coaxing", "contraption", "involuntarily", "dangled"],
    prompts: [
      "What do we learn when we look at the world through the eyes of others?",
      "Who is telling this story, and how would it change if someone else told it?",
      "What does the narrator know that the other characters do not?",
    ],
  },
  {
    id: "technology-for-tomorrow",
    title: "Technology for Tomorrow",
    confirmed: true,
    words: ["technology", "automation", "efficiency", "develop", "impact", "society", "specialized", "precautions", "beneficial", "outweigh", "inevitably", "impaired"],
    prompts: [
      "How do we make decisions about developing new technology?",
      "What problem was this invention built to solve?",
      "Do the benefits outweigh the risks here? Which sentence shows it?",
    ],
  },
  {
    id: "confronting-challenges",
    title: "Confronting Challenges",
    confirmed: true,
    words: ["confront", "challenge", "obstacles", "quest", "mission", "theme", "valor", "undertaking", "fatigue", "subsided", "attentive", "glimpse"],
    prompts: [
      "How do we overcome obstacles?",
      "What is the theme of this story?",
      "What did the character have to give up to keep going?",
    ],
  },
  {
    id: "transcontinental-railroad",
    title: "The Transcontinental Railroad",
    confirmed: true,
    words: ["expansion", "advances", "communities", "settler", "impact", "devastating", "grueling", "incentive", "isolated", "recruiting", "roamed", "plentiful"],
    prompts: [
      "How do communities evolve?",
      "Who gained from the railroad, and who lost?",
      "What evidence does the author use to show how hard the work was?",
    ],
  },
  {
    id: "earth-changes",
    title: "Earth Changes",
    confirmed: true,
    words: ["natural disaster", "destruction", "pressure", "energy", "events", "violent", "collided", "magnitude", "hazardous", "ominously", "daunting", "substantially"],
    prompts: [
      "How do Earth's natural processes impact our lives?",
      "What causes this to happen, and what happens next?",
      "Which sentence gives the author's evidence that the change was large?",
    ],
  },
  {
    id: "resources-and-impact",
    title: "Resources and Their Impact",
    confirmed: true,
    words: ["resources", "economy", "access", "dependent", "protect", "sustain", "agricultural", "abundance", "union", "wages", "booming", "crippled"],
    prompts: [
      "How does access to resources influence people's lives?",
      "What happens to a place when a resource runs out?",
      "What picture does the poet put in your head, and which words do it?",
    ],
  },
  {
    id: "power-of-electricity",
    title: "The Power of Electricity",
    confirmed: true,
    words: ["invention", "generate", "energy", "experiment", "grid", "network", "outage", "influential", "malfunctions", "continuous", "faulty", "prominent"],
    prompts: [
      "Where do scientific discoveries lead us?",
      "How does electricity get from the power plant to this room?",
      "Why was this inventor left out of the story for so long?",
    ],
  },
];

/**
 * Each Benchmark Advance unit runs three weeks: two short reads, then an
 * extended read, then a second extended read where the class compares the
 * texts. Confirmed in the publisher's Grade 4 scope and sequence.
 */
export const THEME_WEEKS = 3;

/**
 * Which week of the current unit the class is in, 1..3. Derived from the same
 * even spread `themeForWeek` uses, so the two never disagree.
 */
export function weekInTheme(dateISO: string): number {
  const total = SCHOOL_WEEKS.length;
  const m = mondayOf(dayNum(dateISO));
  let passed = 0;
  for (const w of SCHOOL_WEEKS) {
    if (w <= m) passed++;
    else break;
  }
  const index = passed === 0 ? 0 : passed - 1;
  const perTheme = total / READING_THEMES.length;
  const into = index - Math.floor(index / perTheme) * perTheme;
  return Math.min(THEME_WEEKS, Math.floor((into / perTheme) * THEME_WEEKS) + 1);
}

/**
 * The reading theme in play for the week containing `dateISO`.
 * The ten themes are spread evenly over the instructional weeks of the year
 * (Aug 11 2026 - May 20 2027), in order. Dates before the year start return the
 * first theme; dates after the year end return the last.
 */
export function themeForWeek(dateISO: string): ReadingTheme {
  const total = SCHOOL_WEEKS.length;
  const m = mondayOf(dayNum(dateISO));
  let passed = 0;
  for (const w of SCHOOL_WEEKS) {
    if (w <= m) passed++;
    else break;
  }
  const index = passed === 0 ? 0 : passed - 1;
  const themeIdx = Math.min(
    READING_THEMES.length - 1,
    Math.floor((index * READING_THEMES.length) / total),
  );
  return READING_THEMES[themeIdx];
}

/* ------------------------------------------------------------------ *
 * Latin word parts (4.FR.1.PD decode / 4.FR.4.PE encode)
 * ------------------------------------------------------------------ */

export const LATIN_PARTS: {
  part: string;
  kind: "prefix" | "suffix" | "base";
  meaning: string;
  examples: string[];
}[] = [
  { part: "re-", kind: "prefix", meaning: "again, or back", examples: ["rebuild", "return", "review"] },
  { part: "un-", kind: "prefix", meaning: "not, or the opposite", examples: ["unhappy", "unfair", "undo"] },
  { part: "dis-", kind: "prefix", meaning: "not, or away", examples: ["disagree", "dislike", "disappear"] },
  { part: "pre-", kind: "prefix", meaning: "before", examples: ["preview", "predict", "prepay"] },
  { part: "mis-", kind: "prefix", meaning: "wrongly", examples: ["misspell", "mistake", "misjudge"] },
  { part: "non-", kind: "prefix", meaning: "not", examples: ["nonstop", "nonsense", "nonfiction"] },
  { part: "sub-", kind: "prefix", meaning: "under, or below", examples: ["submarine", "subway", "subtract"] },
  { part: "inter-", kind: "prefix", meaning: "between", examples: ["interrupt", "internet", "interact"] },
  { part: "trans-", kind: "prefix", meaning: "across", examples: ["transport", "translate", "transfer"] },
  { part: "in-/im-", kind: "prefix", meaning: "not (im- before m, b or p)", examples: ["incorrect", "impossible", "impatient"] },
  { part: "-able", kind: "suffix", meaning: "can be done", examples: ["readable", "washable", "comfortable"] },
  { part: "-ible", kind: "suffix", meaning: "can be done (after a root that is not a whole word)", examples: ["visible", "possible", "terrible"] },
  { part: "-tion", kind: "suffix", meaning: "makes a noun: the act or result of", examples: ["action", "invention", "protection"] },
  { part: "-sion", kind: "suffix", meaning: "makes a noun after d or s sounds", examples: ["decision", "division", "explosion"] },
  { part: "-ment", kind: "suffix", meaning: "makes a noun: the state or result of", examples: ["movement", "government", "agreement"] },
  { part: "-ful", kind: "suffix", meaning: "full of", examples: ["helpful", "careful", "powerful"] },
  { part: "-less", kind: "suffix", meaning: "without", examples: ["helpless", "careless", "endless"] },
  { part: "-ly", kind: "suffix", meaning: "in that way", examples: ["quickly", "kindly", "safely"] },
  { part: "-er/-or", kind: "suffix", meaning: "a person or thing that does it", examples: ["teacher", "actor", "inventor"] },
  { part: "-ist", kind: "suffix", meaning: "a person who does or studies it", examples: ["scientist", "artist", "cyclist"] },
  { part: "port", kind: "base", meaning: "carry", examples: ["transport", "import", "portable"] },
  { part: "rupt", kind: "base", meaning: "break", examples: ["erupt", "interrupt", "rupture"] },
  { part: "struct", kind: "base", meaning: "build", examples: ["construct", "structure", "destruction"] },
  { part: "dict", kind: "base", meaning: "say or tell", examples: ["predict", "dictate", "contradict"] },
  { part: "ject", kind: "base", meaning: "throw", examples: ["eject", "inject", "projector"] },
  { part: "tract", kind: "base", meaning: "pull or drag", examples: ["tractor", "subtract", "attract"] },
  { part: "spect", kind: "base", meaning: "look", examples: ["inspect", "spectator", "respect"] },
  { part: "form", kind: "base", meaning: "shape", examples: ["transform", "uniform", "formation"] },
  { part: "scrib/script", kind: "base", meaning: "write", examples: ["describe", "scribble", "prescription"] },
  { part: "aud", kind: "base", meaning: "hear", examples: ["audience", "audio", "auditorium"] },
  { part: "vis/vid", kind: "base", meaning: "see", examples: ["visible", "video", "television"] },
];

/* ------------------------------------------------------------------ *
 * Science units
 * ------------------------------------------------------------------ */

export type ScienceUnit = {
  id: string;
  title: string;
  weekStart: number;
  weekEnd: number;
  standards: { code: string; plain: string }[];
  words: string[];
  passageIdeas: string[];
};

export const SCIENCE_UNITS: ScienceUnit[] = [
  {
    id: "adaptations",
    title: "Plants & Animals: Adaptations",
    weekStart: 2,
    weekEnd: 9,
    standards: [
      {
        code: "4-LS1-1",
        plain: "Argue, with evidence, that the parts inside and outside a plant or animal each do a job that helps it stay alive, grow, act and have young.",
      },
    ],
    words: ["adaptation", "structure", "function", "survive", "growth", "behavior", "reproduce", "internal", "external", "root", "stem", "protect", "camouflage", "habitat", "trait"],
    passageIdeas: [
      "Why a cactus has spines instead of leaves",
      "How a bird's beak fits the food it eats",
      "Roots, stems and leaves: what each part does",
      "Thick fur and fat: how an arctic fox survives winter",
      "Hiding in plain sight: animals that use camouflage",
    ],
  },
  {
    id: "senses",
    title: "Animals: Senses & Information Processing",
    weekStart: 2,
    weekEnd: 9,
    standards: [
      {
        code: "4-LS1-2",
        plain: "Use a model to show how an animal takes in information through its senses, works on it in the brain, and then does something about it.",
      },
    ],
    words: ["senses", "sense organ", "signal", "respond", "brain", "nerve", "information", "process", "react", "sight", "hearing", "smell", "touch", "memory", "model"],
    passageIdeas: [
      "How a bat finds a moth in the dark",
      "What happens in your brain when you touch something hot",
      "Eyes, ears and noses: sending signals to the brain",
      "A dog's nose beats yours by a mile",
      "Why animals freeze when they sense danger",
    ],
  },
  {
    id: "earth-features",
    title: "Earth's Features & Processes",
    weekStart: 10,
    weekEnd: 18,
    standards: [
      {
        code: "4-ESS1-1",
        plain: "Use the patterns in rock layers and the fossils inside them as evidence for how a landscape changed over a very long time.",
      },
      {
        code: "4-ESS2-1",
        plain: "Observe and measure to show how water, ice, wind or plants wear rock down and how fast they carry it away.",
      },
      {
        code: "4-ESS2-2",
        plain: "Read maps and find the patterns in where Earth's mountains, valleys, volcanoes and oceans sit.",
      },
    ],
    words: ["fossil", "rock layer", "pattern", "evidence", "landscape", "weathering", "erosion", "deposit", "canyon", "glacier", "volcano", "earthquake", "map", "mountain range", "valley"],
    passageIdeas: [
      "How a river carves a canyon",
      "Fossils in rock layers tell a story",
      "What wind and ice do to a mountain",
      "Reading a map of Earth's features",
      "Why the Grand Canyon has stripes",
    ],
  },
  {
    id: "energy",
    title: "Energy (Energy Transfer, Electricity, Light & Heat)",
    weekStart: 19,
    weekEnd: 28,
    standards: [
      {
        code: "4-PS3-1",
        plain: "Use evidence to explain that the faster something moves, the more energy it has.",
      },
      {
        code: "4-PS3-2",
        plain: "Observe and show that energy moves from place to place as sound, light, heat and electric current.",
      },
      {
        code: "4-ESS3-1",
        plain: "Gather information showing that our energy and fuels come from natural resources, and that using them changes the environment.",
      },
    ],
    words: ["energy", "speed", "motion", "collision", "transfer", "heat", "light", "sound", "electric current", "circuit", "fuel", "natural resource", "renewable", "nonrenewable", "environment"],
    passageIdeas: [
      "Why a faster ball hits harder",
      "How energy travels along a wire",
      "Where the electricity in your house comes from",
      "Fuels from the ground and what they cost the Earth",
      "Sun and wind: energy that does not run out",
    ],
  },
  {
    id: "waves",
    title: "Waves",
    weekStart: 29,
    weekEnd: 32,
    standards: [
      {
        code: "4-PS4-1",
        plain: "Build a model of a wave to show its height and its length, and show that waves can push objects around.",
      },
    ],
    words: ["wave", "amplitude", "wavelength", "crest", "trough", "vibrate", "vibration", "pattern", "energy", "motion", "sound wave", "water wave", "model", "repeat", "height"],
    passageIdeas: [
      "What makes a wave big or small",
      "How sound travels to your ear",
      "Waves that move a boat but not the water",
      "Drawing a model of a wave",
    ],
  },
  {
    id: "engineering-design",
    title: "Engineering Design & Science Fair",
    weekStart: 31,
    weekEnd: 36,
    standards: [],
    words: ["engineer", "design", "problem", "solution", "criteria", "constraint", "model", "prototype", "test", "improve", "materials", "compare", "data", "result", "fair test"],
    passageIdeas: [
      "How engineers plan before they build",
      "Testing two designs the fair way",
      "Why the first model usually fails",
      "Turning a problem into a design question",
      "What a science fair poster has to show",
    ],
  },
];

/**
 * The science unit running in the week containing `dateISO`.
 * Week 1 is the week of Aug 11 2026; weeks are counted straight through, breaks
 * included, which is close enough for "what are they doing in science now".
 * Because breaks are ignored, week 36 falls in mid-April; the remaining school
 * weeks stay on the last unit rather than going blank. Outside the school year,
 * and in week 1 (launch week, before Unit 1 starts), the answer is null.
 * Two units share weeks 2-9 and two share weeks 31-32; a shared span is split
 * evenly between the units that claim it, in list order.
 */
export function scienceUnitForWeek(dateISO: string): ScienceUnit | null {
  const n = dayNum(dateISO);
  if (n < dayNum(SCHOOL_YEAR_START) || n > dayNum(SCHOOL_YEAR_END)) return null;
  const week = Math.min(36, Math.floor((n - dayNum(SCHOOL_YEAR_START)) / 7) + 1);
  const matches = SCIENCE_UNITS.filter((u) => week >= u.weekStart && week <= u.weekEnd);
  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0];
  const from = Math.min(...matches.map((u) => u.weekStart));
  const to = Math.max(...matches.map((u) => u.weekEnd));
  const slot = (to - from + 1) / matches.length;
  const i = Math.min(matches.length - 1, Math.floor((week - from) / slot));
  return matches[i];
}
