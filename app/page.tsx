import Link from "next/link";

import SchoolStrip from "@/components/learn/SchoolStrip";
import TodayQuest, { type QuestBeat } from "@/components/learn/TodayQuest";
import UnitCard from "@/components/learn/UnitCard";
import AppShell from "@/components/ui/AppShell";
import { buttonClass, buttonStyle } from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Icon from "@/components/ui/Icon";
import TopBar from "@/components/ui/TopBar";
import { todayKey } from "@/lib/day";
import { connectDB } from "@/lib/db";
import { WordList, toClient } from "@/lib/models/WordList";
import { getProfile } from "@/lib/profile";

export const dynamic = "force-dynamic";

export const metadata = { title: "Learn" };

export default async function LearnPage() {
  const profile = await getProfile();
  await connectDB();
  const docs = await WordList.find().sort({ updatedAt: -1 }).lean();
  const lists = docs.map(toClient);

  // The unit in play: the list the parent touched last.
  const unit = lists.find((l) => l.words.length > 0) ?? lists[0] ?? null;
  const today = todayKey(new Date());
  const doneToday = profile.activity.filter((a) => todayKey(new Date(a.at)) === today);
  const didRef = (ref: string) => doneToday.some((a) => a.ref === ref);

  const beats: QuestBeat[] = [
    {
      id: "review",
      name: "Review",
      blurb: "Words that are due",
      icon: "clock",
      href: unit ? "/learn/today/review" : null,
      done: didRef("quest:review"),
    },
    {
      id: "new",
      name: "New words",
      blurb: "Three new words",
      icon: "sparkles",
      href: unit ? "/learn/today/new-words" : null,
      done: didRef("quest:new"),
    },
    {
      id: "read",
      name: "Reading",
      blurb: "Read, then answer",
      icon: "book",
      href: unit ? `/learn/${unit._id}/read` : null,
      done: doneToday.some((a) => a.kind === "reading" || a.ref.endsWith(":read")),
    },
    {
      id: "production",
      name: "Write and use",
      blurb: "Spell it, then use it",
      icon: "edit",
      href: unit ? "/learn/today/production" : null,
      done: didRef("quest:production"),
    },
  ];

  return (
    <AppShell>
      <TopBar
        name={profile.name}
        xp={profile.xp}
        streak={profile.streak.current}
        subtitle="Time to learn some words."
        className="pt-3 pb-3"
      />

      <div className="space-y-3">
        <TodayQuest beats={beats} />
        <SchoolStrip href={unit ? `/learn/${unit._id}` : "/words"} />

        {lists.length === 0 ? (
          <Card className="space-y-3 text-center">
            <span
              className="mx-auto flex h-14 w-14 items-center justify-center rounded-full"
              style={{ background: "var(--color-blue-soft)", color: "var(--color-blue-dark)" }}
            >
              <Icon name="words" size={28} />
            </span>
            <p className="font-display text-lg font-bold">No word lists yet</p>
            <p className="font-body text-sm" style={{ color: "var(--color-muted)" }}>
              Make a list in the Words tab. Then the quest starts.
            </p>
            <Link
              href="/words"
              className={buttonClass({ color: "blue", size: "lg", fullWidth: true })}
              style={buttonStyle({ color: "blue" })}
            >
              Go to Words
            </Link>
          </Card>
        ) : (
          <>
            <h2 className="pt-2 font-display text-lg font-bold">Your units</h2>
            {lists.map((list) => (
              <UnitCard key={list._id} list={list} />
            ))}
          </>
        )}
      </div>
    </AppShell>
  );
}
