import type { ReactNode } from "react";

import { tone, type AccentColor } from "@/components/ui/colors";

export type ProgressRingProps = {
  /** 0..1. Clamped. */
  value: number;
  size?: number;
  stroke?: number;
  color?: AccentColor;
  /** Ring behind the progress. Defaults to the sand token. */
  trackColor?: string;
  /** Centred content — a number, an Icon, anything. */
  children?: ReactNode;
  className?: string;
};

export default function ProgressRing({
  value,
  size = 120,
  stroke = 12,
  color = "green",
  trackColor = "var(--color-sand)",
  children,
  className = "",
}: ProgressRingProps) {
  const pct = Math.max(0, Math.min(1, value || 0));
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const t = tone(color);

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={trackColor}
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={t.base}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct)}
          style={{ transition: "stroke-dashoffset 500ms ease-out" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {children}
      </div>
    </div>
  );
}

export { ProgressRing };
