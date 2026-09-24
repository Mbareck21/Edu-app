import Card from "@/components/ui/Card";
import ProgressBar from "@/components/ui/ProgressBar";
import { READING_UP_PCT, READING_UP_RUN, type ReadingProgress } from "@/lib/rewards";

/** Little bars, oldest on the left, so he can see the line going up. */
function Bars({ values, max, good }: { values: number[]; max: number; good: (v: number) => boolean }) {
  return (
    <div className="mt-2 flex h-16 items-end gap-1.5" aria-hidden>
      {values.map((v, i) => (
        <div
          key={i}
          className="w-6 rounded-t-md"
          style={{
            height: `${Math.max(8, Math.round((v / max) * 100))}%`,
            background: good(v) ? "var(--color-green)" : "var(--color-gold)",
            opacity: i === values.length - 1 ? 1 : 0.75,
          }}
        />
      ))}
    </div>
  );
}

/**
 * His reading, where he can see it: the level, how close the next one is, his
 * last scores and his reading speed. Before this the ladder moved in silence.
 */
export default function ReadingProgressCard({ progress }: { progress: ReadingProgress }) {
  const { level, goodInARow, toNext, scores, wpms, thisWeek } = progress;
  const lastWpm = wpms[wpms.length - 1];
  const bestWpm = wpms.length > 0 ? Math.max(...wpms) : 0;
  return (
    <Card className="mt-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-display text-lg font-bold">Reading level {level}</h2>
        <p className="text-sm" style={{ color: "var(--color-muted)" }}>
          {thisWeek} this week
        </p>
      </div>
      <ProgressBar value={goodInARow / READING_UP_RUN} color="green" height={10} className="mt-2" />
      <p className="mt-2 text-sm">
        {toNext === 0
          ? "Top level. Keep reading!"
          : `${toNext} more good ${toNext === 1 ? "reading" : "readings"} to level ${level + 1}.`}{" "}
        <span style={{ color: "var(--color-muted)" }}>Good means 3 of 4 right.</span>
      </p>

      {scores.length > 0 ? (
        <div className="mt-4">
          <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>
            Your last readings
          </p>
          <Bars values={scores} max={100} good={(v) => v >= READING_UP_PCT} />
        </div>
      ) : null}

      {wpms.length > 0 ? (
        <div className="mt-4">
          <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>
            Reading speed
          </p>
          <p className="mt-1 text-sm">
            <strong className="font-display">{lastWpm}</strong> words a minute last time · best{" "}
            <strong className="font-display">{bestWpm}</strong>
          </p>
          {wpms.length > 1 ? <Bars values={wpms} max={bestWpm} good={() => true} /> : null}
        </div>
      ) : null}
    </Card>
  );
}
