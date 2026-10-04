import { notFound } from "next/navigation";

import MathSession from "@/components/math/MathSession";
import KidGuard from "@/components/ui/KidGuard";
import { requestSeed } from "@/components/ui/time";
import { todayKey } from "@/lib/day";
import { loadPlanProgress } from "@/lib/daily-plan-data";
import { kidLocked, requireQuestBeat } from "@/lib/assigned-data";
import { db } from "@/lib/db";
import { getSkill, isMathSkillId } from "@/lib/math";
import { servedLevel, toClientMathProgress } from "@/lib/models/MathProgress";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ skill: string }> };

export async function generateMetadata({ params }: Params) {
  const { skill } = await params;
  return { title: isMathSkillId(skill) ? getSkill(skill).name : "Math" };
}

export default async function MathSkillPage({ params }: Params) {
  const { skill } = await params;
  if (!isMathSkillId(skill)) notFound();
  // A child plays a math lesson only as the day's Math beat.
  await requireQuestBeat(`/math/${skill}`);

  const { MathProgress } = await db();
  const doc = await MathProgress.findOne({ skill }).lean();
  // Grade 5 plays every skill at level 4 or higher; see levelForGrade.
  const level = servedLevel(doc ? toClientMathProgress(doc) : null, todayKey());

  return (
    <>
      <KidGuard />
      <MathSession
        skillId={skill}
        level={level}
        seed={requestSeed()}
        dayPlan={await loadPlanProgress("math")}
        again={!(await kidLocked())}
      />
    </>
  );
}
