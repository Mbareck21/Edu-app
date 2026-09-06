"use client";

import { useMemo, useState } from "react";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import TablesRunner from "@/components/tables/TablesRunner";
import {
  TABLES,
  TABLE_UP_TO,
  buildLightningRound,
  buildTableRound,
  factKey,
  isKnown,
  tableProgress,
  type Fact,
  type FactState,
} from "@/lib/tables";

export type TablesBoardProps = {
  facts: Record<string, FactState>;
  /** A per-visit seed, so the flips differ each visit without Math.random in render. */
  seed: number;
};

function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Run = { facts: Fact[]; label: string; sessionRef: string };

/**
 * The grid, and the way into a round.
 *
 * Eight rows by ten: a cell lights when he knows the fact, gold when he
 * knows it fast. 7x8 and 8x7 are one fact, so both cells light together.
 * Filling the grid is the whole game.
 */
export default function TablesBoard({ facts, seed }: TablesBoardProps) {
  const [running, setRunning] = useState<Run | null>(null);
  const rng = useMemo(() => mulberry(seed % 2147483647), [seed]);
  const nowIso = useMemo(() => new Date(seed).toISOString(), [seed]);

  const progress = TABLES.map((t) => tableProgress(t, facts));
  const known = Object.values(facts).filter(isKnown).length;
  const total = new Set(
    TABLES.flatMap((t) => Array.from({ length: TABLE_UP_TO }, (_, i) => factKey(t, i + 1)))
  ).size;
  const lightning = buildLightningRound(facts, nowIso, rng);

  if (running) {
    return (
      <div className="-mx-4">
        <TablesRunner
          facts={running.facts}
          label={running.label}
          sessionRef={running.sessionRef}
          onDone={() => {
            setRunning(null);
            // The grid moved on the server; take the page again so it and the
            // round can never disagree about what is lit.
            window.location.reload();
          }}
        />
      </div>
    );
  }

  const cell = (t: number, i: number) => {
    const f = facts[factKey(t, i + 1)];
    const lit = f ? isKnown(f) : false;
    const gold = lit && Boolean(f?.lastFast);
    return { lit, gold, value: t * (i + 1) };
  };

  return (
    <div className="mt-4 space-y-5">
      <Card>
        <div className="flex items-baseline justify-between">
          <p className="font-display text-base font-bold">The grid</p>
          <p className="text-sm" style={{ color: "var(--color-muted)" }}>
            {known} of {total} lit
          </p>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table
            className="w-full border-separate"
            style={{ borderSpacing: 3 }}
            aria-label="Times tables grid"
          >
            <thead>
              <tr>
                <th className="text-xs font-bold" style={{ color: "var(--color-muted)" }}>
                  x
                </th>
                {Array.from({ length: TABLE_UP_TO }, (_, i) => (
                  <th key={i} className="text-xs font-bold" style={{ color: "var(--color-muted)" }}>
                    {i + 1}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TABLES.map((t) => (
                <tr key={t}>
                  <th className="text-xs font-bold" style={{ color: "var(--color-muted)" }}>
                    {t}
                  </th>
                  {Array.from({ length: TABLE_UP_TO }, (_, i) => {
                    const c = cell(t, i);
                    return (
                      <td key={i} className="p-0">
                        <div
                          className="flex h-7 w-full items-center justify-center rounded text-[10px] font-bold"
                          title={`${t} x ${i + 1} = ${c.value}`}
                          style={{
                            background: c.gold
                              ? "var(--color-gold)"
                              : c.lit
                                ? "var(--color-purple)"
                                : "var(--color-line)",
                            color: c.lit ? "#fff" : "var(--color-muted)",
                          }}
                        >
                          {c.lit ? c.value : ""}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs" style={{ color: "var(--color-muted)" }}>
          Purple: you know it. Gold: you know it fast. 7 x 8 and 8 x 7 light up together.
        </p>
      </Card>

      {lightning.length > 0 ? (
        <Button
          fullWidth
          size="lg"
          color="gold"
          onClick={() =>
            setRunning({ facts: lightning, label: "Lightning", sessionRef: "tables:lightning" })
          }
        >
          Lightning round: your ten weakest
        </Button>
      ) : null}

      <div className="space-y-2">
        {progress.map((p) => {
          const done = p.known === p.total;
          return (
            <Card key={p.table}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display text-lg font-bold">{p.table} times table</p>
                  <p className="text-sm" style={{ color: "var(--color-muted)" }}>
                    {done
                      ? p.fast === p.total
                        ? "All ten, all fast."
                        : `All ten known, ${p.fast} fast`
                      : `${p.known} of ${p.total} known`}
                  </p>
                </div>
                <Button
                  size="md"
                  color={done ? "green" : "purple"}
                  variant={done ? "secondary" : "primary"}
                  onClick={() =>
                    setRunning({
                      facts: buildTableRound(p.table, facts, nowIso, rng),
                      label: `Table ${p.table}`,
                      sessionRef: `tables:${p.table}`,
                    })
                  }
                >
                  {done ? "Keep it" : p.known > 0 ? "Go on" : "Start"}
                </Button>
              </div>
              <div className="mt-3 flex gap-1" aria-hidden>
                {Array.from({ length: TABLE_UP_TO }, (_, i) => {
                  const c = cell(p.table, i);
                  return (
                    <span
                      key={i}
                      className="h-2 flex-1 rounded-full"
                      style={{
                        background: c.gold
                          ? "var(--color-gold)"
                          : c.lit
                            ? "var(--color-purple)"
                            : "var(--color-line)",
                      }}
                    />
                  );
                })}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export { TablesBoard };
