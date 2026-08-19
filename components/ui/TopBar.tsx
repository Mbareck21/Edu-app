import type { ReactNode } from "react";

import Pill from "@/components/ui/Pill";

export type TopBarProps = {
  name: string;
  xp: number;
  streak: number;
  /** Replaces the "Hi, {name}" line when you want something else there. */
  title?: string;
  /** Small line under the greeting. */
  subtitle?: string;
  /** Extra content on the right, after the pills. */
  right?: ReactNode;
  className?: string;
};

/** The flame grows with the streak: 3, 7 and 30 days are the steps. */
export function streakStep(streak: number): "none" | "small" | "big" | "huge" {
  if (streak >= 30) return "huge";
  if (streak >= 7) return "big";
  if (streak >= 3) return "small";
  return "none";
}

export default function TopBar({
  name,
  xp,
  streak,
  title,
  subtitle,
  right,
  className = "",
}: TopBarProps) {
  const step = streakStep(streak);
  return (
    <header className={`flex items-center justify-between gap-3 ${className}`}>
      <div className="min-w-0">
        <p className="font-display text-xl font-bold leading-tight">
          {title ?? `Hi, ${name}`}
        </p>
        {subtitle ? (
          <p className="text-sm" style={{ color: "var(--color-muted)" }}>
            {subtitle}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Pill color="gold" icon="bolt">
          {xp}
        </Pill>
        <Pill
          color="flame"
          icon="flame"
          variant={step === "huge" ? "solid" : "soft"}
          className={step === "none" ? "opacity-70" : ""}
        >
          {streak}
        </Pill>
        {right}
      </div>
    </header>
  );
}

export { TopBar };
