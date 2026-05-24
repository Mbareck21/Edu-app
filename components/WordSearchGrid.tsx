import type { Placement } from "@/lib/wordsearch";

const CELL = 30; // px

export default function WordSearchGrid({
  rows,
  cols,
  grid,
  highlight,
}: {
  rows: number;
  cols: number;
  grid: string[][];
  highlight: Placement[];
}) {
  const highlighted = new Set<string>();
  for (const p of highlight) {
    for (let i = 0; i < p.word.length; i++) {
      const r = p.row + i * p.dRow;
      const c = p.col + i * p.dCol;
      highlighted.add(`${r},${c}`);
    }
  }

  return (
    <div
      className="inline-grid border-2 border-black font-mono"
      style={{ gridTemplateColumns: `repeat(${cols}, ${CELL}px)`, gridAutoRows: `${CELL}px` }}
    >
      {Array.from({ length: rows }).flatMap((_, r) =>
        Array.from({ length: cols }).map((_, c) => {
          const k = `${r},${c}`;
          const lit = highlighted.has(k);
          return (
            <div
              key={k}
              className={
                "flex items-center justify-center border border-black uppercase " +
                (lit ? "bg-yellow-200 font-bold" : "bg-white")
              }
            >
              {grid[r][c]}
            </div>
          );
        })
      )}
    </div>
  );
}
