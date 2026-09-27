import Card from "@/components/ui/Card";
import Icon from "@/components/ui/Icon";
import ProgressBar from "@/components/ui/ProgressBar";
import type { AccentColor } from "@/components/ui/colors";
import { pointsOf, rankRows, type Rivalry } from "@/lib/rivalry";
import { nudge } from "@/lib/scoreboard";

export type ScoreRow = {
  learner: string;
  name: string;
  xp: number;
  isMe: boolean;
};

const COLORS: AccentColor[] = ["blue", "purple"];

/**
 * Both children's XP today, a fresh race every day, leader on top. Each keeps
 * his colour, gets a nudge to catch up or stay ahead, and shows his trophy
 * points: the days he is ahead in the tug of war (see lib/rivalry.ts). The
 * headline is what they made together.
 */
export default function FamilyScoreboard({ rows, rivalry }: { rows: ScoreRow[]; rivalry: Rivalry }) {
  if (rows.length < 2) return null;
  const top = Math.max(1, ...rows.map((r) => r.xp));
  const together = rows.reduce((sum, r) => sum + r.xp, 0);
  const colorOf = new Map(rows.map((r, i) => [r.learner, COLORS[i % COLORS.length]]));
  const ranked = rankRows(rows, rivalry);
  const holder = rows.find((r) => r.learner === rivalry.holder);

  return (
    <Card className="mt-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-lg font-bold">Family scoreboard</h2>
        <span
          className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold"
          style={{ background: "var(--color-gold-soft)", color: "var(--color-gold-ink)" }}
        >
          <Icon name="bolt" size={14} />
          {together} XP together
        </span>
      </div>
      <p className="mt-1 text-sm" style={{ color: "var(--color-muted)" }}>
        Today. A new race starts at midnight.
      </p>
      <p className="mt-1 text-sm font-bold" style={{ color: "var(--color-gold-ink)" }}>
        {holder
          ? `🏆 ${holder.name} is ${rivalry.points} ${rivalry.points === 1 ? "day" : "days"} ahead. Win tonight to ${holder.isMe ? "add one" : "take one back"}!`
          : "🏆 Level on days. Win tonight to go ahead!"}
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
                    <span
                      className="ml-2 rounded-full px-2 py-0.5 text-xs"
                      style={{ background: "var(--color-gold-soft)", color: "var(--color-gold-ink)" }}
                      title="Days ahead"
                    >
                      🏆 {pointsOf(rivalry, r.learner)}
                    </span>
                  </p>
                  <p className="font-display text-sm font-bold">{r.xp} XP</p>
                </div>
                <ProgressBar value={r.xp / top} color={color} height={10} className="mt-1" />
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
