// Inline SVG icon set. One 24x24 grid, stroke 2.4, round caps — no emoji
// anywhere in this app. Server-safe (no hooks, no client boundary).

const PATHS = {
  home: ["M3 11.2 12 3.6l9 7.6", "M5.6 10v10h12.8V10", "M10 20v-5h4v5"],
  math: [
    "M3.5 7.8h6",
    "M6.5 4.8v6",
    "M14.5 7.8h6",
    "M14.6 15.2l5.8 5.8",
    "M20.4 15.2l-5.8 5.8",
    "M3.5 18.2h6",
  ],
  words: ["M4.5 4.5h15v15h-15z", "M8.6 15.6 12 8l3.4 7.6", "M9.8 13.2h4.4"],
  me: [
    "M12 11.4a3.7 3.7 0 1 0 0-7.4 3.7 3.7 0 0 0 0 7.4z",
    "M4.6 20.2c0-3.6 3.3-6 7.4-6s7.4 2.4 7.4 6",
  ],
  check: ["M4.5 12.6 9.8 18 19.6 6.4"],
  x: ["M6 6l12 12", "M18 6 6 18"],
  lock: ["M5.2 10.4h13.6V20H5.2z", "M8.4 10.4V7.8a3.6 3.6 0 0 1 7.2 0v2.6"],
  star: ["M12 3.6l2.75 5.6 6.15.9-4.45 4.3 1.05 6.1L12 17.6l-5.5 2.9 1.05-6.1L3.1 10.1l6.15-.9z"],
  flame: [
    "M12 3.4c.4 3.9-.4 5.6-1.5 5.6-.9 0-1.6-.8-2-2C7.2 8.4 6 10.2 6 12.6a6 6 0 0 0 12 0c0-4.4-3.6-7.4-6-9.2z",
    "M12 20.4a2.7 2.7 0 0 1-2.7-2.7c0-1.7 1.5-2.6 2.7-4.3 1.2 1.7 2.7 2.6 2.7 4.3A2.7 2.7 0 0 1 12 20.4z",
  ],
  trophy: [
    "M7 3.8h10v5.4a5 5 0 0 1-10 0z",
    "M7 5.8H4.2v1.4A3.6 3.6 0 0 0 7.8 10.8",
    "M17 5.8h2.8v1.4a3.6 3.6 0 0 1-3.6 3.6",
    "M12 14.2v3.4",
    "M8.4 20.2h7.2",
  ],
  bolt: ["M13.6 3.2 5.4 13.6h5.2L10.4 20.8l8.2-10.4h-5.2z"],
  volume: [
    "M4 9.4h3.6L12 5.4v13.2L7.6 14.6H4z",
    "M15.6 9.4a4.2 4.2 0 0 1 0 5.2",
    "M18.4 6.6a8 8 0 0 1 0 10.8",
  ],
  book: [
    "M12 6.6C10.4 5 7.9 4.3 4 4.5v13c3.9-.2 6.4.5 8 2 1.6-1.5 4.1-2.2 8-2v-13c-3.9-.2-6.4.5-8 2z",
    "M12 6.6v12.9",
  ],
  chest: [
    "M3.6 9.6h16.8V20H3.6z",
    "M3.6 9.6 5.2 4.4h13.6l1.6 5.2",
    "M10.2 9.6h3.6v4.2h-3.6z",
  ],
  play: ["M7.6 5.2 19 12 7.6 18.8z"],
  arrowRight: ["M4.4 12h14.4", "M13 6.4 18.8 12 13 17.6"],
  arrowLeft: ["M19.6 12H5.2", "M11 6.4 5.2 12 11 17.6"],
  backspace: ["M9.4 5.4h10.2v13.2H9.4L3.6 12z", "M12.6 9.4 17.4 14.6", "M17.4 9.4l-4.8 5.2"],
  clock: ["M12 20.4a8.4 8.4 0 1 0 0-16.8 8.4 8.4 0 0 0 0 16.8z", "M12 7.6V12l3.2 2"],
  plus: ["M12 5v14", "M5 12h14"],
  trash: ["M4.4 6.8h15.2", "M9.6 6.8V4.2h4.8v2.6", "M6.6 6.8l1 13.4h8.8l1-13.4", "M10.2 10.8v6", "M13.8 10.8v6"],
  edit: ["M4 20.2l1-4.3L15.5 5.4a2.3 2.3 0 0 1 3.2 3.2L8.2 19.2z", "M13.9 7l3.2 3.2"],
  print: [
    "M7 8.6V3.6h10v5",
    "M5.4 8.6h13.2a2.2 2.2 0 0 1 2.2 2.2v5.4h-3.8",
    "M6 16.2H2.2v-5.4a2.2 2.2 0 0 1 2.2-2.2",
    "M7 13.4h10v7H7z",
  ],
  chat: ["M4 5.4h16v10.8h-7.6L7.4 20.4v-4.2H4z", "M8.4 10.8h7.2"],
  mic: [
    "M12 3.6a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0v-5a3 3 0 0 1 3-3z",
    "M5.6 11.4a6.4 6.4 0 0 0 12.8 0",
    "M12 17.8v2.6",
  ],
  sparkles: [
    "M9.6 3.4 11 7.6l4.2 1.4-4.2 1.4-1.4 4.2-1.4-4.2L4 9l4.2-1.4z",
    "M17.4 13.6l.9 2.5 2.5.9-2.5.9-.9 2.5-.9-2.5-2.5-.9 2.5-.9z",
  ],
  install: [
    "M12 3.4v10.8",
    "M7.6 9.8 12 14.2l4.4-4.4",
    "M4.6 17v1.6a2 2 0 0 0 2 2h10.8a2 2 0 0 0 2-2V17",
  ],
} as const;

export type IconName = keyof typeof PATHS;

export type IconProps = {
  name: IconName;
  /** Pixel box. Stroke stays proportional. */
  size?: number;
  className?: string;
  strokeWidth?: number;
  /** Fill the shape with currentColor — good for star / flame. */
  filled?: boolean;
};

export default function Icon({
  name,
  size = 24,
  className,
  strokeWidth = 2.4,
  filled = false,
}: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
      style={{ display: "block", flex: "none" }}
    >
      {PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

export { Icon };
