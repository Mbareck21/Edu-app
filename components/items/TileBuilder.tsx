"use client";

import { useState } from "react";

import Button from "@/components/ui/Button";
import { sfx } from "@/lib/sfx";

export type TileBuilderProps = {
  /** Scrambled letters. */
  tiles: string[];
  onSubmit: (built: string) => void;
  disabled?: boolean;
  checkLabel?: string;
};

/** Build a word from letter tiles. Tap a tile to add it, tap it back to undo. */
export default function TileBuilder({
  tiles,
  onSubmit,
  disabled = false,
  checkLabel = "Check",
}: TileBuilderProps) {
  // The runner remounts this on every new item, so there is nothing to reset.
  const [used, setUsed] = useState<number[]>([]);

  const built = used.map((i) => tiles[i]).join("");

  function add(index: number) {
    if (disabled || used.includes(index)) return;
    sfx.tap();
    setUsed((u) => [...u, index]);
  }

  function removeAt(slot: number) {
    if (disabled) return;
    sfx.tap();
    setUsed((u) => u.filter((_, i) => i !== slot));
  }

  return (
    <div className="space-y-4">
      {/* What is built so far */}
      <div
        className="flex min-h-[68px] flex-wrap items-center justify-center gap-1.5 rounded-tile border-2 border-dashed px-3 py-3"
        style={{ borderColor: "var(--color-line)", background: "#fff" }}
        aria-live="polite"
      >
        {used.length === 0 ? (
          <span className="font-body text-sm" style={{ color: "var(--color-faint)" }}>
            Tap the letters
          </span>
        ) : (
          used.map((tileIndex, slot) => (
            <button
              key={`${tileIndex}-${slot}`}
              type="button"
              disabled={disabled}
              onClick={() => removeAt(slot)}
              className="press-3d min-h-[44px] min-w-[38px] rounded-tile border-2 px-2 font-display text-xl font-bold uppercase"
              style={{
                borderColor: "var(--color-blue)",
                background: "var(--color-blue-soft)",
                color: "var(--color-blue-dark)",
              }}
            >
              {tiles[tileIndex]}
            </button>
          ))
        )}
      </div>

      {/* The letter bank */}
      <div className="flex flex-wrap justify-center gap-2">
        {tiles.map((tile, index) => {
          const taken = used.includes(index);
          return (
            <button
              key={`${tile}-${index}`}
              type="button"
              disabled={disabled || taken}
              onClick={() => add(index)}
              className="press-3d min-h-[56px] min-w-[52px] rounded-tile border-2 px-3 font-display text-2xl font-bold uppercase"
              style={
                taken
                  ? {
                      borderColor: "var(--color-line)",
                      background: "var(--color-sand)",
                      color: "transparent",
                    }
                  : {
                      borderColor: "var(--color-line)",
                      background: "#fff",
                      color: "var(--color-ink)",
                    }
              }
            >
              {tile}
            </button>
          );
        })}
      </div>

      <Button
        color="green"
        size="lg"
        fullWidth
        disabled={disabled || built.length === 0}
        onClick={() => onSubmit(built)}
      >
        {checkLabel}
      </Button>
    </div>
  );
}

export { TileBuilder };
