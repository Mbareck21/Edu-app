import MathDrillRunner from "@/components/drill/MathDrillRunner";
import {
  MIXED_SKILL,
  mathHref,
  mixedAutoLevel,
  parseLength,
  parseLevelChoice,
  parseMathMode,
} from "@/components/drill/options";
import { requestSeed } from "@/components/ui/time";
import { connectDB } from "@/lib/db";
import { getSkill, isMathSkillId, type Level, type MathSkillId } from "@/lib/math";
import { MathProgress, toClientMathProgress } from "@/lib/models/MathProgress";

export const dynamic = "force-dynamic";

export const metadata = { title: "Math drill" };

type Search = Promise<{
  skill?: string;
  level?: string;
  n?: string;
  mode?: string;
  seed?: string;
}>;

/** The level "Auto" picks: what he is on now, or the middle of all of them. */
async function autoLevel(skill: MathSkillId | "mixed"): Promise<Level> {
  const docs = await MathProgress.find().lean();
  const levels = docs.map((d) => toClientMathProgress(d));
  if (skill !== MIXED_SKILL) {
    const found = levels.find((l) => l.skill === skill);
    return (found?.level ?? 1) as Level;
  }
  return mixedAutoLevel(levels.map((l) => l.level));
}

export default async function MathDrillPage({ searchParams }: { searchParams: Search }) {
  const q = await searchParams;
  const skill: MathSkillId | "mixed" = q.skill && isMathSkillId(q.skill) ? q.skill : MIXED_SKILL;
  const choice = parseLevelChoice(q.level);
  const count = parseLength(q.n);
  const mode = parseMathMode(q.mode);
  const seed = Number(q.seed) || requestSeed();

  await connectDB();
  const level = choice === "auto" ? await autoLevel(skill) : choice;

  return (
    <MathDrillRunner
      skill={skill}
      skillName={skill === MIXED_SKILL ? "Mixed" : getSkill(skill).name}
      level={level}
      count={count}
      mode={mode}
      seed={seed}
      againHref={mathHref({ skill, level: choice, count, mode })}
    />
  );
}
