import type { CSSProperties } from "react";
import type { CrosswordPlacement } from "@/lib/crossword";

export default function CrosswordGrid({
  rows,
  cols,
  grid,
  placed,
  showAnswers,
}: {
  rows: number;
  cols: number;
  grid: (string | null)[][];
  placed: CrosswordPlacement[];
  showAnswers: boolean;
}) {
  const posMap = new Map<string, number>();
  for (const p of placed) posMap.set(`${p.startRow},${p.startCol}`, p.position);

  // --ws-cols feeds the .ws-grid CSS class — cell size lives in CSS so the
  // print media query can switch it to mm.
  const styleVars = { "--ws-cols": cols } as CSSProperties;

  return (
    <div className="print-center">
      <div className="ws-grid border-2 border-black font-semibold" style={styleVars}>
        {Array.from({ length: rows }).flatMap((_, r) =>
          Array.from({ length: cols }).map((_, c) => {
            const cell = grid[r][c];
            const pos = posMap.get(`${r},${c}`);
            if (cell === null) {
              return <div key={`${r}-${c}`} className="bg-black" />;
            }
            return (
              <div
                key={`${r}-${c}`}
                className="relative flex items-center justify-center border border-black bg-white"
              >
                {pos !== undefined && (
                  <span className="ws-num absolute left-0.5 top-0 font-normal leading-none">{pos}</span>
                )}
                {showAnswers ? cell.toUpperCase() : ""}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
