// Sparky, the pet that grows with what he really knows.
//
// Growth comes from mastery, not from time in the app or raw XP: a word counts
// only once it is known (all four skills, spaced across days — see
// lib/mastery.ts), and a math skill only once it has moved up a level. So the
// pet grows exactly as fast as the learning does, and no amount of tapping
// through easy rounds can feed it.
//
// Pure: safe to import from client components.

import { todayKey } from "@/lib/day";
import { gradeOn } from "@/lib/grade";

export type PetStageId = "egg" | "baby" | "kid" | "teen" | "grown" | "legend";

export type PetStage = { id: PetStageId; name: string; at: number };

/** Growth points needed for each stage, smallest first. */
export const PET_STAGES: readonly PetStage[] = [
  { id: "egg", name: "Egg", at: 0 },
  { id: "baby", name: "Baby Sparky", at: 3 },
  { id: "kid", name: "Little Sparky", at: 10 },
  { id: "teen", name: "Sparky", at: 25 },
  { id: "grown", name: "Big Sparky", at: 50 },
  { id: "legend", name: "Legend Sparky", at: 100 },
];

export type Growth = {
  /** Words known (a mastered word counts twice). */
  wordsKnown: number;
  wordsMastered: number;
  /** Levels gained above 1, summed over every math skill. */
  mathLevelsUp: number;
};

export function growthPoints(g: Growth): number {
  const n = (v: number) => Math.max(0, Math.floor(v) || 0);
  return n(g.wordsKnown) + n(g.wordsMastered) + n(g.mathLevelsUp);
}

/**
 * Levels earned across the math skills; a skill never played counts 0. In
 * Grade 4 every level above 1 counts. Grade 5 lifts every skill he plays to 4
 * without any learning (see levelForGrade), so there a skill keeps at most the
 * Grade 4 credit (levels 1-3) and only levels above 4 add to it: the lift
 * neither feeds Sparky nor takes the Grade 4 growth away.
 */
export function mathLevelsUp(levels: readonly number[], today: string = todayKey()): number {
  const grade5 = gradeOn(today) === 5;
  return levels.reduce((sum, raw) => {
    const l = Math.floor(raw) || 1;
    return sum + (grade5 ? Math.min(l, 3) - 1 + Math.max(0, l - 4) : l - 1);
  }, 0);
}

export type PetMood = "sleepy" | "happy" | "proud";

/** Sleepy until he plays today, happy once he has, proud when today's goal is met. */
export function petMood(lessonsToday: number, dailyGoal: number): PetMood {
  if (lessonsToday <= 0) return "sleepy";
  return lessonsToday >= Math.max(1, dailyGoal) ? "proud" : "happy";
}

export type PetState = {
  stage: PetStage;
  next: PetStage | null;
  points: number;
  /** Points still needed for the next stage; 0 at the last one. */
  toNext: number;
  /** 0..1 progress from this stage to the next; 1 at the last one. */
  progress: number;
  mood: PetMood;
};

export function petState(points: number, mood: PetMood): PetState {
  const p = Math.max(0, Math.floor(points) || 0);
  let index = 0;
  while (index + 1 < PET_STAGES.length && PET_STAGES[index + 1].at <= p) index++;
  const stage = PET_STAGES[index];
  const next = PET_STAGES[index + 1] ?? null;
  const span = next ? next.at - stage.at : 1;
  return {
    stage,
    next,
    points: p,
    toNext: next ? next.at - p : 0,
    progress: next ? (p - stage.at) / span : 1,
    mood,
  };
}

/**
 * What Sparky can say. Specific praise over empty cheering: it names what he
 * did or exactly what is next. A tap on the pet moves to the next line.
 */
export function petLines(pet: PetState, growth: Growth): string[] {
  const lines: string[] = [];
  if (pet.mood === "sleepy") {
    lines.push("Zzz… one lesson wakes me up!");
    lines.push("I'm hungry for words. Play one lesson?");
  } else if (pet.mood === "happy") {
    lines.push("Yum, that lesson was tasty!");
    lines.push("Keep going, we are close to today's goal!");
  } else {
    lines.push("Goal done today! I'm so proud of you.");
    lines.push("You did it! That's how brains grow.");
  }
  if (growth.wordsKnown > 0) {
    lines.push(`You know ${growth.wordsKnown} ${growth.wordsKnown === 1 ? "word" : "words"} for real now.`);
  }
  if (pet.next) {
    lines.push(
      `${pet.toNext} more ${pet.toNext === 1 ? "word or math level" : "words or math levels"} and I grow into ${pet.next.name}!`
    );
  } else {
    lines.push("I'm a legend now, thanks to you!");
  }
  return lines;
}
