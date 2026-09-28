"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import Creature from "@/components/badges/Creature";
import ContinueReadingLink from "@/components/learn/ContinueReadingLink";
import Button, { buttonClass, buttonStyle } from "@/components/ui/Button";
import Icon, { type IconName } from "@/components/ui/Icon";
import { fireConfetti } from "@/components/ui/Confetti";
import { clock } from "@/components/ui/time";
import { creatureFor } from "@/lib/creatures";
import { planCheer, type PlanProgress } from "@/lib/daily-plan";
import { sfx } from "@/lib/sfx";

export type CompleteAction =
  | { label: string; href: string }
  | { label: string; onClick: () => void; disabled?: boolean };

export type NewBadge = { id?: string; name: string; blurb: string; icon: IconName };

export type LessonCompleteProps = {
  title?: string;
  subtitle?: string;
  /** XP gained in this session. */
  xp: number;
  /** Time on task, ms. */
  ms: number;
  /** 0..1, or null when the step grades nothing — then no score tile is shown. */
  accuracy: number | null;
  perfect?: boolean;
  leveledUp?: boolean;
  /** Every badge this session earned, each a callout under the tiles. */
  newBadges?: readonly NewBadge[];
  /** One badge: the older prop, used when `newBadges` is not given. */
  newBadge?: NewBadge | null;
  primary: CompleteAction;
  secondary?: CompleteAction;
  /** "Saved later" note when the post was queued offline. */
  note?: string;
  /**
   * Set when this lesson is a beat of today's plan: shows how far through
   * the day he is, and the main button goes on to the next beat instead of
   * `primary`.
   */
  plan?: PlanProgress;
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

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="flex-1 rounded-tile border px-2 py-3 text-center"
      style={{ borderColor: "var(--color-line)", background: "#fff" }}
    >
      <p className="font-display text-xl font-bold leading-none">{value}</p>
      <p className="mt-1 text-xs font-bold uppercase tracking-wide" style={{ color: "var(--color-muted)" }}>
        {label}
      </p>
    </div>
  );
}

function Action({ action, variant }: { action: CompleteAction; variant: "primary" | "secondary" }) {
  // Once tapped it stays down: "Next drill" waits on a server redirect that
  // reads the database, the screen did not change, so it looked dead and got
  // tapped again and again. Every action here leaves this screen.
  const [pending, setPending] = useState(false);
  const opts = { variant, color: "green" as const, size: "lg" as const, fullWidth: true };
  if ("href" in action) {
    return (
      <Link href={action.href} className={buttonClass(opts)} style={buttonStyle(opts)}>
        {action.label}
      </Link>
    );
  }
  return (
    <Button
      {...opts}
      onClick={() => {
        setPending(true);
        action.onClick();
      }}
      disabled={action.disabled || pending}
      aria-busy={pending || undefined}
    >
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
  newBadges,
  newBadge = null,
  primary,
  secondary,
  note,
  plan,
}: LessonCompleteProps) {
  useEffect(() => {
    if (perfect) void fireConfetti("big");
    else if (leveledUp) void fireConfetti("small");
    if (leveledUp) sfx.levelUp();
    else if (perfect) sfx.chest();
  }, [perfect, leveledUp]);

  // Every finish gets a cheer, unless the one above already fired: small for
  // a lesson or a beat of the plan, big for the last beat of the day.
  const inPlan = plan !== undefined;
  const planDone = plan !== undefined && plan.done >= plan.total;
  useEffect(() => {
    if (perfect || leveledUp) return;
    void fireConfetti(planDone ? "big" : "small");
    if (!inPlan) return;
    if (planDone) sfx.levelUp();
    else sfx.correct();
  }, [inPlan, planDone, perfect, leveledUp]);

  // All of them: a first session can earn First Win and All Right at once,
  // and only the first used to be shown.
  const badges = newBadges ?? (newBadge ? [newBadge] : []);
  const xpShown = useCountUp(xp);
  const pctShown = useCountUp(Math.round(Math.max(0, Math.min(1, accuracy ?? 0)) * 100));

  return (
    // pb-48 keeps room for the buttons fixed at the bottom of the screen.
    <div className="flex min-h-dvh flex-col px-4 pt-10 pb-48">
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
          {/* An ungraded step has no score. Showing 100% for looking at cards
              is the app congratulating him for something he did not show. */}
          {accuracy === null ? null : <Tile label="Right" value={`${pctShown}%`} />}
        </div>

        {leveledUp ? (
          <p className="mt-4 font-display text-base font-bold" style={{ color: "var(--color-purple)" }}>
            New level!
          </p>
        ) : null}

        {badges.map((badge) => (
          <div
            key={badge.id ?? badge.name}
            className="q-pop mt-4 flex w-full items-center gap-3 rounded-card px-4 py-3 text-left"
            style={{ background: "var(--color-gold-soft)" }}
          >
            {badge.id ? (
              <span className="q-bounce-in shrink-0">
                <Creature badgeId={badge.id} size={64} />
              </span>
            ) : (
              <span style={{ color: "var(--color-gold-ink)" }}>
                <Icon name={badge.icon} size={30} />
              </span>
            )}
            <div className="min-w-0">
              <p className="font-display text-base font-bold" style={{ color: "var(--color-gold-ink)" }}>
                {badge.id ? `You found ${creatureFor(badge.id).name}!` : `New badge: ${badge.name}`}
              </p>
              <p className="text-sm">
                {badge.blurb}
                {badge.id ? " See it on Me." : ""}
              </p>
            </div>
          </div>
        ))}

        {plan ? (
          <div className="mt-5 w-full">
            <p className="font-display text-base font-bold" style={{ color: "var(--color-green-dark)" }}>
              {planCheer(plan.done, plan.total)}
            </p>
            <ol className="mt-2 flex justify-center gap-2" aria-label="Today's plan">
              {plan.beats.map((b) => (
                <li
                  key={b.id}
                  className={`flex h-9 w-9 items-center justify-center rounded-full${b.current ? " q-bounce-in" : ""}`}
                  style={{
                    background: b.done ? "var(--color-green)" : "var(--color-green-soft)",
                    color: b.done ? "#fff" : "var(--color-green-dark)",
                  }}
                >
                  <Icon name={b.done ? "check" : b.icon} size={18} strokeWidth={b.done ? 3 : 2.4} />
                </li>
              ))}
            </ol>
          </div>
        ) : null}

        {note ? (
          <p className="mt-4 text-sm" style={{ color: "var(--color-muted)" }}>
            {note}
          </p>
        ) : null}
      </div>

      {/* Fixed to the bottom of the screen, above the tab bar when there is
          one: a chest card, a word list or a Home bar above this screen used
          to push these buttons out of sight. */}
      <div
        className="fixed inset-x-0 z-30 mx-auto w-full max-w-app space-y-3 px-4 pt-3"
        style={{
          bottom: "var(--nav-h, 0px)",
          paddingBottom: "calc(16px + env(safe-area-inset-bottom))",
          background: "var(--color-bg)",
        }}
      >
        {plan?.next.id === "read" ? (
          <ContinueReadingLink
            href={plan.next.href}
            className={buttonClass({ color: "green", size: "lg", fullWidth: true })}
            style={buttonStyle({ color: "green" })}
          >
            {plan.next.label}
          </ContinueReadingLink>
        ) : (
          <Action action={plan ? plan.next : primary} variant="primary" />
        )}
        {secondary ? <Action action={secondary} variant="secondary" /> : null}
      </div>
    </div>
  );
}

export { LessonComplete };
