import MathDrillCard from "@/components/drill/MathDrillCard";
import WordDrillCard from "@/components/drill/WordDrillCard";
import { MATH_MODES, MIXED_SKILL, bestDrillScore, type MathMode } from "@/components/drill/options";
import { sourceCounts } from "@/components/drill/picks";
import AppShell from "@/components/ui/AppShell";
import Card from "@/components/ui/Card";
import Icon from "@/components/ui/Icon";
import { connectDB } from "@/lib/db";
import { MATH_SKILLS } from "@/lib/math";
import { MathProgress, toClientMathProgress } from "@/lib/models/MathProgress";
import { WordList, toClient } from "@/lib/models/WordList";
import { getProfile } from "@/lib/profile";

export const dynamic = "force-dynamic";

export const metadata = { title: "Drill" };

/** Auto level for a mixed drill: the middle of what he is on now. */
function mixedLevel(levels: number[]): number {
  if (levels.length === 0) return 1;
  return Math.max(1, Math.min(3, Math.round(levels.reduce((a, b) => a + b, 0) / levels.length)));
}

export default async function DrillPage() {
  await connectDB();
  const [listDocs, mathDocs, profile] = await Promise.all([
    WordList.find().sort({ updatedAt: -1 }).lean(),
    MathProgress.find().lean(),
    getProfile(),
  ]);

  const now = new Date();
  const lists = listDocs
    .map(toClient)
    .filter((l) => l.words.length > 0)
    .map((l) => ({ listId: l._id, name: l.name, words: l.words }));
  const counts = sourceCounts(lists, now);

  const levels = new Map<string, number>();
  for (const doc of mathDocs) {
    const p = toClientMathProgress(doc);
    levels.set(p.skill, p.level);
  }
  const autoLevels: Record<string, number> = {
    [MIXED_SKILL]: mixedLevel([...levels.values()]),
  };
  for (const skill of MATH_SKILLS) autoLevels[skill.id] = levels.get(skill.id) ?? 1;

  const bests: Record<string, Record<MathMode, number | null>> = {};
  for (const id of [MIXED_SKILL, ...MATH_SKILLS.map((s) => s.id)]) {
    bests[id] = Object.fromEntries(
      MATH_MODES.map((mode) => [mode, bestDrillScore(profile.activity, id, mode)])
    ) as Record<MathMode, number | null>;
  }

  return (
    <AppShell>
      <div className="flex items-center gap-2 pt-4 pb-1">
        <span
          className="flex h-9 w-9 items-center justify-center rounded-full"
          style={{ background: "var(--color-blue-soft)", color: "var(--color-blue)" }}
        >
          <Icon name="bolt" size={22} />
        </span>
        <h1 className="font-display text-2xl font-bold">Drill</h1>
      </div>

      <Card color="blue" variant="soft" className="mt-2">
        <p className="font-body text-[15px] leading-snug">
          Free practice. Pick what you want, then go. Every drill still counts.
        </p>
      </Card>

      <WordDrillCard
        lists={counts.lists}
        all={counts.all}
        weak={counts.weak}
        due={counts.due}
      />

      <MathDrillCard
        skills={MATH_SKILLS.map((s) => ({ id: s.id, name: s.name }))}
        bests={bests}
        autoLevels={autoLevels}
      />
    </AppShell>
  );
}
