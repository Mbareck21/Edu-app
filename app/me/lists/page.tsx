import Link from "next/link";

import AppShell from "@/components/ui/AppShell";
import Card from "@/components/ui/Card";
import Icon from "@/components/ui/Icon";
import LockButton from "@/components/words/LockButton";
import NewListForm from "@/components/words/NewListForm";
import SchoolLists, { type SeedOption } from "@/components/words/SchoolLists";
import { WORD_PACKS } from "@/lib/word-packs";
import { gradeOn } from "@/lib/grade";
import {
  READING_THEMES,
  SCIENCE_UNITS,
  scienceUnitForWeek,
  themeForWeek,
} from "@/lib/curriculum";
import { adultLockOn } from "@/lib/adult";
import { currentLearner } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { LEARNER_NAMES } from "@/lib/learners";
import { getPractice } from "@/lib/word-source";
import { todayKey } from "@/lib/day";
import { countKnowledge } from "@/lib/mastery";
import { type ClientWordList } from "@/lib/models/WordList";

export const dynamic = "force-dynamic";

const STATE_LABELS = [
  { key: "new", label: "New", color: "var(--color-faint)" },
  { key: "learning", label: "Learning", color: "var(--color-gold-dark)" },
  { key: "known", label: "Known", color: "var(--color-blue)" },
  { key: "mastered", label: "Mastered", color: "var(--color-green)" },
] as const;

function StateBar({ list }: { list: ClientWordList }) {
  const counts = countKnowledge(list.words);
  const total = list.words.length;
  if (total === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--color-muted)" }}>
        No words yet. Open it and add some.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      <div className="flex h-3 w-full overflow-hidden rounded-full" style={{ background: "var(--color-sand)" }}>
        {STATE_LABELS.map(({ key, color }) =>
          counts[key] > 0 ? (
            <span
              key={key}
              style={{ width: `${(counts[key] / total) * 100}%`, background: color }}
            />
          ) : null
        )}
      </div>
      <p className="text-sm" style={{ color: "var(--color-muted)" }}>
        {STATE_LABELS.filter(({ key }) => counts[key] > 0)
          .map(({ key, label }) => `${counts[key]} ${label.toLowerCase()}`)
          .join(" · ")}
      </p>
    </div>
  );
}

function seedOptions(lists: ClientWordList[]): SeedOption[] {
  const byName = new Map(lists.map((l) => [l.name, l._id]));
  const todayISO = todayKey();
  const currentScience = scienceUnitForWeek(todayISO);
  const currentTheme = themeForWeek(todayISO);

  const all: SeedOption[] = [
    // Skill packs first and "current": these are the words he is missing right
    // now, not a unit that comes round on the calendar. A later grade's pack
    // waits at the bottom until he is in that grade.
    ...WORD_PACKS.map((p) => ({
      kind: "pack" as const,
      id: p.id,
      title: p.name,
      wordCount: p.words.length,
      current: !p.grade || p.grade <= gradeOn(todayISO),
      existingListId: byName.get(`School: ${p.name}`) ?? null,
    })),
    ...SCIENCE_UNITS.map((u) => ({
      kind: "science" as const,
      id: u.id,
      title: u.title,
      wordCount: u.words.length,
      current: currentScience?.id === u.id,
      existingListId: byName.get(`School: ${u.title}`) ?? null,
    })),
    ...READING_THEMES.map((t) => ({
      kind: "theme" as const,
      id: t.id,
      title: t.title,
      wordCount: t.words.length,
      current: currentTheme.id === t.id,
      existingListId: byName.get(`School: ${t.title}`) ?? null,
    })),
  ];
  // The unit he is on this week goes to the top; the rest keep school order.
  return [...all.filter((o) => o.current), ...all.filter((o) => !o.current)];
}

export default async function WordsPage() {
  await connectDB();
  // Everything, the Stuck-words pool included. This is the page where a wrong
  // AI translation gets corrected, so the pool has to be reachable here even
  // though it is deliberately hidden from the units strip and the daily beats.
  const lists = await getPractice();
  const me = await currentLearner();

  return (
    <AppShell>
      <header className="pt-4 pb-5">
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-display text-3xl font-bold">Word lists</h1>
          {adultLockOn() ? <LockButton /> : null}
        </div>
        <p className="mt-1 text-base" style={{ color: "var(--color-muted)" }}>
          Build the lists the children learn from. Tap a list to edit it.
        </p>
      </header>

      <div className="space-y-6">
        <NewListForm />

        <section className="space-y-3">
          <h2 className="font-display text-lg font-bold">Your lists</h2>
          {lists.length === 0 ? (
            <Card variant="soft" color="green">
              <p className="text-base">
                No lists yet. Add one above, or take a school list below.
              </p>
            </Card>
          ) : (
            <ul className="space-y-3">
              {lists.map((list) => (
                <li key={list._id}>
                  {/* The whole card opens the list: one big target, no row of
                      small buttons to miss on a phone. Delete lives inside. */}
                  <Link
                    href={`/me/lists/${list._id}`}
                    className="press-3d block rounded-card border bg-white p-4"
                    style={{ borderColor: "var(--color-line)", ["--btn-shade" as string]: "var(--color-line)" }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-display text-lg font-bold leading-tight">
                          {list.name.replace(/^School:\s*/i, "")}
                        </h3>
                        <p className="mt-0.5 text-sm" style={{ color: "var(--color-muted)" }}>
                          {list.words.length} words
                          {list.kind !== "pool" && list.addedBy !== me
                            ? ` · added by ${LEARNER_NAMES[list.addedBy]}`
                            : ""}
                        </p>
                      </div>
                      <span style={{ color: "var(--color-faint)" }}>
                        <Icon name="arrowRight" size={24} />
                      </span>
                    </div>
                    <div className="mt-3">
                      <StateBar list={list} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <SchoolLists options={seedOptions(lists)} />
      </div>
    </AppShell>
  );
}
