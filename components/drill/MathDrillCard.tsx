"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import ChoiceRow, { type Choice } from "@/components/drill/ChoiceRow";
import {
  DRILL_LENGTHS,
  MATH_MODES,
  MATH_MODE_LABEL,
  MIXED_SKILL,
  bestLabel,
  mathHref,
  parseLevelChoice,
  type MathMode,
} from "@/components/drill/options";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Icon from "@/components/ui/Icon";

export type MathDrillCardProps = {
  skills: { id: string; name: string }[];
  /** Best score per skill + mode, from Profile.activity. */
  bests: Record<string, Record<MathMode, number | null>>;
  /** Level the "Auto" chip would use, per skill. */
  autoLevels: Record<string, number>;
};

export default function MathDrillCard({ skills, bests, autoLevels }: MathDrillCardProps) {
  const router = useRouter();
  const [skill, setSkill] = useState<string>(MIXED_SKILL);
  const [level, setLevel] = useState<string>("auto");
  const [count, setCount] = useState<number>(10);
  const [mode, setMode] = useState<MathMode>("relaxed");
  const [going, setGoing] = useState(false);

  const skillChoices: Choice[] = [
    { value: MIXED_SKILL, label: "Mixed" },
    ...skills.map((s) => ({ value: s.id, label: s.name })),
  ];
  const best = bests[skill]?.[mode] ?? null;
  const auto = autoLevels[skill] ?? 1;
  const timed = mode !== "relaxed";

  function start() {
    if (going) return;
    setGoing(true);
    router.push(
      mathHref({ skill, level: parseLevelChoice(level), count, mode, seed: Date.now() })
    );
  }

  return (
    <Card className="mt-4">
      <div className="flex items-center gap-2">
        <span
          className="flex h-9 w-9 items-center justify-center rounded-full"
          style={{ background: "var(--color-purple-soft)", color: "var(--color-purple)" }}
        >
          <Icon name="math" size={20} />
        </span>
        <h2 className="font-display text-xl font-bold">Math drills</h2>
      </div>

      <ChoiceRow
        label="Skill"
        choices={skillChoices}
        value={skill}
        onChange={setSkill}
        color="purple"
      />
      <ChoiceRow
        label="Level"
        choices={[
          { value: "auto", label: "Auto", note: `L${auto}` },
          { value: "1", label: "1" },
          { value: "2", label: "2" },
          { value: "3", label: "3" },
        ]}
        value={level}
        onChange={setLevel}
        color="purple"
      />
      <ChoiceRow
        label="Mode"
        choices={MATH_MODES.map((m) => ({ value: m, label: MATH_MODE_LABEL[m] }))}
        value={mode}
        onChange={(v) => setMode(v as MathMode)}
        color="purple"
      />
      {timed ? (
        <p className="mt-2 font-body text-sm" style={{ color: "var(--color-muted)" }}>
          Get as many right as you can before time runs out.
        </p>
      ) : (
        <ChoiceRow
          label="How many"
          choices={DRILL_LENGTHS.map((n) => ({ value: String(n), label: String(n) }))}
          value={String(count)}
          onChange={(v) => setCount(Number(v))}
          color="purple"
        />
      )}

      {best === null ? null : (
        <p className="mt-3 font-display text-sm font-bold" style={{ color: "var(--color-purple-dark)" }}>
          {bestLabel(best, mode)}
        </p>
      )}

      <Button
        className="mt-4"
        color="purple"
        size="lg"
        fullWidth
        disabled={going}
        onClick={start}
      >
        Start
      </Button>
    </Card>
  );
}

export { MathDrillCard };
