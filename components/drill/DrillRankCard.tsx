"use client";

import { useEffect, useState } from "react";

import Card from "@/components/ui/Card";
import { fireConfetti } from "@/components/ui/Confetti";
import ProgressBar from "@/components/ui/ProgressBar";
import RankShape from "@/components/drill/RankShape";
import { DRILL_RANKS, drillRank } from "@/lib/drill-rank";

/**
 * His drill rank: every drill point fills the bar to the next one. A rank he
 * has not seen here before gets confetti the first time he opens the tab.
 */
export default function DrillRankCard({ points, learner }: { points: number; learner: string }) {
  const { rank, next, progress, toNext } = drillRank(points);
  const index = DRILL_RANKS.indexOf(rank);
  const [fresh, setFresh] = useState(false);

  useEffect(() => {
    const key = `drill-rank:${learner}`;
    try {
      const seen = window.localStorage.getItem(key);
      const seenIndex = seen === null ? -1 : DRILL_RANKS.findIndex((r) => r.name === seen);
      if (seen !== null && index > seenIndex) {
        // Storage is read after the first paint, so the badge follows it.
        window.setTimeout(() => setFresh(true), 0);
        void fireConfetti("big");
      }
      window.localStorage.setItem(key, rank.name);
    } catch {
      // No storage (private window): the rank still shows, just no party.
    }
  }, [index, learner, rank.name]);

  return (
    <Card className="mt-3">
      <div className="flex items-center gap-3">
        <span className={fresh ? "q-bounce-in" : undefined}>
          <RankShape name={rank.name} size={52} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-display text-lg font-bold">
              {rank.name}
              {fresh ? (
                <span
                  className="ml-2 rounded-full px-2 py-0.5 text-xs"
                  style={{ background: "var(--color-gold-soft)", color: "var(--color-gold-ink)" }}
                >
                  New!
                </span>
              ) : null}
            </h2>
            <p className="font-display text-sm font-bold">{points.toLocaleString()} pts</p>
          </div>
          <ProgressBar value={progress} color={rank.color} height={8} className="mt-1" />
          <p className="mt-1 text-xs" style={{ color: "var(--color-muted)" }}>
            {next ? `${toNext.toLocaleString()} to ${next.name}` : "Top rank!"}
          </p>
        </div>
      </div>
      <div className="mt-3 flex justify-between px-1" aria-label="Drill ranks">
        {DRILL_RANKS.map((r, i) => (
          <RankShape key={r.name} name={r.name} size={28} reached={i <= index} />
        ))}
      </div>
    </Card>
  );
}
