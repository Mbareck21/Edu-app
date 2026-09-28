import Link from "next/link";

import ContinueReadingLink from "@/components/learn/ContinueReadingLink";
import StartButton from "@/components/learn/StartButton";
import Card from "@/components/ui/Card";
import Icon from "@/components/ui/Icon";
import ProgressBar from "@/components/ui/ProgressBar";
import { nextBeat, type PlanBeat } from "@/lib/daily-plan";

/**
 * The beats of a day in plan order (lib/daily-plan.ts), with one big button
 * that opens the next unfinished one. The list stays, small, under it: he can
 * still see the day and pick a beat himself.
 */
export default function TodayQuest({ beats, today }: { beats: PlanBeat[]; today: string }) {
  const done = beats.filter((b) => b.done).length;
  const next = nextBeat(beats);

  return (
    <Card color="green" variant="soft" padded={false} className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 pt-4">
        <div>
          <h2 className="font-display text-lg font-bold">Today&rsquo;s quest</h2>
          <p className="font-body text-sm" style={{ color: "var(--color-green-dark)" }}>
            {done === beats.length ? "All done. Great day." : `${done} of ${beats.length} done`}
          </p>
        </div>
        <span
          className="flex h-12 w-12 items-center justify-center rounded-full"
          style={{
            background: done === beats.length ? "var(--color-green)" : "#fff",
            color: done === beats.length ? "#fff" : "var(--color-green-dark)",
          }}
        >
          <Icon name={done === beats.length ? "trophy" : "star"} size={24} />
        </span>
      </div>

      <div className="px-4 pt-3">
        <ProgressBar value={done / beats.length} color="green" height={10} />
      </div>

      <div className="px-3 pt-3">
        <StartButton
          next={next ? { id: next.id, name: next.name, icon: next.icon, href: next.href ?? "/" } : null}
          started={done > 0}
          allDone={done === beats.length}
          today={today}
        />
      </div>

      <ul className="mt-3 space-y-1 px-3 pb-3">
        {beats.map((beat) => {
          const row = (
            <>
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                style={{
                  background: beat.done ? "var(--color-green)" : "var(--color-green-soft)",
                  color: beat.done ? "#fff" : "var(--color-green-dark)",
                }}
              >
                <Icon
                  name={beat.done ? "check" : beat.icon}
                  size={16}
                  strokeWidth={beat.done ? 3 : 2.4}
                />
              </span>
              <span className="flex min-w-0 flex-1 items-baseline gap-2">
                <span className="shrink-0 font-display text-sm font-bold">{beat.name}</span>
                <span
                  className="truncate font-body text-xs"
                  style={{ color: "var(--color-muted)" }}
                >
                  {beat.href ? beat.blurb : (beat.lockedBlurb ?? "Add words first")}
                </span>
              </span>
              <span style={{ color: "var(--color-faint)" }}>
                <Icon name={beat.done ? "check" : "arrowRight"} size={16} />
              </span>
            </>
          );

          return (
            <li key={beat.id}>
              {beat.href && beat.id === "read" ? (
                <ContinueReadingLink
                  href={beat.href}
                  className="press-3d flex min-h-[44px] items-center gap-2.5 rounded-tile bg-white px-3 py-2"
                >
                  {row}
                </ContinueReadingLink>
              ) : beat.href ? (
                <Link
                  href={beat.href}
                  className="press-3d flex min-h-[44px] items-center gap-2.5 rounded-tile bg-white px-3 py-2"
                >
                  {row}
                </Link>
              ) : (
                <span className="flex min-h-[44px] items-center gap-2.5 rounded-tile bg-white px-3 py-2 opacity-60">
                  {row}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

export { TodayQuest };
