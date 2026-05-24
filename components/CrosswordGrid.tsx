import type { CrosswordPlacement } from "@/lib/crossword";

const CELL = 32; // px

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

  return (
    <div
      className="inline-grid border-2 border-black"
      style={{
        gridTemplateColumns: `repeat(${cols}, ${CELL}px)`,
        gridAutoRows: `${CELL}px`,
      }}
    >
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
              className="relative flex items-center justify-center border border-black bg-white text-lg font-semibold"
            >
              {pos !== undefined && (
                <span className="absolute left-0.5 top-0 text-[9px] font-normal leading-none">{pos}</span>
              )}
              {showAnswers ? cell.toUpperCase() : ""}
            </div>
          );
        })
      )}
    </div>
  );
}
