import { tone, type AccentColor } from "@/components/ui/colors";

export type ProgressBarProps = {
  /** 0..1. Clamped. */
  value: number;
  color?: AccentColor;
  /** Track height in px. */
  height?: number;
  className?: string;
  /** Screen-reader label; when set the bar becomes a progressbar role. */
  label?: string;
};

export default function ProgressBar({
  value,
  color = "green",
  height = 14,
  className = "",
  label,
}: ProgressBarProps) {
  const pct = Math.round(Math.max(0, Math.min(1, value || 0)) * 100);
  const t = tone(color);
  return (
    <div
      className={`w-full overflow-hidden rounded-full ${className}`}
      style={{ height, background: "var(--color-sand)" }}
      role={label ? "progressbar" : undefined}
      aria-label={label}
      aria-valuenow={label ? pct : undefined}
      aria-valuemin={label ? 0 : undefined}
      aria-valuemax={label ? 100 : undefined}
    >
      <div
        className="h-full rounded-full transition-[width] duration-300 ease-out"
        style={{ width: `${pct}%`, background: t.base }}
      />
    </div>
  );
}

export { ProgressBar };
