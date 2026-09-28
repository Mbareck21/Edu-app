"use client";

import Link from "next/link";
import { useEffect } from "react";

import ContinueReadingLink from "@/components/learn/ContinueReadingLink";
import { buttonClass, buttonStyle } from "@/components/ui/Button";
import { fireConfetti } from "@/components/ui/Confetti";
import Icon, { type IconName } from "@/components/ui/Icon";
import { claimCheer, type BeatId } from "@/lib/daily-plan";
import { MIN_WIN_PTS } from "@/lib/scoreboard";
import { sfx } from "@/lib/sfx";

/**
 * The one big button on Home: it opens the next unfinished beat of today's
 * plan. Once every beat is done it turns into the day's celebration, with
 * the big confetti once a day on this device, and "Keep going" hands him to
 * the drill driver: there is always a next best thing, never a pick-your-own
 * to repeat.
 */
export default function StartButton({
  next,
  started,
  allDone,
  today,
  race,
}: {
  next: { id: BeatId; name: string; icon: IconName; href: string } | null;
  started: boolean;
  allDone: boolean;
  today: string;
  race?: { pts: number; closed: boolean };
}) {
  useEffect(() => {
    if (!allDone || !claimCheer(today)) return;
    void fireConfetti("big");
    sfx.levelUp();
  }, [allDone, today]);

  if (allDone) {
    const keep = { color: "blue" as const, size: "lg" as const, fullWidth: true };
    return (
      <div className="space-y-3">
        <div
          className="flex items-center gap-3 rounded-card px-4 py-3"
          style={{ background: "var(--color-gold-soft)" }}
        >
          <span
            className="q-bounce-in flex h-14 w-14 shrink-0 items-center justify-center rounded-full"
            style={{ background: "var(--color-gold)", color: "#fff" }}
          >
            <Icon name="trophy" size={30} strokeWidth={2.2} />
          </span>
          <div className="min-w-0">
            <p
              className="inline-flex items-center gap-1 font-display text-xl font-bold"
              style={{ color: "var(--color-gold-ink)" }}
            >
              All done today!
              <Icon name="sparkles" size={20} />
            </p>
            <p className="text-sm font-bold" style={{ color: "var(--color-gold-ink)" }}>
              Every beat, start to finish. So proud of you!
            </p>
          </div>
        </div>
        <Link href="/drill/next" className={buttonClass(keep)} style={buttonStyle(keep)}>
          <Icon name="bolt" size={20} />
          Keep going: next drill
        </Link>
        {race && !race.closed ? (
          <p className="text-center text-sm font-bold" style={{ color: "var(--color-blue-dark)" }}>
            {race.pts < MIN_WIN_PTS
              ? `${(MIN_WIN_PTS - race.pts).toLocaleString("en-US")} more pts to be in tonight's race!`
              : "You're in tonight's race! Every point counts until 9:30 pm."}
          </p>
        ) : null}
      </div>
    );
  }

  if (!next) return null;

  const opts = { color: "green" as const, size: "lg" as const, fullWidth: true };
  const className = buttonClass({ ...opts, className: "min-h-[68px] flex-col gap-0.5 py-2" });
  const style = buttonStyle(opts);
  const body = (
    <>
      <span className="flex items-center gap-2 text-[19px]">
        <Icon name="play" size={20} filled />
        {started ? "Continue" : "Start today’s learning"}
      </span>
      <span className="text-xs normal-case tracking-normal opacity-90">Up next: {next.name}</span>
    </>
  );

  return (
    <div className="q-bounce-in">
      <div className="q-node-pulse rounded-full">
        {next.id === "read" ? (
          <ContinueReadingLink href={next.href} className={className} style={style}>
            {body}
          </ContinueReadingLink>
        ) : (
          <Link href={next.href} className={className} style={style}>
            {body}
          </Link>
        )}
      </div>
    </div>
  );
}
