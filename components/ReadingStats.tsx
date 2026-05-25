import type { ReadingStats } from "@/lib/models/WordList";

const TYPE_LABEL: Record<string, string> = {
  main_idea: "Main idea",
  detail: "Detail",
  vocab: "Vocab",
  inference: "Inference",
  cause_effect: "Cause / effect",
  sequence: "Sequence",
};

const TYPE_ORDER = ["main_idea", "detail", "vocab", "inference", "cause_effect", "sequence"] as const;

export default function ReadingStatsCard({
  stats,
  level,
}: {
  stats: ReadingStats;
  level: number;
}) {
  const noData = stats.totalSessions === 0;
  const avg =
    stats.totalQuestions > 0
      ? Math.round((stats.totalFirstTryCorrect / stats.totalQuestions) * 100)
      : 0;

  return (
    <section className="card space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Performance</h2>
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white">
          Level {level} / 5
        </span>
      </div>

      {noData ? (
        <p className="text-sm text-slate-500">
          No readings finished yet. Complete one to see your stats here.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3 text-center">
            <Stat label="Readings done" value={String(stats.totalSessions)} />
            <Stat label="First-try score" value={`${avg}%`} />
            <Stat label="Hints used" value={String(stats.totalHintsUsed)} />
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              By question type
            </p>
            {TYPE_ORDER.map((t) => {
              const b = stats.byType[t];
              const pct = b.asked > 0 ? Math.round((b.firstTryCorrect / b.asked) * 100) : 0;
              return (
                <div key={t} className="space-y-0.5">
                  <div className="flex items-center justify-between text-sm">
                    <span>{TYPE_LABEL[t]}</span>
                    <span className="text-slate-600">
                      {b.firstTryCorrect}/{b.asked} {b.asked > 0 ? `(${pct}%)` : ""}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full bg-emerald-500 transition-all"
                      style={{ width: `${b.asked > 0 ? pct : 0}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {stats.recentSessions.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Recent sessions
              </p>
              <ul className="text-sm space-y-0.5">
                {stats.recentSessions
                  .slice(-5)
                  .reverse()
                  .map((s, i) => (
                    <li key={`${s.completedAt}-${i}`} className="flex items-center justify-between gap-3">
                      <span className="text-slate-600">
                        {new Date(s.completedAt).toLocaleDateString()} · L{s.level}
                      </span>
                      <span className="flex items-center gap-2">
                        <span className={s.scorePct === 100 ? "text-emerald-700 font-semibold" : ""}>
                          {s.scorePct}%
                        </span>
                        {s.perfect && (
                          <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs text-emerald-800">
                            ★ perfect
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-2">
      <p className="text-xs uppercase text-slate-500">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
    </div>
  );
}
