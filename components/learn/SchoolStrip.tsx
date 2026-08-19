import Link from "next/link";

import Icon from "@/components/ui/Icon";
import { ELA_STANDARDS, currentQuarter, scienceUnitForWeek } from "@/lib/curriculum";
import { currentUnit } from "@/lib/math";

/** First clause only — the strip has one line per subject. */
function shortPlain(plain: string): string {
  const cut = plain.split(/[:,]/)[0].trim();
  return cut.length > 62 ? `${cut.slice(0, 59).trimEnd()}…` : cut;
}

/**
 * "At school now": what his class is on this week, in plain words.
 * Small on purpose — it frames the work, it is not the work.
 */
export default function SchoolStrip({ href }: { href: string }) {
  const today = new Date().toISOString().slice(0, 10);
  const quarter = currentQuarter(today);
  const ela = ELA_STANDARDS.filter(
    (s) => quarter !== "summer" && s.quarters.includes(quarter)
  ).slice(0, 2);
  const math = currentUnit(today);
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
      <div className="mt-1.5 space-y-1.5">
        <Link href={href} className="flex items-start gap-2">
          <span className="mt-0.5 shrink-0" style={{ color: "var(--color-green)" }}>
            <Icon name="book" size={16} />
          </span>
          <span className="min-w-0 flex-1 font-body text-[13px] leading-snug">
            {ela.length > 0
              ? ela.map((s) => shortPlain(s.plain)).join(" · ")
              : "Summer break. Keep reading."}
            {science ? ` · Science: ${science.title}` : ""}
          </span>
        </Link>
        <Link href="/math" className="flex items-start gap-2">
          <span className="mt-0.5 shrink-0" style={{ color: "var(--color-purple)" }}>
            <Icon name="math" size={16} />
          </span>
          <span className="min-w-0 flex-1 font-body text-[13px] leading-snug">
            Math: {math.name}
          </span>
        </Link>
      </div>
    </section>
  );
}

export { SchoolStrip };
