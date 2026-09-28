import Card from "@/components/ui/Card";
import Icon from "@/components/ui/Icon";
import ProgressBar from "@/components/ui/ProgressBar";
import type { AccentColor } from "@/components/ui/colors";
import { PLAN_ORDER } from "@/lib/daily-plan";
import { pointsOf, rankRows, type Rivalry } from "@/lib/rivalry";
import { MIN_WIN_PTS, nudge } from "@/lib/scoreboard";

export type ScoreRow = {
  learner: string;
  name: string;
  /** Race points: today's XP after the 9:30 pm close, the halving and the cap. */
  xp: number;
  /** Every XP he earned today, all of which his level keeps. */
  earned: number;
  /** Beats of today's quest still to do: until 0 he cannot win the day. */
  questLeft: number;
  isMe: boolean;
};

const COLORS: AccentColor[] = ["blue", "purple"];

/**
 * Both children's race points today (see raceXp), a fresh race every day,
 * leader on top, with the XP each really earned beside them: calling race
 * points "XP" made them think XP had been taken away. Each keeps
 * his colour, gets a nudge to catch up or stay ahead, and shows his trophy
 * points: the days he is ahead in the tug of war (see lib/rivalry.ts). The
 * headline is what they made together.
 */
export default function FamilyScoreboard({
  rows,
  rivalry,
  closed,
}: {
  rows: ScoreRow[];
  rivalry: Rivalry;
  /** Past RACE_CLOSES: today's result is set. */
  closed: boolean;
}) {
  if (rows.length < 2) return null;
  const top = Math.max(1, ...rows.map((r) => r.xp));
  const together = rows.reduce((sum, r) => sum + r.xp, 0);
  const colorOf = new Map(rows.map((r, i) => [r.learner, COLORS[i % COLORS.length]]));
  const ranked = rankRows(rows, rivalry);
  const holder = rows.find((r) => r.learner === rivalry.holder);

  return (
    <Card className="mt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-bold">Family scoreboard</h2>
        <span
          className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold"
          style={{ background: "var(--color-gold-soft)", color: "var(--color-gold-ink)" }}
        >
          <Icon name="bolt" size={14} />
          {together} pts together
        </span>
      </div>
      <p className="mt-1 text-sm" style={{ color: "var(--color-muted)" }}>
        {closed
          ? "Race closed for tonight. A new race starts at midnight."
          : `Today, until 9:30 pm. To be in the race: the whole quest and ${MIN_WIN_PTS.toLocaleString("en-US")} pts. Mix it up: a repeat counts less.`}
      </p>
      <p className="mt-1 text-sm font-bold" style={{ color: "var(--color-gold-ink)" }}>
        {holder
          ? `🏆 ${holder.name} is ${rivalry.points} ${rivalry.points === 1 ? "day" : "days"} ahead. ${closed ? "Tonight's result is in." : `Win tonight to ${holder.isMe ? "add one" : "take one back"}!`}`
          : closed ? "🏆 Level on days." : "🏆 Level on days. Win tonight to go ahead!"}
      </p>
      <ul className="mt-3 space-y-3">
        {ranked.map((r) => {
          const color = colorOf.get(r.learner) ?? "blue";
          return (
            <li key={r.learner} className="flex items-center gap-3">
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-display text-lg font-bold"
                style={{ background: `var(--color-${color})`, color: "#fff" }}
                aria-hidden
              >
                {r.name.slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-display font-bold">
                    {r.name}
                    {r.isMe ? (
                      <span className="ml-1 text-xs" style={{ color: "var(--color-muted)" }}>
                        (you)
                      </span>
                    ) : null}
                  </p>
                  <p className="shrink-0 text-right font-display text-sm font-bold">
                    {r.xp} pts
                    <span className="ml-1 text-[11px]" style={{ color: "var(--color-muted)" }}>
                      · {r.earned} XP
                    </span>
                  </p>
                </div>
                {/* Days ahead, and the quest that has to be done to win tonight. */}
                <div className="mt-0.5 flex flex-wrap gap-1 text-xs font-bold">
                  <span
                    className="whitespace-nowrap rounded-full px-2 py-0.5"
                    style={{ background: "var(--color-gold-soft)", color: "var(--color-gold-ink)" }}
                    title="Days ahead"
                  >
                    🏆 {pointsOf(rivalry, r.learner)}
                  </span>
                  <span
                    className="whitespace-nowrap rounded-full px-2 py-0.5"
                    style={
                      r.questLeft === 0
                        ? { background: "var(--color-green-soft)", color: "var(--color-green-dark)" }
                        : { background: "var(--color-line)", color: "var(--color-muted)" }
                    }
                    title="Today's quest"
                  >
                    {r.questLeft === 0 ? "✓ quest done" : `quest ${PLAN_ORDER.length - r.questLeft}/${PLAN_ORDER.length}`}
                  </span>
                </div>
                <ProgressBar value={r.xp / top} color={color} height={10} className="mt-1.5" />
                <p className="mt-1 text-[11px] font-bold" style={{ color: "var(--color-muted)" }}>
                  {nudge(r, rows)}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
