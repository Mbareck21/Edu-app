import Card from "@/components/ui/Card";
import Icon from "@/components/ui/Icon";
import ProgressBar from "@/components/ui/ProgressBar";
import type { AccentColor } from "@/components/ui/colors";

export type DuelRow = {
  learner: string;
  name: string;
  /** Drill points this week. */
  points: number;
  isMe: boolean;
};

const COLORS: AccentColor[] = ["blue", "purple"];

/**
 * The brothers' drill duel: drill points since Monday, and a trophy for last
 * week's winner. The rows keep the same order every week, like the scoreboard.
 */
export default function DrillDuel({ rows, lastWinner }: { rows: DuelRow[]; lastWinner: string | null }) {
  if (rows.length < 2) return null;
  const top = Math.max(1, ...rows.map((r) => r.points));
  const leader = rows.filter((r) => r.points === top && r.points > 0);

  return (
    <Card className="mt-3">
      <h2 className="font-display text-lg font-bold">Drill duel</h2>
      <p className="mt-1 text-sm" style={{ color: "var(--color-muted)" }}>
        This week
        {lastWinner ? (
          <>
            {" · last week "}
            <span className="inline-flex items-center gap-1">
              <Icon name="trophy" size={14} />
              {lastWinner}
            </span>
          </>
        ) : null}
      </p>
      <ul className="mt-3 space-y-3">
        {rows.map((r, i) => (
          <li key={r.learner}>
            <div className="flex items-baseline justify-between gap-2">
              <p className="font-display font-bold">
                {leader.length === 1 && leader[0] === r ? (
                  <span className="mr-1 inline-flex items-center" style={{ color: "var(--color-gold-ink)" }}>
                    <Icon name="trophy" size={14} />
                  </span>
                ) : null}
                {r.name}
                {r.isMe ? (
                  <span className="ml-1 text-xs" style={{ color: "var(--color-muted)" }}>
                    (you)
                  </span>
                ) : null}
              </p>
              <p className="font-display text-sm font-bold">{r.points} pts</p>
            </div>
            <ProgressBar value={r.points / top} color={COLORS[i % COLORS.length]} height={10} className="mt-1" />
          </li>
        ))}
      </ul>
    </Card>
  );
}
