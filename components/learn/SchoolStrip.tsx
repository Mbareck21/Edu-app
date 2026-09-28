import Link from "next/link";

import Icon from "@/components/ui/Icon";
import { elaFocus, SCHOOL_YEAR_END, scienceUnitForWeek } from "@/lib/curriculum";
import { todayKey } from "@/lib/day";
import { currentLesson, currentUnit } from "@/lib/math";

/** First clause only — the strip has one line per subject. Cut between words. */
function shortPlain(plain: string): string {
  const cut = plain.split(/[:,]| [-—–] /)[0].trim();
  if (cut.length <= 66) return cut;
  return `${cut.slice(0, 64).replace(/\s+\S*$/, "")}…`;
}

/**
 * "At school now": what his class is on this week, in plain words.
 * Small on purpose — it frames the work, it is not the work.
 *
 * Only what the district publishes: the science unit and the quarter's ELA
 * standards and math units from its Year-at-a-Glance sheets. The reading unit
 * and its week came from the publisher's order, not the school's (the unit
 * plans need an FPS login), and shown as fact it looked wrong to the parent.
 * The app still uses that order quietly, to pick story topics.
 */
export default function SchoolStrip({ href }: { href: string }) {
  const today = todayKey();
  // After the last school day the calendar would stop on the final unit.
  if (today > SCHOOL_YEAR_END) return null;
  const ela = elaFocus(today);
  const math = currentUnit(today);
  const lesson = currentLesson(today);
  const science = scienceUnitForWeek(today);

  return (
    <section
      className="rounded-card border px-3 py-2.5"
      style={{ borderColor: "var(--color-line)", background: "var(--color-sand)" }}
    >
      <p
        className="font-display text-[11px] font-bold uppercase tracking-widest"
        style={{ color: "var(--color-muted)" }}
      >
        At school now
      </p>
      <div className="mt-1">
        {science ? (
          <Link href={href} className="flex min-h-11 items-center gap-2">
            <span className="shrink-0" style={{ color: "var(--color-green)" }}>
              <Icon name="book" size={16} />
            </span>
            <span className="min-w-0 flex-1 font-body text-sm leading-snug">Science: {science.title}</span>
          </Link>
        ) : null}
        <Link href={href} className="flex min-h-11 items-center gap-2">
          <span className="shrink-0" style={{ color: "var(--color-green)" }}>
            <Icon name="star" size={16} />
          </span>
          <span className="min-w-0 flex-1 font-body text-sm leading-snug">
            {ela.length > 0
              ? `Reading: ${ela.map((s) => shortPlain(s.plain)).join(" · ")}`
              : "Summer break. Keep reading."}
          </span>
        </Link>
        <Link href="/math" className="flex min-h-11 items-center gap-2">
          <span className="shrink-0" style={{ color: "var(--color-purple)" }}>
            <Icon name="math" size={16} />
          </span>
          <span className="min-w-0 flex-1 font-body text-sm leading-snug">
            Math: {math.name} · Lesson {lesson.lesson}: {lesson.title}
          </span>
        </Link>
      </div>
    </section>
  );
}

export { SchoolStrip };
