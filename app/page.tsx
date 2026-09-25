import Link from "next/link";

import SchoolStrip from "@/components/learn/SchoolStrip";
import TodayQuest, { type QuestBeat } from "@/components/learn/TodayQuest";
import { currentLesson } from "@/lib/math/iready";
import { getSkill, isMathLesson } from "@/lib/math";
import UnitCard from "@/components/learn/UnitCard";
import PetCard from "@/components/pet/PetCard";
import AppShell from "@/components/ui/AppShell";
import { buttonClass, buttonStyle } from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Icon from "@/components/ui/Icon";
import TopBar from "@/components/ui/TopBar";
import { currentLearner } from "@/lib/auth";
import { SCHOOL_YEAR_END } from "@/lib/curriculum";
import { todayKey } from "@/lib/day";
import { db } from "@/lib/db";
import { isNewWord } from "@/lib/lesson-builder";
import { getListSummaries, type SummaryWord } from "@/lib/lists";
import { skillsKnowledge, uniqueWords } from "@/lib/mastery";
import type { ClientWord } from "@/lib/models/WordList";
import { growthPoints, mathLevelsUp, petMood, type Growth } from "@/lib/pet";
import { getProfile } from "@/lib/profile";
import { shownStreak } from "@/lib/rewards";

export const dynamic = "force-dynamic";

export const metadata = { title: "Learn" };

/**
 * A summary carries a word's skills but not its SRS state. The whole-word
 * helpers used here read only the skills plus reviewCount, and a word with no
 * skill answered has no review either, so 0 stands in for it.
 */
function asWord(w: SummaryWord): ClientWord {
  return { ...w, srs: { reviewCount: 0 } } as unknown as ClientWord;
}

export default async function LearnPage() {
  const { MathProgress } = await db();
  const [profile, lists, learner, mathRows] = await Promise.all([
    getProfile(),
    getListSummaries(),
    currentLearner(),
    MathProgress.find().select("level").lean(),
  ]);

  // The unit in play: the newest list that still has a word he has not met,
  // so the quest does not stall on a list he has finished.
  const unit =
    lists.find((l) => l.words.some((w) => isNewWord(asWord(w)))) ??
    lists.find((l) => l.words.length > 0) ??
    lists[0] ??
    null;
  const today = todayKey(new Date());
  // After the last school day the calendar stops on the final Grade 4 unit.
  const schoolOver = today > SCHOOL_YEAR_END;
  const doneToday = profile.activity.filter((a) => todayKey(new Date(a.at)) === today);
  const didRef = (ref: string) => doneToday.some((a) => a.ref === ref);

  // The maths his class is on today, so the quest points at school rather than
  // at whatever he played last. His day was covering reading and vocabulary but
  // never asking for maths at all.
  const lesson = currentLesson(today);
  // A lesson usually maps to more than one skill, and he has been grinding
  // place value for a week. Rotate by the date so the day picks a different one
  // of that lesson's skills — deterministic, so the page stays pure.
  const dayIndex = Number(today.slice(8, 10)) + Number(today.slice(5, 7)) * 31;
  const schoolSkill = getSkill(
    lesson.skills[dayIndex % Math.max(1, lesson.skills.length)] ?? "place-value"
  );

  // Sparky grows with words known and math levels gained, never with XP.
  // The same word on two lists counts once.
  const knowledge = uniqueWords(lists.flatMap((l) => l.words.map(asWord))).map((w) =>
    skillsKnowledge(w.skills)
  );
  const growth: Growth = {
    wordsKnown: knowledge.filter(Boolean).length,
    wordsMastered: knowledge.filter((k) => k === "mastered").length,
    mathLevelsUp: mathLevelsUp(mathRows.map((r) => Number(r.level) || 1), today),
  };
  const lessonsToday = profile.today.day === today ? profile.today.lessons : 0;

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
      done: doneToday.some(
        (a) =>
          (a.kind === "reading" && a.ref !== "read:structure") ||
          a.ref.endsWith(":read")
      ),
    },
    {
      id: "structure",
      name: "Text structure",
      blurb: "How is it built?",
      icon: "words",
      href: "/learn/structure",
      done: didRef("read:structure"),
    },
    {
      id: "math",
      name: "Math",
      blurb: schoolOver ? "Practice" : schoolSkill.name,
      icon: "math",
      href: schoolOver ? "/math" : `/math/${schoolSkill.id}`,
      // A whole math lesson (any skill), not a quick drill or a tables round:
      // two answers in a drill used to tick the beat.
      done: doneToday.some((a) => a.kind === "math" && isMathLesson(a.ref)),
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
        streak={shownStreak(profile.streak, today)}
        subtitle="Time to learn some words."
        className="pt-3 pb-3"
      />

      <div className="space-y-3">
        <PetCard
          learner={learner}
          growth={growth}
          points={growthPoints(growth)}
          mood={petMood(lessonsToday, profile.dailyGoal)}
        />
        <TodayQuest beats={beats} />
        <SchoolStrip href={unit ? `/learn/${unit._id}` : "/me/lists"} />

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
              Make a list in Me, and the quest starts.
            </p>
            <Link
              href="/me/lists"
              className={buttonClass({ color: "blue", size: "lg", fullWidth: true })}
              style={buttonStyle({ color: "blue" })}
            >
              Make a list
            </Link>
          </Card>
        ) : (
          <>
            <h2 className="pt-2 font-display text-lg font-bold">Your units</h2>
            {lists.slice(0, 3).map((list) => (
              <UnitCard key={list._id} list={list} />
            ))}
            {lists.length > 3 ? (
              <details className="group">
                <summary
                  className="cursor-pointer list-none py-1 text-center font-display text-sm font-bold group-open:hidden [&::-webkit-details-marker]:hidden"
                  style={{ color: "var(--color-blue-dark)" }}
                >
                  Show all {lists.length} units
                </summary>
                <div className="space-y-3">
                  {lists.slice(3).map((list) => (
                    <UnitCard key={list._id} list={list} />
                  ))}
                </div>
              </details>
            ) : null}
          </>
        )}
      </div>
    </AppShell>
  );
}
