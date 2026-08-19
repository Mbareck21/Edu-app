"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import Button, { buttonClass, buttonStyle } from "@/components/ui/Button";
import Icon, { type IconName } from "@/components/ui/Icon";
import { fireConfetti } from "@/components/ui/Confetti";
import { sfx } from "@/lib/sfx";

export type CompleteAction =
  | { label: string; href: string }
  | { label: string; onClick: () => void };

export type LessonCompleteProps = {
  title?: string;
  subtitle?: string;
  /** XP gained in this session. */
  xp: number;
  /** Time on task, ms. */
  ms: number;
  /** 0..1. */
  accuracy: number;
  perfect?: boolean;
  leveledUp?: boolean;
  /** Shown as a callout under the tiles. */
  newBadge?: { name: string; blurb: string; icon: IconName } | null;
  primary: CompleteAction;
  secondary?: CompleteAction;
  /** "Saved later" note when the post was queued offline. */
  note?: string;
};

/** Counts from 0 to `target` on mount. Updates happen inside rAF, never
    synchronously in the effect. */
function useCountUp(target: number, ms = 700): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / ms);
      setN(Math.round(target * (1 - (1 - p) * (1 - p))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return n;
}

function clock(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="flex-1 rounded-tile border px-2 py-3 text-center"
      style={{ borderColor: "var(--color-line)", background: "#fff" }}
    >
      <p className="font-display text-xl font-bold leading-none">{value}</p>
      <p className="mt-1 text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>
        {label}
      </p>
    </div>
  );
}

function Action({ action, variant }: { action: CompleteAction; variant: "primary" | "secondary" }) {
  const opts = { variant, color: "green" as const, size: "lg" as const, fullWidth: true };
  if ("href" in action) {
    return (
      <Link href={action.href} className={buttonClass(opts)} style={buttonStyle(opts)}>
        {action.label}
      </Link>
    );
  }
  return (
    <Button {...opts} onClick={action.onClick}>
      {action.label}
    </Button>
  );
}

export default function LessonComplete({
  title,
  subtitle,
  xp,
  ms,
  accuracy,
  perfect = false,
  leveledUp = false,
  newBadge = null,
  primary,
  secondary,
  note,
}: LessonCompleteProps) {
  useEffect(() => {
    if (perfect) void fireConfetti("big");
    else if (leveledUp) void fireConfetti("small");
    if (leveledUp) sfx.levelUp();
    else if (perfect) sfx.chest();
  }, [perfect, leveledUp]);

  const xpShown = useCountUp(xp);
  const pctShown = useCountUp(Math.round(Math.max(0, Math.min(1, accuracy)) * 100));

  return (
    <div className="flex min-h-dvh flex-col px-4 pt-10 pb-6">
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <span
          className="q-bounce-in flex h-24 w-24 items-center justify-center rounded-full"
          style={{ background: "var(--color-gold-soft)", color: "var(--color-gold-ink)" }}
        >
          <Icon name="trophy" size={52} strokeWidth={2.2} />
        </span>
        <h1 className="mt-5 font-display text-3xl font-bold">
          {title ?? (perfect ? "All right!" : "Lesson done!")}
        </h1>
        <p className="mt-1 text-base" style={{ color: "var(--color-muted)" }}>
          {subtitle ?? (perfect ? "You got every one." : "Good work. Keep going.")}
        </p>

        <div className="mt-7 flex w-full gap-2">
          <Tile label="XP" value={`+${xpShown}`} />
          <Tile label="Time" value={clock(ms)} />
          <Tile label="Right" value={`${pctShown}%`} />
        </div>

        {leveledUp ? (
          <p className="mt-4 font-display text-base font-bold" style={{ color: "var(--color-purple)" }}>
            New level!
          </p>
        ) : null}

        {newBadge ? (
          <div
            className="q-pop mt-4 flex w-full items-center gap-3 rounded-card px-4 py-3 text-left"
            style={{ background: "var(--color-gold-soft)" }}
          >
            <span style={{ color: "var(--color-gold-ink)" }}>
              <Icon name={newBadge.icon} size={30} />
            </span>
            <div className="min-w-0">
              <p className="font-display text-base font-bold" style={{ color: "var(--color-gold-ink)" }}>
                New badge: {newBadge.name}
              </p>
              <p className="text-sm">{newBadge.blurb}</p>
            </div>
          </div>
        ) : null}

        {note ? (
          <p className="mt-4 text-sm" style={{ color: "var(--color-muted)" }}>
            {note}
          </p>
        ) : null}
      </div>

      <div className="mt-8 space-y-3">
        <Action action={primary} variant="primary" />
        {secondary ? <Action action={secondary} variant="secondary" /> : null}
      </div>
    </div>
  );
}

export { LessonComplete };
