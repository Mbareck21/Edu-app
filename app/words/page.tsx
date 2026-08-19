import Link from "next/link";

import AppShell from "@/components/ui/AppShell";
import Card from "@/components/ui/Card";
import Icon from "@/components/ui/Icon";
import { buttonClass, buttonStyle } from "@/components/ui/Button";
import DeleteListButton from "@/components/words/DeleteListButton";
import NewListForm from "@/components/words/NewListForm";
import SchoolLists, { type SeedOption } from "@/components/words/SchoolLists";
import {
  READING_THEMES,
  SCIENCE_UNITS,
  scienceUnitForWeek,
  themeForWeek,
} from "@/lib/curriculum";
import { connectDB } from "@/lib/db";
import { countKnowledge } from "@/lib/mastery";
import { WordList, toClient, type ClientWordList } from "@/lib/models/WordList";

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

function PrintLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="press-3d inline-flex h-11 items-center rounded-full border-2 px-4 font-display text-sm font-bold"
      style={{
        borderColor: "var(--color-line)",
        background: "#fff",
        color: "var(--color-ink)",
        ["--btn-shade" as string]: "var(--color-line)",
      }}
    >
      {label}
    </Link>
  );
}

function seedOptions(lists: ClientWordList[]): SeedOption[] {
  const byName = new Map(lists.map((l) => [l.name, l._id]));
  const todayISO = new Date().toISOString().slice(0, 10);
  const currentScience = scienceUnitForWeek(todayISO);
  const currentTheme = themeForWeek(todayISO);

  const all: SeedOption[] = [
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
  const docs = await WordList.find().sort({ updatedAt: -1 }).lean();
  const lists = docs.map(toClient);

  return (
    <AppShell>
      <header className="pt-4 pb-5">
        <h1 className="font-display text-3xl font-bold">Words</h1>
        <p className="mt-1 text-base" style={{ color: "var(--color-muted)" }}>
          Build the lists he learns from, and print worksheets.
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
                  <Card>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-display text-lg font-bold leading-tight">
                          {list.name}
                        </h3>
                        <p className="text-sm" style={{ color: "var(--color-muted)" }}>
                          {list.words.length} words · reading level {list.readingLevel}
                        </p>
                      </div>
                      <span style={{ color: "var(--color-faint)" }}>
                        <Icon name="words" size={24} />
                      </span>
                    </div>

                    <div className="mt-3">
                      <StateBar list={list} />
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link
                        href={`/words/${list._id}`}
                        className={buttonClass({ size: "md", color: "green" })}
                        style={buttonStyle({ color: "green" })}
                      >
                        <Icon name="edit" size={18} />
                        Edit
                      </Link>
                      <DeleteListButton id={list._id} name={list.name} />
                    </div>

                    <div className="mt-3">
                      <p
                        className="mb-2 text-xs font-bold uppercase tracking-wide"
                        style={{ color: "var(--color-muted)" }}
                      >
                        Print
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <PrintLink href={`/lists/${list._id}/crossword`} label="Crossword" />
                        <PrintLink href={`/lists/${list._id}/scramble`} label="Scramble" />
                        <PrintLink href={`/lists/${list._id}/wordsearch`} label="Word search" />
                      </div>
                    </div>
                  </Card>
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
