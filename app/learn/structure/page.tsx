import StructureRunner from "@/components/reading/StructureRunner";
import ExitBar from "@/components/ui/ExitBar";
import KidGuard from "@/components/ui/KidGuard";
import { requestSeed } from "@/components/ui/time";
import { kidLocked, requireQuestBeat } from "@/lib/assigned-data";
import { currentLearner } from "@/lib/auth";
import { loadPlanProgress } from "@/lib/daily-plan-data";

export const dynamic = "force-dynamic";

export const metadata = { title: "Text Structure" };

export default async function StructurePage({
  searchParams,
}: {
  searchParams: Promise<{ r?: string }>;
}) {
  // Remount key, same trick as the step pages: "Again" links back here with a
  // new ?r, and without a changing key the finished runner keeps its state.
  await requireQuestBeat("/learn/structure");
  const runKey = (await searchParams).r ?? "first";
  const seed = requestSeed();
  return (
    <>
      <KidGuard />
      <ExitBar />
      <StructureRunner
        key={runKey}
        seed={seed}
        learner={await currentLearner()}
        dayPlan={await loadPlanProgress("structure")}
        again={!(await kidLocked())}
      />
    </>
  );
}
