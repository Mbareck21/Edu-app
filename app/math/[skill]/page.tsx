import { notFound } from "next/navigation";

import MathSession from "@/components/math/MathSession";
import { connectDB } from "@/lib/db";
import { getSkill, isMathSkillId, type Level } from "@/lib/math";
import { MathProgress, toClientMathProgress } from "@/lib/models/MathProgress";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ skill: string }> };

/** One seed per request. The page is dynamic, so every visit gets new questions. */
function requestSeed(): number {
  return Date.now();
}

export async function generateMetadata({ params }: Params) {
  const { skill } = await params;
  return { title: isMathSkillId(skill) ? getSkill(skill).name : "Math" };
}

export default async function MathSkillPage({ params }: Params) {
  const { skill } = await params;
  if (!isMathSkillId(skill)) notFound();

  await connectDB();
  const doc = await MathProgress.findOne({ skill }).lean();
  const level = (doc ? toClientMathProgress(doc).level : 1) as Level;

  return <MathSession skillId={skill} level={level} seed={requestSeed()} />;
}
