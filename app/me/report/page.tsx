import Link from "next/link";

import AppShell from "@/components/ui/AppShell";
import Card from "@/components/ui/Card";
import Icon from "@/components/ui/Icon";
import { LEARNER_NAMES } from "@/lib/learners";
import { getFamilyProfiles } from "@/lib/profile";
import { COMPETITION_START, REPORT_DAYS, SECTIONS, buildReport, type KidReport, type Totals } from "@/lib/tracker";
import { loadTracked, trackActivity } from "@/lib/tracker-store";

export const dynamic = "force-dynamic";

export const metadata = { title: "Competition report" };

/** "Sep 25" from a YYYY-MM-DD day. */
function short(day: string): string {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function hours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  return h > 0 ? `${h} h ${minutes % 60} min` : `${minutes} min`;
}

function pct(t: Totals): string {
  return t.avgPct === null ? "—" : `${t.avgPct}%`;
}

/** One row, a cell per child; the better one in bold when `better` says which way is better. */
function Row({
  label,
  kids,
  value,
  shown,
  better = "more",
}: {
  label: string;
  kids: KidReport[];
  value: (k: KidReport) => number | null;
  shown: (k: KidReport) => string;
  better?: "more" | "less" | "none";
}) {
  const values = kids.map(value).filter((v): v is number => v !== null);
  const best = better === "none" || values.length < 2 ? null : better === "more" ? Math.max(...values) : Math.min(...values);
  const unique = best !== null && values.filter((v) => v === best).length === 1;
  return (
    <tr className="border-t" style={{ borderColor: "var(--color-line)" }}>
      <th scope="row" className="py-2 pr-2 text-left text-sm font-normal" style={{ color: "var(--color-muted)" }}>
        {label}
      </th>
      {kids.map((k) => (
        <td
          key={k.learner}
          className={`py-2 text-right text-sm tabular-nums${unique && value(k) === best ? " font-bold" : ""}`}
        >
          {shown(k)}
        </td>
      ))}
    </tr>
  );
}

function Table({ kids, children }: { kids: KidReport[]; children: React.ReactNode }) {
  return (
    <table className="w-full">
      <thead>
        <tr>
          <th scope="col" className="sr-only">
            Measure
          </th>
          {kids.map((k) => (
            <th key={k.learner} scope="col" className="pb-1 text-right font-display text-base font-bold">
              {k.name}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}

/**
 * The competition report: grown-ups only (the grown-ups PIN, see lib/adult.ts),
 * linked from Word lists and nowhere a child looks. See lib/tracker.ts.
 */
export default async function ReportPage() {
  const family = await getFamilyProfiles();
  // Copy anything the tracker does not have yet, then read it all back.
  await Promise.all(family.map(({ learner, state }) => trackActivity(learner, state.activity)));
  const kids = await Promise.all(
    family.map(async ({ learner, state }) => ({
      learner,
      name: state.name || LEARNER_NAMES[learner],
      sessions: await loadTracked(learner, COMPETITION_START),
    }))
  );
  const report = buildReport(kids);
  const rows = report.kids;
  const over = report.dayOf >= REPORT_DAYS;

  return (
    <AppShell>
      <header className="pt-4 pb-4">
        <Link href="/me/lists" className="inline-flex min-h-11 items-center gap-1 text-sm font-bold" style={{ color: "var(--color-muted)" }}>
          <Icon name="arrowLeft" size={18} />
          Word lists
        </Link>
        <h1 className="font-display text-3xl font-bold">Competition report</h1>
        <p className="mt-1 text-base" style={{ color: "var(--color-muted)" }}>
          {short(report.from)} to {short(report.to)}: day {Math.min(report.dayOf, REPORT_DAYS)} of {REPORT_DAYS}
          {over ? ", the month is done." : "."} For grown-ups only. Both children are counted by the same rules,
          and bold marks who is ahead.
        </p>
      </header>

      {rows.length === 0 ? (
        <Card>
          <p className="text-base">No sessions yet.</p>
        </Card>
      ) : (
        <div className="space-y-4 pb-6">
          <Card>
            <h2 className="font-display text-lg font-bold">The race</h2>
            <Table kids={rows}>
              <Row label="Days won" kids={rows} value={(k) => k.daysWon} shown={(k) => String(k.daysWon)} />
              <Row label="Days in the race" kids={rows} value={(k) => k.raceDays} shown={(k) => String(k.raceDays)} />
              <Row label="Days with the whole quest" kids={rows} value={(k) => k.questDays} shown={(k) => String(k.questDays)} />
              <Row label="Days played" kids={rows} value={(k) => k.daysPlayed} shown={(k) => String(k.daysPlayed)} />
            </Table>
          </Card>

          <Card>
            <h2 className="font-display text-lg font-bold">All sections</h2>
            <Table kids={rows}>
              <Row label="Average score" kids={rows} value={(k) => k.overall.avgPct} shown={(k) => pct(k.overall)} />
              <Row label="XP" kids={rows} value={(k) => k.overall.xp} shown={(k) => k.overall.xp.toLocaleString("en-US")} />
              <Row label="Time working" kids={rows} value={(k) => k.overall.minutes} shown={(k) => hours(k.overall.minutes)} />
              <Row label="Sessions" kids={rows} value={(k) => k.overall.sessions} shown={(k) => String(k.overall.sessions)} />
            </Table>
          </Card>

          <Card>
            <h2 className="font-display text-lg font-bold">By section</h2>
            <p className="mt-1 text-sm" style={{ color: "var(--color-muted)" }}>
              Average score, then sessions and time.
            </p>
            <Table kids={rows}>
              {SECTIONS.filter((s) => rows.some((k) => k.bySection[s].sessions > 0)).map((s) => (
                <Row
                  key={s}
                  label={s}
                  kids={rows}
                  value={(k) => k.bySection[s].avgPct}
                  shown={(k) => {
                    const t = k.bySection[s];
                    return t.sessions === 0 ? "—" : `${pct(t)} · ${t.sessions} · ${hours(t.minutes)}`;
                  }}
                />
              ))}
            </Table>
          </Card>

          <Card>
            <h2 className="font-display text-lg font-bold">Week by week</h2>
            <p className="mt-1 text-sm" style={{ color: "var(--color-muted)" }}>
              Average score and XP.
            </p>
            <Table kids={rows}>
              {rows[0].weeks.map((w, i) => (
                <Row
                  key={w.from}
                  label={`${short(w.from)} to ${short(w.to)}`}
                  kids={rows}
                  value={(k) => k.weeks[i]?.totals.avgPct ?? null}
                  shown={(k) => {
                    const t = k.weeks[i]?.totals;
                    return !t || t.sessions === 0 ? "—" : `${pct(t)} · ${t.xp.toLocaleString("en-US")} XP`;
                  }}
                />
              ))}
            </Table>
          </Card>

          <Card>
            <h2 className="font-display text-lg font-bold">Worth a look</h2>
            <p className="mt-1 text-sm" style={{ color: "var(--color-muted)" }}>
              Sessions under 25% right look guessed. Late means after the race closed at 9:30 pm.
            </p>
            <Table kids={rows}>
              <Row label="Looked guessed" kids={rows} better="less" value={(k) => k.flags.guessed} shown={(k) => String(k.flags.guessed)} />
              <Row label="Played late" kids={rows} better="less" value={(k) => k.flags.late} shown={(k) => String(k.flags.late)} />
              <Row
                label="Longest day"
                kids={rows}
                better="none"
                value={(k) => k.flags.longestDay?.minutes ?? null}
                shown={(k) => (k.flags.longestDay ? `${hours(k.flags.longestDay.minutes)}, ${short(k.flags.longestDay.day)}` : "—")}
              />
            </Table>
          </Card>

          <Card>
            <h2 className="font-display text-lg font-bold">Day by day</h2>
            <p className="mt-1 text-sm" style={{ color: "var(--color-muted)" }}>
              Race points. 0 means not in the race that day.
            </p>
            <table className="mt-2 w-full">
              <thead>
                <tr>
                  <th scope="col" className="pb-1 text-left text-sm font-normal" style={{ color: "var(--color-muted)" }}>
                    Day
                  </th>
                  {rows.map((k) => (
                    <th key={k.learner} scope="col" className="pb-1 text-right font-display text-base font-bold">
                      {k.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.days.map((d) => (
                  <tr key={d.day} className="border-t" style={{ borderColor: "var(--color-line)" }}>
                    <th scope="row" className="py-2 text-left text-sm font-normal">
                      {short(d.day)}
                    </th>
                    {rows.map((k) => (
                      <td
                        key={k.learner}
                        className={`py-2 text-right text-sm tabular-nums${d.winner === k.learner ? " font-bold" : ""}`}
                      >
                        {(d.points[k.learner] ?? 0).toLocaleString("en-US")}
                        {d.winner === k.learner ? " ★" : ""}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}
    </AppShell>
  );
}
