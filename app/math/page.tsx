import Link from "next/link";

import AppShell from "@/components/ui/AppShell";
import { buttonClass, buttonStyle } from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Icon from "@/components/ui/Icon";
import Pill from "@/components/ui/Pill";
import { todayKey } from "@/lib/day";
import { connectDB } from "@/lib/db";
import { MATH_SKILLS, MATH_UNITS, currentUnit, skillsForUnit, type MathSkill } from "@/lib/math";
import { MathProgress, toClientMathProgress } from "@/lib/models/MathProgress";

export const dynamic = "force-dynamic";

export const metadata = { title: "Math" };

type Stat = { level: number; best: number | null };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-08-11" -> "Aug 11". No Date, so the day never shifts by time zone. */
function shortDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${MONTHS[Number(m) - 1]} ${Number(d)}`;
}

function Stars({ level }: { level: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`Level ${level} of 3`}>
      {[1, 2, 3].map((n) => (
        <span key={n} style={{ color: n <= level ? "var(--color-gold)" : "var(--color-line)" }}>
          <Icon name="star" size={16} filled={n <= level} />
        </span>
      ))}
    </span>
  );
}

function SkillCard({ skill, stat, school }: { skill: MathSkill; stat: Stat; school?: boolean }) {
  return (
    <Card className="mt-2">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-lg font-bold">{skill.name}</h3>
            {school ? (
              <Pill color="purple" variant="line" size="sm">
                School
              </Pill>
            ) : null}
          </div>
          <p className="mt-0.5 text-sm" style={{ color: "var(--color-muted)" }}>
            {skill.blurb}
          </p>
          <div className="mt-2 flex items-center gap-3">
            <Stars level={stat.level} />
            <span className="text-xs font-bold" style={{ color: "var(--color-muted)" }}>
              {stat.best === null ? "Not played yet" : `Best ${stat.best}%`}
            </span>
          </div>
        </div>
        <Link
          href={`/math/${skill.id}`}
          className={buttonClass({ color: "purple", size: "md" })}
          style={buttonStyle({ color: "purple" })}
        >
          Play
        </Link>
      </div>
    </Card>
  );
}

export default async function MathPage() {
  await connectDB();
  const docs = await MathProgress.find().lean();
  const stats = new Map<string, Stat>();
  for (const doc of docs) {
    const p = toClientMathProgress(doc);
    stats.set(p.skill, {
      level: p.level,
      best: p.recentPcts.length > 0 ? Math.max(...p.recentPcts) : null,
    });
  }
  const statFor = (id: string): Stat => stats.get(id) ?? { level: 1, best: null };

  const unit = currentUnit(todayKey());
  const unitSkills = skillsForUnit(unit.id);

  return (
    <AppShell>
      <div className="flex items-center gap-2 pt-4 pb-3">
        <span
          className="flex h-9 w-9 items-center justify-center rounded-full"
          style={{ background: "var(--color-purple-soft)", color: "var(--color-purple)" }}
        >
          <Icon name="math" size={22} />
        </span>
        <h1 className="font-display text-2xl font-bold">Math</h1>
      </div>

      {/* At school now */}
      <Card color="purple" variant="soft">
        <p
          className="text-[11px] font-bold uppercase tracking-wide"
          style={{ color: "var(--color-purple-dark)" }}
        >
          At school now
        </p>
        <h2 className="mt-1 font-display text-xl font-bold">{unit.name}</h2>
        <p className="mt-0.5 text-sm" style={{ color: "var(--color-purple-dark)" }}>
          {shortDate(unit.start)} to {shortDate(unit.end)} · {unit.quarter}
        </p>
        <p className="mt-2 text-sm">Play these first. They match your class.</p>
      </Card>

      {unitSkills.map((skill) => (
        <SkillCard key={skill.id} skill={skill} stat={statFor(skill.id)} school />
      ))}

      <h2 className="mt-6 mb-1 font-display text-lg font-bold">All skills</h2>
      {MATH_UNITS.map((u) => {
        const skills = MATH_SKILLS.filter((s) => s.unit === u.id);
        if (skills.length === 0) return null;
        return (
          <section key={u.id} className="mt-4">
            <div className="flex flex-wrap items-baseline gap-2">
              <h3 className="font-display text-base font-bold">
                Unit {u.id} · {u.name}
              </h3>
              <span className="text-xs font-bold" style={{ color: "var(--color-muted)" }}>
                {u.quarter}
              </span>
            </div>
            {skills.map((skill) => (
              <SkillCard key={skill.id} skill={skill} stat={statFor(skill.id)} />
            ))}
          </section>
        );
      })}

      <div className="h-4" />
    </AppShell>
  );
}
