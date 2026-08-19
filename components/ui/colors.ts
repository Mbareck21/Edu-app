// One accent per area. Every UI primitive takes a colour from this list and
// reads its shades here, so a token change lands everywhere at once.

export type AccentColor =
  | "green"
  | "blue"
  | "purple"
  | "gold"
  | "coral"
  | "flame"
  | "ink";

export type Tone = {
  /** Solid fill. */
  base: string;
  /** The darker shade used for the 3D bottom edge. */
  dark: string;
  /** Tinted background for soft chips and cards. */
  soft: string;
  /** Text colour that reads on `base`. */
  on: string;
  /** Text colour that reads on `soft`. */
  onSoft: string;
};

const TONES: Record<AccentColor, Tone> = {
  green: {
    base: "var(--color-green)",
    dark: "var(--color-green-dark)",
    soft: "var(--color-green-soft)",
    on: "#ffffff",
    onSoft: "var(--color-green-dark)",
  },
  blue: {
    base: "var(--color-blue)",
    dark: "var(--color-blue-dark)",
    soft: "var(--color-blue-soft)",
    on: "#ffffff",
    onSoft: "var(--color-blue-dark)",
  },
  purple: {
    base: "var(--color-purple)",
    dark: "var(--color-purple-dark)",
    soft: "var(--color-purple-soft)",
    on: "#ffffff",
    onSoft: "var(--color-purple-dark)",
  },
  gold: {
    base: "var(--color-gold)",
    dark: "var(--color-gold-dark)",
    soft: "var(--color-gold-soft)",
    on: "var(--color-gold-ink)",
    onSoft: "var(--color-gold-ink)",
  },
  coral: {
    base: "var(--color-coral)",
    dark: "var(--color-coral-dark)",
    soft: "var(--color-coral-soft)",
    on: "#ffffff",
    onSoft: "var(--color-coral-dark)",
  },
  flame: {
    base: "var(--color-flame)",
    dark: "var(--color-flame-dark)",
    soft: "var(--color-gold-soft)",
    on: "#ffffff",
    onSoft: "var(--color-flame-dark)",
  },
  ink: {
    base: "var(--color-ink)",
    dark: "#0f151d",
    soft: "var(--color-sand)",
    on: "#ffffff",
    onSoft: "var(--color-ink)",
  },
};

export function tone(color: AccentColor): Tone {
  return TONES[color];
}
