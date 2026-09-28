import Link from "next/link";

import type { Suggestion } from "@/components/drill/suggest";
import { buttonClass, buttonStyle } from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";

/** The one drill to do next, a tap away; everything else is still below. */
export default function SuggestedDrill({ suggestion }: { suggestion: Suggestion | null }) {
  if (!suggestion) return null;
  const color = suggestion.kind === "words" ? "blue" : "purple";
  return (
    <div
      className="mt-3 rounded-card border-2 p-4 shadow-card"
      style={{ background: `var(--color-${color}-soft)`, borderColor: `var(--color-${color})` }}
    >
      <p
        className="flex items-center gap-1 text-xs font-bold uppercase tracking-wide"
        style={{ color: `var(--color-${color}-dark)` }}
      >
        <Icon name="sparkles" size={14} />
        Suggested for you
      </p>
      <div className="mt-2 flex items-center gap-3">
        <span
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
          style={{ background: `var(--color-${color})`, color: "#fff" }}
        >
          <Icon name={suggestion.kind === "words" ? "words" : "math"} size={26} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg font-bold leading-tight">{suggestion.title}</p>
          <p className="text-sm" style={{ color: "var(--color-muted)" }}>
            {suggestion.line}
          </p>
        </div>
        <Link
          href={suggestion.href}
          className={buttonClass({ size: "md", className: "shrink-0 px-5" })}
          style={buttonStyle({ color })}
        >
          Go
        </Link>
      </div>
    </div>
  );
}

export { SuggestedDrill };
