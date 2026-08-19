// Pictures for the math engine's Visual union. One small component per kind.
// No hooks, no state: the renderer is a pure function of the question.

import type { ReactNode } from "react";

import type { DataRow, MathOp, PlaceName, ShapeName, Visual } from "@/lib/math";

const PURPLE = "var(--color-purple)";
const PURPLE_SOFT = "var(--color-purple-soft)";
const LINE = "var(--color-line)";
const INK = "var(--color-ink)";
const MUTED = "var(--color-muted)";

export type VisualRendererProps = {
  visual: Visual;
  /** Lets the bar model know whether the total is given or asked for. */
  op?: MathOp;
};

export default function VisualRenderer({ visual, op }: VisualRendererProps) {
  switch (visual.kind) {
    case "groups":
      return <Frame><Groups groups={visual.groups} per={visual.per} /></Frame>;
    case "bar":
      return <Frame><BarModel a={visual.a} b={visual.b} op={op} /></Frame>;
    case "placevalue":
      return <Frame><PlaceValue value={visual.value} place={visual.place} /></Frame>;
    case "rect":
      return <Frame><RectShape w={visual.w} h={visual.h} label={visual.label} /></Frame>;
    case "table":
      return <Frame><DataTable rows={visual.rows} /></Frame>;
    case "bars":
      return <Frame><BarChart bars={visual.bars} scale={visual.scale} /></Frame>;
    case "angle":
      return <Frame><AngleWedge total={visual.total} known={visual.known} /></Frame>;
    case "shape":
      return <Frame><PlaneShape name={visual.name} /></Frame>;
    default:
      return null;
  }
}

function Frame({ children }: { children: ReactNode }) {
  return <div className="mt-4 flex w-full justify-center">{children}</div>;
}

// ------------------------------------------------------------------- groups

function Groups({ groups, per }: { groups: number; per: number }) {
  const cols = Math.min(per, 5);
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {Array.from({ length: groups }, (_, g) => (
        <div key={g} className="rounded-tile border-2 p-1.5" style={{ borderColor: PURPLE_SOFT }}>
          <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${cols}, 8px)` }}>
            {Array.from({ length: per }, (_, d) => (
              <span key={d} className="h-2 w-2 rounded-full" style={{ background: PURPLE }} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- bar model

/** Two parts and a whole. On a take-away question `a` is the whole. */
function BarModel({ a, b, op }: { a: number; b: number; op?: MathOp }) {
  const takeAway = op === "-";
  const parts = takeAway
    ? [
        { label: String(b), value: b, known: true },
        { label: "?", value: Math.max(a - b, 1), known: false },
      ]
    : [
        { label: String(a), value: a, known: true },
        { label: String(b), value: b, known: true },
      ];
  const span = parts.reduce((sum, p) => sum + p.value, 0) || 1;

  return (
    <div className="w-full max-w-[300px]">
      <div className="flex h-11 overflow-hidden rounded-tile border-2" style={{ borderColor: PURPLE }}>
        {parts.map((p, i) => (
          <div
            key={i}
            className="flex min-w-0 items-center justify-center font-display text-sm font-bold"
            style={{
              flex: `${Math.max(p.value / span, 0.2)} 1 0%`,
              background: p.known ? PURPLE_SOFT : "#fff",
              color: p.known ? "var(--color-purple-dark)" : MUTED,
              borderLeft: i > 0 ? `2px solid ${PURPLE}` : undefined,
            }}
          >
            {p.label}
          </div>
        ))}
      </div>
      <p className="mt-1 text-center font-display text-sm font-bold" style={{ color: MUTED }}>
        In all: {takeAway ? String(a) : "?"}
      </p>
    </div>
  );
}

// -------------------------------------------------------------- place value

const PLACE_FROM_RIGHT: Record<PlaceName, number> = {
  ones: 0,
  tens: 1,
  hundreds: 2,
  thousands: 3,
};

const PLACE_LABELS = ["1s", "10s", "100s", "1,000s", "10,000s", "100,000s"];

function PlaceValue({ value, place }: { value: number; place: PlaceName }) {
  const digits = String(value).split("");
  const target = PLACE_FROM_RIGHT[place];
  return (
    <div className="flex gap-1">
      {digits.map((d, i) => {
        const fromRight = digits.length - 1 - i;
        const on = fromRight === target;
        return (
          <div key={i} className="text-center">
            <div
              className="flex h-11 w-9 items-center justify-center rounded-tile border-2 font-display text-xl font-bold"
              style={{
                borderColor: on ? PURPLE : LINE,
                background: on ? PURPLE_SOFT : "#fff",
                color: on ? "var(--color-purple-dark)" : INK,
              }}
            >
              {d}
            </div>
            <p className="mt-1 text-[10px] font-bold" style={{ color: on ? PURPLE : MUTED }}>
              {PLACE_LABELS[fromRight] ?? ""}
            </p>
          </div>
        );
      })}
    </div>
  );
}

// -------------------------------------------------------------- rectangles

function RectShape({ w, h, label }: { w: number; h: number; label: "area" | "perimeter" }) {
  const big = Math.max(w, h);
  const cell = 110 / big;
  const rw = Math.max(w * cell, 40);
  const rh = Math.max(h * cell, 30);
  const x = (200 - rw) / 2;
  const y = 22;
  const grid = label === "area" && w <= 15 && h <= 15;

  return (
    <svg viewBox={`0 0 200 ${rh + 60}`} width="100%" style={{ maxWidth: 260 }} role="img" aria-label={`Rectangle ${w} by ${h}`}>
      {grid
        ? Array.from({ length: w * h }, (_, i) => (
            <rect
              key={i}
              x={x + (i % w) * (rw / w)}
              y={y + Math.floor(i / w) * (rh / h)}
              width={rw / w}
              height={rh / h}
              fill={PURPLE_SOFT}
              stroke="#fff"
              strokeWidth={1}
            />
          ))
        : <rect x={x} y={y} width={rw} height={rh} fill={PURPLE_SOFT} />}
      <rect x={x} y={y} width={rw} height={rh} fill="none" stroke={PURPLE} strokeWidth={3} rx={2} />
      <text x={x + rw / 2} y={y - 7} textAnchor="middle" fontSize={15} fontWeight={700} fill={INK}>
        {w}
      </text>
      <text x={x + rw + 9} y={y + rh / 2 + 5} fontSize={15} fontWeight={700} fill={INK}>
        {h}
      </text>
      <text x={100} y={rh + 50} textAnchor="middle" fontSize={12} fontWeight={700} fill={MUTED}>
        {label === "area" ? "Area = inside" : "Perimeter = all around"}
      </text>
    </svg>
  );
}

// -------------------------------------------------------------------- data

function DataTable({ rows }: { rows: readonly DataRow[] }) {
  return (
    <table className="w-full max-w-[260px] overflow-hidden rounded-tile border-2" style={{ borderColor: LINE }}>
      <thead>
        <tr style={{ background: PURPLE_SOFT }}>
          <th className="px-3 py-1.5 text-left font-display text-sm" style={{ color: "var(--color-purple-dark)" }}>
            Color
          </th>
          <th className="px-3 py-1.5 text-right font-display text-sm" style={{ color: "var(--color-purple-dark)" }}>
            Kids
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.label} style={{ borderTop: `1px solid ${LINE}` }}>
            <td className="px-3 py-1.5 text-left text-sm font-bold">{r.label}</td>
            <td className="px-3 py-1.5 text-right font-display text-base font-bold">{r.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Bars are read off the grid lines, so no numbers are printed on them. */
function BarChart({ bars, scale }: { bars: readonly DataRow[]; scale: number }) {
  const top = Math.max(...bars.map((b) => b.value), scale);
  const steps = Math.max(1, Math.round(top / scale));
  const ticks = Array.from({ length: steps + 1 }, (_, i) => i * scale);

  return (
    <div className="w-full max-w-[300px]">
      {bars.map((b) => (
        <div key={b.label} className="mb-1.5 flex items-center gap-2">
          <span className="w-12 shrink-0 text-right text-xs font-bold" style={{ color: MUTED }}>
            {b.label}
          </span>
          <div className="relative h-6 flex-1" style={{ borderLeft: `2px solid ${LINE}` }}>
            {ticks.slice(1).map((t) => (
              <span
                key={t}
                className="absolute top-0 bottom-0 w-px"
                style={{ left: `${(t / top) * 100}%`, background: LINE }}
              />
            ))}
            <span
              className="absolute top-1 bottom-1 left-0 rounded-r"
              style={{ width: `${(b.value / top) * 100}%`, background: PURPLE }}
            />
          </div>
        </div>
      ))}
      <div className="ml-14 flex justify-between text-[10px] font-bold" style={{ color: MUTED }}>
        {ticks.map((t) => (
          <span key={t}>{t}</span>
        ))}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ angles

type Pt = { x: number; y: number };

function onCircle(cx: number, cy: number, r: number, deg: number): Pt {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) };
}

/** Pie slice from `from`° to `to`°, counter-clockwise on screen. */
function sector(cx: number, cy: number, r: number, from: number, to: number): string {
  const p1 = onCircle(cx, cy, r, from);
  const p2 = onCircle(cx, cy, r, to);
  const big = to - from > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${p1.x.toFixed(1)} ${p1.y.toFixed(1)} A ${r} ${r} 0 ${big} 0 ${p2.x.toFixed(1)} ${p2.y.toFixed(1)} Z`;
}

function AngleWedge({ total, known }: { total: number; known: number }) {
  const cx = 100;
  const cy = total === 180 ? 96 : total === 360 ? 80 : 110;
  const r = 66;
  const rest = Math.max(total - known, 0);
  const knownMid = known / 2;
  const restMid = known + rest / 2;
  const knownLabel = onCircle(cx, cy, r * 0.6, knownMid);
  const restLabel = onCircle(cx, cy, r * 0.6, restMid);

  return (
    <svg viewBox="0 0 200 170" width="100%" style={{ maxWidth: 240 }} role="img" aria-label={`${total} degrees, ${known} known`}>
      <path d={sector(cx, cy, r, 0, known)} fill={PURPLE_SOFT} />
      <path d={sector(cx, cy, r, known, total)} fill="#fff" />
      {total === 360 ? (
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={PURPLE} strokeWidth={3} />
      ) : (
        <path d={sector(cx, cy, r, 0, total)} fill="none" stroke={PURPLE} strokeWidth={3} strokeLinejoin="round" />
      )}
      <line
        x1={cx}
        y1={cy}
        x2={onCircle(cx, cy, r, known).x}
        y2={onCircle(cx, cy, r, known).y}
        stroke={PURPLE}
        strokeWidth={3}
        strokeLinecap="round"
      />
      <text x={knownLabel.x} y={knownLabel.y + 5} textAnchor="middle" fontSize={14} fontWeight={700} fill="var(--color-purple-dark)">
        {known}°
      </text>
      {rest > 0 ? (
        <text x={restLabel.x} y={restLabel.y + 5} textAnchor="middle" fontSize={16} fontWeight={700} fill={MUTED}>
          ?
        </text>
      ) : null}
      <text x={100} y={162} textAnchor="middle" fontSize={12} fontWeight={700} fill={MUTED}>
        {total}° in all
      </text>
    </svg>
  );
}

// ------------------------------------------------------------------ shapes

type ShapeDef = {
  points: Pt[];
  /** Corner indexes that are right angles. */
  right?: number[];
  /** Ticks per side (side i runs from point i to point i+1). Equal sides match. */
  ticks?: number[];
  /** Chevrons per side. Sides with the same count are parallel. */
  arrows?: number[];
};

const SHAPES: Record<ShapeName, ShapeDef> = {
  rectangle: {
    points: [
      { x: 28, y: 28 },
      { x: 172, y: 28 },
      { x: 172, y: 108 },
      { x: 28, y: 108 },
    ],
    right: [0, 1, 2, 3],
    ticks: [1, 2, 1, 2],
  },
  square: {
    points: [
      { x: 62, y: 24 },
      { x: 142, y: 24 },
      { x: 142, y: 104 },
      { x: 62, y: 104 },
    ],
    right: [0, 1, 2, 3],
    ticks: [1, 1, 1, 1],
  },
  rhombus: {
    points: [
      { x: 100, y: 20 },
      { x: 168, y: 68 },
      { x: 100, y: 116 },
      { x: 32, y: 68 },
    ],
    ticks: [1, 1, 1, 1],
  },
  parallelogram: {
    points: [
      { x: 58, y: 26 },
      { x: 180, y: 26 },
      { x: 142, y: 108 },
      { x: 20, y: 108 },
    ],
    arrows: [1, 2, 1, 2],
  },
  trapezoid: {
    points: [
      { x: 68, y: 26 },
      { x: 132, y: 26 },
      { x: 176, y: 108 },
      { x: 24, y: 108 },
    ],
    arrows: [1, 0, 1, 0],
  },
  "right triangle": {
    points: [
      { x: 36, y: 108 },
      { x: 36, y: 26 },
      { x: 164, y: 108 },
    ],
    right: [0],
  },
  "acute triangle": {
    points: [
      { x: 100, y: 22 },
      { x: 166, y: 110 },
      { x: 34, y: 110 },
    ],
  },
  "obtuse triangle": {
    points: [
      { x: 60, y: 110 },
      { x: 180, y: 110 },
      { x: 30, y: 40 },
    ],
  },
};

function unitVec(from: Pt, to: Pt): Pt {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
}

function rightAngleMark(p: Pt, a: Pt, b: Pt): string {
  const u = unitVec(p, a);
  const v = unitVec(p, b);
  const s = 12;
  return `M ${p.x + u.x * s} ${p.y + u.y * s} L ${p.x + (u.x + v.x) * s} ${p.y + (u.y + v.y) * s} L ${p.x + v.x * s} ${p.y + v.y * s}`;
}

/** Small dashes across a side. Sides with the same number are equal. */
function tickPaths(a: Pt, b: Pt, count: number): string[] {
  const u = unitVec(a, b);
  const n = { x: -u.y, y: u.x };
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  return Array.from({ length: count }, (_, i) => {
    const off = (i - (count - 1) / 2) * 6;
    const cx = mx + u.x * off;
    const cy = my + u.y * off;
    return `M ${cx - n.x * 6} ${cy - n.y * 6} L ${cx + n.x * 6} ${cy + n.y * 6}`;
  });
}

/** Arrow heads along a side. Sides with the same number are parallel. */
function arrowPaths(a: Pt, b: Pt, count: number): string[] {
  const raw = unitVec(a, b);
  // Parallel sides run in opposite directions around the polygon; point every
  // arrow the same way so a marked pair reads as parallel.
  const flip = raw.x < -0.01 || (Math.abs(raw.x) <= 0.01 && raw.y < 0);
  const u = flip ? { x: -raw.x, y: -raw.y } : raw;
  const n = { x: -u.y, y: u.x };
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  return Array.from({ length: count }, (_, i) => {
    const off = (i - (count - 1) / 2) * 7;
    const cx = mx + u.x * off;
    const cy = my + u.y * off;
    const tail = { x: cx - u.x * 5, y: cy - u.y * 5 };
    const tip = { x: cx + u.x * 4, y: cy + u.y * 4 };
    return `M ${tail.x + n.x * 5} ${tail.y + n.y * 5} L ${tip.x} ${tip.y} L ${tail.x - n.x * 5} ${tail.y - n.y * 5}`;
  });
}

function PlaneShape({ name }: { name: ShapeName }) {
  const def = SHAPES[name];
  const pts = def.points;
  const marks: string[] = [];

  pts.forEach((p, i) => {
    const next = pts[(i + 1) % pts.length];
    const prev = pts[(i - 1 + pts.length) % pts.length];
    if (def.right?.includes(i)) marks.push(rightAngleMark(p, prev, next));
    const ticks = def.ticks?.[i] ?? 0;
    if (ticks > 0) marks.push(...tickPaths(p, next, ticks));
    const arrows = def.arrows?.[i] ?? 0;
    if (arrows > 0) marks.push(...arrowPaths(p, next, arrows));
  });

  return (
    <svg viewBox="0 0 200 132" width="100%" style={{ maxWidth: 240 }} role="img" aria-label={name}>
      <polygon
        points={pts.map((p) => `${p.x},${p.y}`).join(" ")}
        fill={PURPLE_SOFT}
        stroke={PURPLE}
        strokeWidth={3}
        strokeLinejoin="round"
      />
      {marks.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="var(--color-purple-dark)" strokeWidth={2} strokeLinecap="round" />
      ))}
    </svg>
  );
}

export { VisualRenderer };
