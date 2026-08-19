"use client";

import { Fragment, useMemo, type ReactNode } from "react";

import type { VocabGloss } from "@/lib/models/WordList";
import { splitParagraphs } from "@/lib/reading";

export type PassageProps = {
  text: string;
  glosses: VocabGloss[];
  /** Index of the paragraph the audio is on, or null. */
  activeParagraph?: number | null;
  /** A sentence from the passage to mark — the answer's source on reveal. */
  highlight?: string;
  onGlossTap?: (gloss: VocabGloss) => void;
  className?: string;
};

/**
 * Every inflection of a glossed word that should still light up in the text.
 * The model returns base forms; the passage uses whatever fits the sentence.
 */
function formsOf(word: string): string[] {
  const w = word.toLowerCase();
  const stem = w.endsWith("e") ? w.slice(0, -1) : w;
  return [w, `${w}s`, `${w}es`, `${w}ed`, `${w}ing`, `${stem}ing`, `${stem}ed`];
}

function buildLookup(glosses: VocabGloss[]): Map<string, VocabGloss> {
  const map = new Map<string, VocabGloss>();
  for (const g of glosses) {
    if (!g.word || (!g.meaning && !g.arabic)) continue;
    if (g.word.includes(" ")) continue; // multi-word glosses are not tokenised
    for (const form of formsOf(g.word)) {
      if (!map.has(form)) map.set(form, g);
    }
  }
  return map;
}

function GlossWord({
  token,
  gloss,
  onTap,
}: {
  token: string;
  gloss: VocabGloss;
  onTap?: (g: VocabGloss) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onTap?.(gloss)}
      className="rounded px-0.5 font-bold underline decoration-dotted decoration-2 underline-offset-4"
      style={{ color: "var(--color-green-dark)", textDecorationColor: "var(--color-green)" }}
    >
      {token}
    </button>
  );
}

/** Splits a run of text into words, wrapping the glossed ones in a tap target. */
function renderRun(
  text: string,
  lookup: Map<string, VocabGloss>,
  onTap: PassageProps["onGlossTap"],
  keyPrefix: string
): ReactNode {
  if (lookup.size === 0) return text;
  const parts = text.split(/([A-Za-z]+)/g);
  return parts.map((tok, i) => {
    if (!tok) return null;
    const gloss = /^[A-Za-z]+$/.test(tok) ? lookup.get(tok.toLowerCase()) : undefined;
    if (gloss) {
      return (
        <GlossWord key={`${keyPrefix}-${i}`} token={tok} gloss={gloss} onTap={onTap} />
      );
    }
    return <Fragment key={`${keyPrefix}-${i}`}>{tok}</Fragment>;
  });
}

export default function Passage({
  text,
  glosses,
  activeParagraph = null,
  highlight,
  onGlossTap,
  className = "",
}: PassageProps) {
  const lookup = useMemo(() => buildLookup(glosses), [glosses]);
  const paragraphs = useMemo(() => splitParagraphs(text), [text]);
  const mark = highlight?.trim() ?? "";

  return (
    <div className={`space-y-4 ${className}`}>
      {paragraphs.map((para, pi) => {
        const active = activeParagraph === pi;
        const at = mark ? para.indexOf(mark) : -1;
        const body: ReactNode =
          at >= 0 ? (
            <>
              {renderRun(para.slice(0, at), lookup, onGlossTap, `${pi}a`)}
              <mark
                className="rounded px-1"
                style={{ background: "var(--color-gold-soft)", color: "var(--color-ink)" }}
              >
                {renderRun(mark, lookup, onGlossTap, `${pi}m`)}
              </mark>
              {renderRun(para.slice(at + mark.length), lookup, onGlossTap, `${pi}b`)}
            </>
          ) : (
            renderRun(para, lookup, onGlossTap, `${pi}`)
          );

        return (
          <p
            key={pi}
            className="rounded-tile px-2 py-1 text-[19px] leading-[1.7] transition-colors"
            style={
              active
                ? { background: "var(--color-green-soft)" }
                : activeParagraph === null
                  ? undefined
                  : { color: "var(--color-muted)" }
            }
          >
            {body}
          </p>
        );
      })}
    </div>
  );
}

export { Passage };
