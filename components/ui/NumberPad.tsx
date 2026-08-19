"use client";

import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import { sfx } from "@/lib/sfx";
import type { AccentColor } from "@/components/ui/colors";

export type NumberPadProps = {
  /** One digit ("0".."9") or "-" was pressed. */
  onInput: (digit: string) => void;
  onBackspace: () => void;
  onCheck: () => void;
  /** Greys out CHECK — usually when the box is empty. */
  checkDisabled?: boolean;
  disabled?: boolean;
  checkLabel?: string;
  /** Adds a minus key for subtraction answers. */
  allowMinus?: boolean;
  /** Accent for the CHECK key. */
  color?: AccentColor;
  className?: string;
};

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

export default function NumberPad({
  onInput,
  onBackspace,
  onCheck,
  checkDisabled = false,
  disabled = false,
  checkLabel = "Check",
  allowMinus = false,
  color = "blue",
  className = "",
}: NumberPadProps) {
  const key = (label: string, onPress: () => void, aria?: string) => (
    <button
      key={label}
      type="button"
      disabled={disabled}
      aria-label={aria ?? label}
      onClick={() => {
        sfx.tap();
        onPress();
      }}
      className="btn-3d flex min-h-[60px] items-center justify-center rounded-tile border-2 font-display text-2xl font-bold disabled:opacity-40"
      style={{
        background: "#fff",
        borderColor: "var(--color-line)",
        color: "var(--color-ink)",
        ["--btn-shade" as string]: "var(--color-line)",
      }}
    >
      {label === "back" ? <Icon name="backspace" size={26} /> : label}
    </button>
  );

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="grid grid-cols-3 gap-2">
        {KEYS.map((k) => key(k, () => onInput(k)))}
        {allowMinus ? key("-", () => onInput("-"), "minus") : <span key="gap" />}
        {key("0", () => onInput("0"))}
        {key("back", () => onBackspace(), "backspace")}
      </div>
      <Button
        color={color}
        size="lg"
        fullWidth
        disabled={disabled || checkDisabled}
        onClick={onCheck}
      >
        {checkLabel}
      </Button>
    </div>
  );
}

export { NumberPad };
