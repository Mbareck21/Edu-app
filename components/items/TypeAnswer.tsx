"use client";

import { useEffect, useRef, useState } from "react";

import Button from "@/components/ui/Button";

export type TypeAnswerProps = {
  onSubmit: (typed: string) => void;
  disabled?: boolean;
  /** One letter off: keep what he typed and let him look again. */
  almost?: boolean;
  placeholder?: string;
  checkLabel?: string;
};

/**
 * Typed recall. Autocorrect, autocapitalise and spellcheck are all off — the
 * phone must not spell the word for him.
 */
export default function TypeAnswer({
  onSubmit,
  disabled = false,
  almost = false,
  placeholder = "Type it",
  checkLabel = "Check",
}: TypeAnswerProps) {
  const [value, setValue] = useState("");
  const input = useRef<HTMLInputElement | null>(null);

  // One mount per item (the runner keys it), so focus once and keep the text
  // when a near miss sends him back for another look.
  useEffect(() => {
    input.current?.focus();
  }, [almost]);

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (disabled || !value.trim()) return;
        onSubmit(value);
      }}
    >
      <input
        ref={input}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        aria-label="Your answer"
        type="text"
        inputMode="text"
        enterKeyHint="done"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        maxLength={40}
        className={`w-full rounded-tile border-2 px-4 text-center font-display text-2xl font-bold lowercase outline-none ${almost ? "q-shake" : ""}`}
        style={{
          minHeight: 64,
          background: "#fff",
          borderColor: almost ? "var(--color-gold)" : "var(--color-line)",
          color: "var(--color-ink)",
        }}
      />
      {almost ? (
        <p
          className="text-center font-display text-sm font-bold"
          style={{ color: "var(--color-gold-ink)" }}
        >
          Almost! Look again.
        </p>
      ) : null}
      <Button type="submit" color="green" size="lg" fullWidth disabled={disabled || !value.trim()}>
        {checkLabel}
      </Button>
    </form>
  );
}

export { TypeAnswer };
