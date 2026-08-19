import type { ReactNode } from "react";

import Icon, { type IconName } from "@/components/ui/Icon";
import { tone, type AccentColor } from "@/components/ui/colors";

export type PillProps = {
  children: ReactNode;
  color?: AccentColor;
  /** "soft" = tinted chip (default), "solid" = filled, "line" = outlined. */
  variant?: "soft" | "solid" | "line";
  icon?: IconName;
  size?: "sm" | "md";
  className?: string;
};

export default function Pill({
  children,
  color = "gold",
  variant = "soft",
  icon,
  size = "md",
  className = "",
}: PillProps) {
  const t = tone(color);
  const look =
    variant === "solid"
      ? { background: t.base, color: t.on, border: "2px solid transparent" }
      : variant === "line"
        ? { background: "#fff", color: t.onSoft, border: `2px solid ${t.base}` }
        : { background: t.soft, color: t.onSoft, border: "2px solid transparent" };

  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-full font-display font-bold whitespace-nowrap",
        size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm",
        className,
      ].join(" ")}
      style={look}
    >
      {icon ? <Icon name={icon} size={size === "sm" ? 14 : 16} filled={icon === "flame" || icon === "star"} /> : null}
      {children}
    </span>
  );
}

export { Pill };
