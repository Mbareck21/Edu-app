import Card from "@/components/ui/Card";
import Icon from "@/components/ui/Icon";
import { todayKey } from "@/lib/day";
import { gradeOn } from "@/lib/grade";
import { maxReadingLevel } from "@/lib/reading";
import { READING_UP_PCT, READING_UP_RUN, type ReadingProgress } from "@/lib/rewards";

/** Stars for one reading: 3 all right, 2 a good one, 1 some right, 0 a miss. */
export function readingStars(pct: number): number {
  if (pct >= 100) return 3;
  if (pct >= READING_UP_PCT) return 2;
  if (pct >= 50) return 1;
  return 0;
}

function Stars({ n }: { n: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${n} of 3 stars`}>
      {[0, 1, 2].map((i) => (
        <span key={i} style={{ color: i < n ? "var(--color-gold)" : "var(--color-line)" }}>
          <Icon name="star" size={16} filled={i < n} />
        </span>
      ))}
    </span>
  );
}

/**
 * His reading in words he understands: his level, how many good readings in a
 * row the next level needs (circles that fill), and stars for his last reads.
 */
export default function ReadingProgressCard({ progress }: { progress: ReadingProgress }) {
  const { level, goodInARow, toNext, scores, thisWeek } = progress;
  const top = maxReadingLevel(gradeOn(todayKey()));
  const recent = scores.slice(-6).reverse(); // newest first
  return (
    <Card className="mt-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="inline-flex items-center gap-1 font-display text-lg font-bold">
          <span style={{ color: "var(--color-green-dark)" }}>
            <Icon name="book" size={20} />
          </span>
          <span>
            Reading level {level} <span className="text-sm font-normal" style={{ color: "var(--color-muted)" }}>of {top}</span>
          </span>
        </h2>
        <p className="text-sm" style={{ color: "var(--color-muted)" }}>
          {thisWeek} this week
        </p>
      </div>

      {toNext === 0 ? (
        <p className="mt-3 inline-flex items-center gap-1 font-display font-bold" style={{ color: "var(--color-green-dark)" }}>
          <Icon name="trophy" size={20} />
          Top level! Keep reading.
        </p>
      ) : (
        <>
          <div className="mt-3 flex items-center gap-2" aria-label={`${goodInARow} of ${READING_UP_RUN} good readings`}>
            {Array.from({ length: READING_UP_RUN }, (_, i) => (
              <span
                key={i}
                className="flex h-9 w-9 items-center justify-center rounded-full border-2 font-display text-sm font-bold"
                style={
                  i < goodInARow
                    ? { background: "var(--color-green)", borderColor: "var(--color-green)", color: "#fff" }
                    : { borderColor: "var(--color-line)", color: "var(--color-faint)" }
                }
              >
                {i < goodInARow ? <Icon name="check" size={18} strokeWidth={3} /> : i + 1}
              </span>
            ))}
            <span className="ml-1">
              <Icon name="arrowRight" size={24} />
            </span>
            <span className="font-display font-bold">Level {level + 1}</span>
          </div>
          <p className="mt-2 text-sm">
            <strong>
              {toNext} more good {toNext === 1 ? "reading" : "readings"} in a row!
            </strong>{" "}
            <span style={{ color: "var(--color-muted)" }}>A good reading is 3 of every 4 right.</span>
          </p>
        </>
      )}

      {recent.length > 0 ? (
        <div className="mt-4">
          <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>
            Your last readings
          </p>
          <ul className="mt-2 grid grid-cols-3 gap-2">
            {recent.map((pct, i) => (
              <li
                key={i}
                className="flex flex-col items-center rounded-tile border-2 py-2"
                style={{
                  background: "var(--color-sand)",
                  borderColor: i === 0 ? "var(--color-green)" : "transparent",
                }}
              >
                <Stars n={readingStars(pct)} />
                <span className="mt-1 text-[11px] font-bold" style={{ color: "var(--color-muted)" }}>
                  {i === 0 ? `Latest · ${pct}%` : `${pct}%`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}
