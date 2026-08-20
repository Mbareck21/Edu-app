import type { ButtonHTMLAttributes, CSSProperties } from "react";

import { tone, type AccentColor } from "@/components/ui/colors";

export type ButtonVariant = "primary" | "secondary";
export type ButtonSize = "md" | "lg";

export type ButtonStyleOptions = {
  variant?: ButtonVariant;
  color?: AccentColor;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
};

const SIZE = {
  md: "min-h-[48px] px-5 text-[15px]",
  lg: "min-h-[56px] px-6 text-[17px]",
} as const;

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-full font-display font-bold uppercase tracking-wide disabled:cursor-not-allowed";

/**
 * Class names for the 3D button look. Use this to make a <Link> or an <a>
 * look exactly like a <Button> — there is no asChild here on purpose.
 * Pair it with buttonStyle() for the colours.
 */
export function buttonClass({
  variant = "primary",
  size = "lg",
  fullWidth = false,
  className = "",
}: ButtonStyleOptions = {}): string {
  const depth = size === "lg" ? "btn-3d-lg" : "";
  return [
    BASE,
    SIZE[size],
    "btn-3d",
    depth,
    variant === "secondary" ? "border-2" : "",
    fullWidth ? "w-full" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
}

/** Inline colour vars for the 3D button look. Pairs with buttonClass(). */
export function buttonStyle({
  variant = "primary",
  color = "green",
}: ButtonStyleOptions = {}): CSSProperties {
  const t = tone(color);
  if (variant === "primary") {
    return { background: t.base, color: t.on, ["--btn-shade" as string]: t.dark };
  }
  return {
    background: "#fff",
    color: t.onSoft,
    borderColor: "var(--color-line)",
    ["--btn-shade" as string]: "var(--color-line)",
  };
}

export type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "color"> &
  ButtonStyleOptions;

export default function Button({
  variant = "primary",
  color = "green",
  size = "lg",
  fullWidth = false,
  className = "",
  style,
  type = "button",
  children,
  ...rest
}: ButtonProps) {
  const opts = { variant, color, size, fullWidth, className };
  return (
    <button
      type={type}
      className={buttonClass(opts)}
      style={{ ...buttonStyle(opts), ...style }}
      {...rest}
    >
      {children}
    </button>
  );
}

export { Button };
