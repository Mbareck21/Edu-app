import Link from "next/link";

import SchoolReportForm from "@/components/me/SchoolReportForm";
import AppShell from "@/components/ui/AppShell";
import Card from "@/components/ui/Card";
import Icon from "@/components/ui/Icon";
import { currentLearner } from "@/lib/auth";
import { todayKey } from "@/lib/day";
import { LEARNER_IDS, LEARNER_NAMES, isLearnerId, type LearnerId } from "@/lib/learners";
import { planQuarter } from "@/lib/reading";
import { emptyReport, focusFor } from "@/lib/school-report";
import { loadReport } from "@/lib/school-report-store";

export const dynamic = "force-dynamic";

export const metadata = { title: "School report card" };

/**
 * A child's school report card, for grown-ups (lib/adult.ts locks it). Pick
 * the child at the top; the card is saved on that child's database only.
 */
export default async function SchoolReportPage({
  searchParams,
}: {
  searchParams: Promise<{ learner?: string }>;
}) {
  const asked = (await searchParams).learner;
  const learner: LearnerId = isLearnerId(asked) ? asked : await currentLearner();
  const today = todayKey();
  const report = await loadReport(learner);
  const focus = focusFor(report, today);
  const quarter = planQuarter(today);
  const name = LEARNER_NAMES[learner];

  return (
    <AppShell>
      <header className="pt-4 pb-4">
        <Link
          href="/me"
          className="inline-flex min-h-11 min-w-11 items-center gap-1 pr-2 text-sm font-bold"
          style={{ color: "var(--color-muted)" }}
        >
          <Icon name="arrowLeft" size={18} />
          Me
        </Link>
        <h1 className="font-display text-3xl font-bold">School report card</h1>
        <p className="mt-1 text-base" style={{ color: "var(--color-muted)" }}>
          Copy the card in, and practice leans toward what is not yet a 3. For grown-ups only; it is
          kept with that child&rsquo;s progress and nowhere else.
        </p>
        <nav className="mt-3 grid grid-cols-2 gap-2" aria-label="Child">
          {LEARNER_IDS.map((id) => (
            <Link
              key={id}
              href={`/me/school?learner=${id}`}
              aria-current={id === learner ? "page" : undefined}
              className="flex min-h-11 items-center justify-center rounded-full border-2 font-display text-base font-bold"
              style={{
                borderColor: id === learner ? "var(--color-green)" : "var(--color-line)",
                background: id === learner ? "var(--color-green-soft)" : "#fff",
                color: "var(--color-ink)",
              }}
            >
              {LEARNER_NAMES[id]}
            </Link>
          ))}
        </nav>
      </header>

      <Card variant="soft" color="blue" className="mb-4">
        <h2 className="font-display text-lg font-bold">What the app does with {name}&rsquo;s card</h2>
        {focus.reasons.length === 0 ? (
          <p className="mt-1 text-sm">
            {report ? "Nothing yet: no standard is under 3 and no math topic is ticked." : "No card saved yet, so practice follows school as usual."}
          </p>
        ) : (
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
            {focus.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        )}
      </Card>

      <SchoolReportForm
        key={learner}
        learner={learner}
        name={name}
        initial={report ?? emptyReport()}
        quarterNow={quarter === "summer" ? "Q1" : quarter}
        today={today}
      />
    </AppShell>
  );
}
