// Every badge is a creature to collect. Locked ones show as a mystery
// silhouette with a hint; winning the badge brings the creature out.
// The drawings live in components/badges/Creature.tsx.
//
// Pure: safe to import from client components.

export type CreatureInfo = {
  /** The creature's own name. */
  name: string;
  /** How to find it, said before it is won. */
  hint: string;
};

export const CREATURES: Record<string, CreatureInfo> = {
  "first-win": { name: "Pip the Chick", hint: "Finish your very first lesson." },
  "streak-3": { name: "Ember the Flame", hint: "Play 3 days in a row." },
  "streak-7": { name: "Nova the Star", hint: "Play 7 days in a row." },
  "streak-30": { name: "Luna the Moon Owl", hint: "Play 30 days in a row." },
  "speed-10": { name: "Zip the Bunny", hint: "Give 10 fast answers." },
  "speed-100": { name: "Volt the Thunder Cat", hint: "Give 100 fast answers." },
  "perfect-1": { name: "Dot the Ladybug", hint: "Get a whole lesson right." },
  "perfect-10": { name: "Glim the Unicorn", hint: "Get 10 lessons all right." },
  "right-100": { name: "Scout the Fox", hint: "Get 100 right answers." },
  "right-500": { name: "Sage the Wise Owl", hint: "Get 500 right answers." },
  "math-star": { name: "Cubit the Robot", hint: "Finish 10 math games." },
  "unit-done": { name: "Shelly the Turtle", hint: "Beat a whole unit." },
  // Set 2: bigger goals.
  "streak-60": { name: "Blaze the Dragon", hint: "Play 60 days in a row." },
  "streak-100": { name: "Sol the Phoenix", hint: "Play 100 days in a row." },
  "speed-500": { name: "Whirl the Hummingbird", hint: "Give 500 fast answers." },
  "perfect-25": { name: "Pebble the Penguin", hint: "Get 25 lessons all right." },
  "perfect-50": { name: "Leo the Lion King", hint: "Get 50 lessons all right." },
  "right-1000": { name: "Inky the Octopus", hint: "Get 1,000 right answers." },
  "right-2500": { name: "Tide the Whale", hint: "Get 2,500 right answers." },
  "math-50": { name: "Honey the Bee", hint: "Finish 50 math games." },
  "reading-5": { name: "Wiggle the Bookworm", hint: "Get to reading level 5." },
  "reading-10": { name: "Bao the Panda", hint: "Get to reading level 10." },
  "level-10": { name: "Rexy the Dino", hint: "Get to level 10." },
  "level-20": { name: "Cosmo the Alien", hint: "Get to level 20." },
  // Set 3: mastery.
  "words-25": { name: "Mossy the Frog", hint: "Know 25 words." },
  "words-50": { name: "Kiki the Parrot", hint: "Know 50 words." },
  "words-100": { name: "Atlas the Elephant", hint: "Know 100 words." },
  "table-one": { name: "Webby the Spider", hint: "Know a whole times table." },
  "grid-lit": { name: "Flicker the Firefly", hint: "Light up the whole times-table grid." },
  "grid-known": { name: "Quill the Hedgehog", hint: "Know every times-table fact." },
  "grid-gold": { name: "Goldie the Goldfish", hint: "Make every times-table fact gold." },
  "math-level-5": { name: "Peak the Mountain Goat", hint: "Get a math skill to level 5." },
  "math-all-3": { name: "Koa the Koala", hint: "Get every math skill to level 3." },
  "reading-8": { name: "Fern the Fawn", hint: "Get to reading level 8." },
};

/**
 * Where each set starts in BADGES order: Set 1, Set 2 (bigger goals) and
 * Set 3 (mastery). The last set runs to the end.
 */
export const SET_STARTS: readonly number[] = [0, 12, 24];

export function creatureFor(badgeId: string): CreatureInfo {
  return CREATURES[badgeId] ?? { name: "Mystery Friend", hint: "Keep learning to find me." };
}
