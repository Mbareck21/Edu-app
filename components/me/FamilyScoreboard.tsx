import Card from "@/components/ui/Card";
import Icon from "@/components/ui/Icon";
import ProgressBar from "@/components/ui/ProgressBar";
import type { AccentColor } from "@/components/ui/colors";

export type ScoreRow = {
  learner: string;
  name: string;
  xp: number;
  days: number;
  isMe: boolean;
};

const COLORS: AccentColor[] = ["blue", "purple"];

/**
 * Both children's XP this week. Friendly, not a ranking: the rows keep the
 * same order every week, and the headline is what they made together.
 */
export default function FamilyScoreboard({ rows }: { rows: ScoreRow[] }) {
  if (rows.length < 2) return null;
  const top = Math.max(1, ...rows.map((r) => r.xp));
  const together = rows.reduce((sum, r) => sum + r.xp, 0);

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
        This week, since Monday.
      </p>
      <ul className="mt-3 space-y-3">
        {rows.map((r, i) => {
          const color = COLORS[i % COLORS.length];
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
                  <p className="font-display text-sm font-bold">{r.xp} XP</p>
                </div>
                <ProgressBar value={r.xp / top} color={color} height={10} className="mt-1" />
                <p className="mt-1 text-[11px] font-bold" style={{ color: "var(--color-muted)" }}>
                  {r.days === 0 ? "Not played yet this week" : `Played ${r.days} ${r.days === 1 ? "day" : "days"}`}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
