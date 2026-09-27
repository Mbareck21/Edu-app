/** One drill rank as a shape: the badge he climbs toward. Faded when not reached. */

const SHAPES: Record<string, { fill: string; path: string }> = {
  Bronze: { fill: "#c9793a", path: "M20 3 L35 9 V20 C35 29 28 35 20 38 C12 35 5 29 5 20 V9 Z" }, // shield
  Silver: { fill: "#9aa6b2", path: "M20 4 L37 35 H3 Z" }, // triangle
  Gold: {
    fill: "#f4b400",
    path: "M20 3 L25 14.5 L37.5 15.5 L28 23.5 L31 36 L20 29.5 L9 36 L12 23.5 L2.5 15.5 L15 14.5 Z",
  }, // star
  Platinum: { fill: "#22a06b", path: "M20 3 L35 11.5 V28.5 L20 37 L5 28.5 V11.5 Z" }, // hexagon
  Diamond: { fill: "#3b7de0", path: "M11 5 H29 L37 15 L20 37 L3 15 Z" }, // gem
  Legend: { fill: "#7c5ce6", path: "M4 13 L12 21 L20 7 L28 21 L36 13 L33 34 H7 Z" }, // crown
};

export default function RankShape({
  name,
  size = 40,
  reached = true,
}: {
  name: string;
  size?: number;
  reached?: boolean;
}) {
  const shape = SHAPES[name] ?? SHAPES.Bronze;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      role="img"
      aria-label={name}
      style={{ opacity: reached ? 1 : 0.25 }}
    >
      <path d={shape.path} fill={shape.fill} stroke="rgb(0 0 0 / 0.15)" strokeWidth="1.5" strokeLinejoin="round" />
      <path d={shape.path} fill="#fff" opacity="0.25" transform="translate(20 20) scale(0.45) translate(-20 -26)" />
    </svg>
  );
}

export { RankShape };
