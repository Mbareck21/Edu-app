import Link from "next/link";

import Card from "@/components/ui/Card";
import Icon, { type IconName } from "@/components/ui/Icon";
import ProgressBar from "@/components/ui/ProgressBar";

export type QuestBeat = {
  id: string;
  name: string;
  blurb: string;
  icon: IconName;
  href: string | null;
  done: boolean;
};

/**
 * The four beats of a day, in order: review, new words, reading, production.
 * Four ticks = the daily goal is met.
 */
export default function TodayQuest({ beats }: { beats: QuestBeat[] }) {
  const done = beats.filter((b) => b.done).length;

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

      <ul className="mt-3 space-y-1.5 px-3 pb-3">
        {beats.map((beat) => {
          const row = (
            <>
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
                style={{
                  background: beat.done ? "var(--color-green)" : "var(--color-green-soft)",
                  color: beat.done ? "#fff" : "var(--color-green-dark)",
                }}
              >
                <Icon
                  name={beat.done ? "check" : beat.icon}
                  size={22}
                  strokeWidth={beat.done ? 3 : 2.4}
                />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-[15px] font-bold">{beat.name}</span>
                <span
                  className="block font-body text-xs"
                  style={{ color: "var(--color-muted)" }}
                >
                  {beat.href ? beat.blurb : "Add words first"}
                </span>
              </span>
              <span style={{ color: "var(--color-faint)" }}>
                <Icon name={beat.done ? "check" : "arrowRight"} size={20} />
              </span>
            </>
          );

          return (
            <li key={beat.id}>
              {beat.href ? (
                <Link
                  href={beat.href}
                  className="press-3d flex min-h-[60px] items-center gap-3 rounded-tile bg-white px-3 py-2"
                >
                  {row}
                </Link>
              ) : (
                <span className="flex min-h-[60px] items-center gap-3 rounded-tile bg-white px-3 py-2 opacity-60">
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
