import MathDrillCard from "@/components/drill/MathDrillCard";
import WordDrillCard from "@/components/drill/WordDrillCard";
import {
  MATH_MODES,
  MIXED_SKILL,
  bestDrillScore,
  mixedAutoLevel,
  type MathMode,
} from "@/components/drill/options";
import { sourceCounts } from "@/components/drill/picks";
import AppShell from "@/components/ui/AppShell";
import Card from "@/components/ui/Card";
import Icon from "@/components/ui/Icon";
import { todayKey } from "@/lib/day";
import { db } from "@/lib/db";
import { MATH_SKILLS } from "@/lib/math";
import { servedLevel, toClientMathProgress } from "@/lib/models/MathProgress";
import { getPractice } from "@/lib/word-source";
import { getProfile } from "@/lib/profile";

export const dynamic = "force-dynamic";

export const metadata = { title: "Drill" };

export default async function DrillPage() {
  const { MathProgress } = await db();
  const [practice, mathDocs, profile] = await Promise.all([
    getPractice(),
    MathProgress.find().lean(),
    getProfile(),
  ]);

  const now = new Date();
  // getPractice, not the unit summaries: the drill itself runs on the Stuck
  // words pool too, so "All words" has to count what the drill will use.
  const lists = practice
    .filter((l) => l.words.length > 0)
    .map((l) => ({ listId: l._id, name: l.name, words: l.words }));
  const counts = sourceCounts(lists, now);

  const today = todayKey(now);
  const levels = new Map<string, number>();
  for (const doc of mathDocs) {
    const p = toClientMathProgress(doc);
    levels.set(p.skill, servedLevel(p, today));
  }
  const autoLevels: Record<string, number> = {
    // Nothing played yet still starts a Grade 5 child at level 4.
    [MIXED_SKILL]: mixedAutoLevel(levels.size > 0 ? [...levels.values()] : [servedLevel(null, today)]),
  };
  for (const skill of MATH_SKILLS) autoLevels[skill.id] = levels.get(skill.id) ?? servedLevel(null, today);

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
        total={counts.total}
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
