import Link from "next/link";

import SchoolStrip from "@/components/learn/SchoolStrip";
import TodayQuest from "@/components/learn/TodayQuest";
import { raceClosed, raceXp } from "@/lib/scoreboard";
import UnitCard from "@/components/learn/UnitCard";
import PetCard from "@/components/pet/PetCard";
import AppShell from "@/components/ui/AppShell";
import { buttonClass, buttonStyle } from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Icon from "@/components/ui/Icon";
import TopBar from "@/components/ui/TopBar";
import { currentLearner } from "@/lib/auth";
import { todayKey } from "@/lib/day";
import { db } from "@/lib/db";
import { asWord, planBeats, unitOf } from "@/lib/daily-plan-beats";
import { levelsOf } from "@/lib/daily-plan-data";
import { getListSummaries } from "@/lib/lists";
import { skillsKnowledge, uniqueWords } from "@/lib/mastery";
import { growthPoints, mathLevelsUp, petMood, type Growth } from "@/lib/pet";
import { getProfile } from "@/lib/profile";
import { goalBeats, shownStreak } from "@/lib/rewards";

export const dynamic = "force-dynamic";

export const metadata = { title: "Learn" };

export default async function LearnPage() {
  const { MathProgress } = await db();
  const [profile, lists, learner, mathRows] = await Promise.all([
    getProfile(),
    getListSummaries(),
    currentLearner(),
    MathProgress.find().select("skill level").lean(),
  ]);

  const unit = unitOf(lists);
  const today = todayKey(new Date());
  const beats = planBeats({
    activity: profile.activity,
    lists,
    mathLevels: levelsOf(mathRows),
    today,
  });

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

  return (
    <AppShell>
      <TopBar
        name={profile.name}
        xp={profile.xp}
        streak={shownStreak(profile.streak, today)}
        subtitle={beats.every((b) => b.done) ? "All done today. Great work!" : "Time to learn some words."}
        className="pt-3 pb-3"
      />

      <div className="space-y-3">
        <PetCard
          learner={learner}
          growth={growth}
          points={growthPoints(growth)}
          mood={petMood(lessonsToday, beats.filter((b) => b.done).length, goalBeats(profile.dailyGoal))}
        />
        <TodayQuest
          beats={beats}
          today={today}
          race={{ pts: raceXp(profile.activity, today), closed: raceClosed(new Date()) }}
        />
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
