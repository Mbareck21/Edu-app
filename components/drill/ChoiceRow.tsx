"use client";

import { sfx } from "@/lib/sfx";
import { tone, type AccentColor } from "@/components/ui/colors";

export type Choice = {
  value: string;
  label: string;
  /** Small second line inside the chip — a count, mostly. */
  note?: string;
  disabled?: boolean;
};

export type ChoiceRowProps = {
  label: string;
  choices: Choice[];
  value: string;
  onChange: (value: string) => void;
  color?: AccentColor;
};

/**
 * One row of the setup screen: a title and a wrap of chips, one picked.
 * Radio semantics, so a screen reader reads it as one choice.
 */
export default function ChoiceRow({
  label,
  choices,
  value,
  onChange,
  color = "blue",
}: ChoiceRowProps) {
  const t = tone(color);

  return (
    <div className="mt-3">
      <p className="mb-1.5 font-display text-sm font-bold" style={{ color: "var(--color-muted)" }}>
        {label}
      </p>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
        {choices.map((choice) => {
          const on = choice.value === value;
          return (
            <button
              key={choice.value}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={choice.disabled}
              onClick={() => {
                if (choice.disabled) return;
                sfx.tap();
                onChange(choice.value);
              }}
              className="press-3d flex min-h-[48px] items-center gap-1.5 rounded-full border-2 px-4 font-display text-[15px] font-bold disabled:opacity-40"
              style={{
                background: on ? t.soft : "#fff",
                borderColor: on ? t.base : "var(--color-line)",
                color: on ? t.onSoft : "var(--color-ink)",
              }}
            >
              {choice.label}
              {choice.note ? (
                <span
                  className="text-xs font-bold"
                  style={{ color: on ? t.onSoft : "var(--color-muted)" }}
                >
                  {choice.note}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export { ChoiceRow };
