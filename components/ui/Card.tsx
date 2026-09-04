import type { CSSProperties, ReactNode, Ref } from "react";

import { tone, type AccentColor } from "@/components/ui/colors";

export type CardProps = {
  children: ReactNode;
  /** Tints the card and its border with one accent. */
  color?: AccentColor;
  /** "plain" = white, "soft" = tinted, "dark" = night hero. */
  variant?: "plain" | "soft" | "dark";
  padded?: boolean;
  className?: string;
  style?: CSSProperties;
  /** For callers that need to measure or scroll the card. React 19 takes a
      ref as a plain prop, so no forwardRef wrapper is needed. */
  ref?: Ref<HTMLDivElement>;
};

export default function Card({
  children,
  color,
  variant = "plain",
  padded = true,
  className = "",
  style,
  ref,
}: CardProps) {
  const t = color ? tone(color) : null;
  const look: CSSProperties =
    variant === "dark"
      ? { background: "var(--color-night)", color: "#fff", borderColor: "transparent" }
      : variant === "soft"
        ? {
            background: t ? t.soft : "var(--color-sand)",
            borderColor: "transparent",
            color: "var(--color-ink)",
          }
        : { background: "#fff", borderColor: "var(--color-line)" };

  return (
    <div
      ref={ref}
      className={[
        "rounded-card border",
        padded ? "p-4" : "",
        variant === "plain" ? "shadow-card" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ ...look, ...style }}
    >
      {children}
    </div>
  );
}

export { Card };
