import AppShell from "@/components/ui/AppShell";
import Card from "@/components/ui/Card";
import Icon, { type IconName } from "@/components/ui/Icon";
import Pill from "@/components/ui/Pill";
import ProgressRing from "@/components/ui/ProgressRing";
import ProfileSettings from "@/components/ProfileSettings";
import { lastSevenDays, todayKey } from "@/lib/day";
import { connectDB } from "@/lib/db";
import { countKnowledge } from "@/lib/mastery";
import { toClientProfile } from "@/lib/models/Profile";
import { WordList, toClient, type ClientWord } from "@/lib/models/WordList";
import { getProfile } from "@/lib/profile";
import { BADGES } from "@/lib/rewards";

export const dynamic = "force-dynamic";

export const metadata = { title: "Me" };

const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

function Stat({
  icon,
  value,
  label,
  color,
}: {
  icon: IconName;
  value: string | number;
  label: string;
  color: string;
}) {
  return (
    <div
      className="flex-1 rounded-card border px-2 py-3 text-center"
      style={{ borderColor: "var(--color-line)", background: "#fff" }}
    >
      <span className="inline-flex justify-center" style={{ color }}>
        <Icon name={icon} size={22} />
      </span>
      <p className="mt-1 font-display text-xl font-bold leading-none">{value}</p>
      <p
        className="mt-1 text-[11px] font-bold uppercase tracking-wide"
        style={{ color: "var(--color-muted)" }}
      >
        {label}
      </p>
    </div>
  );
}

export default async function MePage() {
  const state = await getProfile();
  const profile = toClientProfile(state);

  await connectDB();
  const docs = await WordList.find().lean();
  const words: ClientWord[] = docs.flatMap((doc) => toClient(doc).words);
  const counts = countKnowledge(words);
  const wordsKnown = counts.known + counts.mastered;

  const now = new Date();
  const today = todayKey(now);
  const week = lastSevenDays(today);
  const activeDays = new Set(profile.activity.map((a) => todayKey(new Date(a.at))));

  const earned = new Map(profile.badges.map((b) => [b.id, b.earnedAt]));

  return (
    <AppShell>
      <h1 className="pt-4 pb-3 font-display text-2xl font-bold">Me</h1>

      {/* Level hero */}
      <Card variant="dark" className="flex items-center gap-4">
        <ProgressRing
          value={profile.needed > 0 ? profile.into / profile.needed : 0}
          size={104}
          stroke={11}
          color="gold"
          trackColor="var(--color-night-soft)"
        >
          <span className="font-display text-3xl font-bold leading-none">
            {profile.level}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-widest opacity-70">
            Level
          </span>
        </ProgressRing>
        <div className="min-w-0 flex-1">
          <p className="font-display text-xl font-bold">{profile.name}</p>
          <p className="text-sm opacity-80">
            {profile.into} / {profile.needed} XP to level {profile.level + 1}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Pill color="gold" icon="bolt" variant="solid" size="sm">
              {profile.xp} XP
            </Pill>
            <Pill color="flame" icon="flame" variant="solid" size="sm">
              {profile.streak.current} day
            </Pill>
          </div>
        </div>
      </Card>

      {/* Stats */}
      <div className="mt-3 flex gap-2">
        <Stat
          icon="flame"
          value={profile.streak.current}
          label="Streak"
          color="var(--color-flame)"
        />
        <Stat icon="bolt" value={profile.xp} label="XP" color="var(--color-gold-ink)" />
        <Stat
          icon="book"
          value={wordsKnown}
          label="Words known"
          color="var(--color-green)"
        />
      </div>

      {/* Words breakdown */}
      <Card className="mt-3">
        <h2 className="font-display text-lg font-bold">Words</h2>
        <p className="mt-1 text-sm" style={{ color: "var(--color-muted)" }}>
          A word is known when you can hear it, read it, spell it and use it.
        </p>
        <div className="mt-3 grid grid-cols-4 gap-2 text-center">
          {(
            [
              { label: "New", n: counts.new, color: "var(--color-muted)" },
              { label: "Learning", n: counts.learning, color: "var(--color-blue)" },
              { label: "Known", n: counts.known, color: "var(--color-green)" },
              { label: "Mastered", n: counts.mastered, color: "var(--color-purple)" },
            ] as const
          ).map((b) => (
            <div key={b.label} className="rounded-tile py-2" style={{ background: "var(--color-sand)" }}>
              <p className="font-display text-lg font-bold leading-none" style={{ color: b.color }}>
                {b.n}
              </p>
              <p className="mt-1 text-[11px] font-bold" style={{ color: "var(--color-muted)" }}>
                {b.label}
              </p>
            </div>
          ))}
        </div>
      </Card>

      {/* This week */}
      <Card className="mt-3">
        <h2 className="font-display text-lg font-bold">This week</h2>
        <div className="mt-3 flex justify-between">
          {week.map((day) => {
            const on = activeDays.has(day);
            const isToday = day === today;
            const letter = DAY_LETTERS[new Date(`${day}T00:00:00Z`).getUTCDay()];
            return (
              <div key={day} className="flex flex-col items-center gap-1">
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-full border-2"
                  style={{
                    background: on ? "var(--color-green)" : "#fff",
                    borderColor: isToday
                      ? "var(--color-green)"
                      : on
                        ? "var(--color-green)"
                        : "var(--color-line)",
                    color: on ? "#fff" : "var(--color-faint)",
                  }}
                >
                  {on ? <Icon name="check" size={20} strokeWidth={3} /> : null}
                </span>
                <span className="text-[11px] font-bold" style={{ color: "var(--color-muted)" }}>
                  {letter}
                </span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Badges */}
      <Card className="mt-3">
        <h2 className="font-display text-lg font-bold">Badges</h2>
        <p className="mt-1 text-sm" style={{ color: "var(--color-muted)" }}>
          {earned.size} of {BADGES.length}
        </p>
        <ul className="mt-3 grid grid-cols-3 gap-3">
          {BADGES.map((badge) => {
            const got = earned.has(badge.id);
            return (
              <li key={badge.id} className="text-center">
                <span
                  className="mx-auto flex h-16 w-16 items-center justify-center rounded-full"
                  style={{
                    background: got ? "var(--color-gold-soft)" : "var(--color-sand)",
                    color: got ? "var(--color-gold-ink)" : "var(--color-faint)",
                  }}
                >
                  <Icon name={got ? badge.icon : "lock"} size={30} />
                </span>
                <p className="mt-1 font-display text-xs font-bold leading-tight">
                  {badge.name}
                </p>
                <p className="text-[11px] leading-tight" style={{ color: "var(--color-muted)" }}>
                  {badge.blurb}
                </p>
              </li>
            );
          })}
        </ul>
      </Card>

      {/* Settings */}
      <Card className="mt-3 mb-4">
        <h2 className="mb-3 font-display text-lg font-bold">Settings</h2>
        <ProfileSettings name={profile.name} dailyGoal={profile.dailyGoal} />
      </Card>
    </AppShell>
  );
}
