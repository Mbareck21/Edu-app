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
};

export function creatureFor(badgeId: string): CreatureInfo {
  return CREATURES[badgeId] ?? { name: "Mystery Friend", hint: "Keep learning to find me." };
}
