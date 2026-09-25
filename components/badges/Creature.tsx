import type { ReactNode } from "react";

/**
 * The badge creatures, drawn inline like Sparky (components/pet/PetSprite.tsx):
 * no image files, crisp at any size, work offline. `locked` turns the drawing
 * into a dark mystery silhouette with a question mark.
 */
export default function Creature({
  badgeId,
  locked = false,
  size = 80,
}: {
  badgeId: string;
  locked?: boolean;
  size?: number;
}) {
  const draw = DRAWINGS[badgeId] ?? DRAWINGS["first-win"];
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} aria-hidden>
      <ellipse cx="60" cy="112" rx="30" ry="5" fill="rgb(31 42 55 / 0.12)" />
      <g style={locked ? { filter: "brightness(0)", opacity: 0.16 } : undefined}>{draw()}</g>
      {locked ? (
        <text
          x="60"
          y="78"
          textAnchor="middle"
          fontFamily="var(--font-display)"
          fontWeight="700"
          fontSize="38"
          fill="var(--color-faint)"
        >
          ?
        </text>
      ) : null}
    </svg>
  );
}

const INK = "var(--color-ink)";

/** Two shiny eyes, rosy cheeks and a smile, centred on (cx, y). */
function Face({ y = 62, gap = 12, r = 7, cx = 60, mouth = "smile" }: {
  y?: number;
  gap?: number;
  r?: number;
  cx?: number;
  mouth?: "smile" | "open" | "tooth" | "none";
}) {
  const l = cx - gap;
  const rt = cx + gap;
  return (
    <g>
      <circle cx={l} cy={y} r={r} fill="#fff" />
      <circle cx={rt} cy={y} r={r} fill="#fff" />
      <circle cx={l + 1} cy={y + 1} r={r * 0.58} fill={INK} />
      <circle cx={rt + 1} cy={y + 1} r={r * 0.58} fill={INK} />
      <circle cx={l + 2.5} cy={y - 1.5} r={r * 0.22} fill="#fff" />
      <circle cx={rt + 2.5} cy={y - 1.5} r={r * 0.22} fill="#fff" />
      <circle cx={l - 7} cy={y + 11} r="4.5" fill="var(--color-coral)" opacity="0.35" />
      <circle cx={rt + 7} cy={y + 11} r="4.5" fill="var(--color-coral)" opacity="0.35" />
      {mouth === "smile" ? (
        <path d={`M${cx - 6} ${y + 12} q6 6 12 0`} stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round" />
      ) : mouth === "open" ? (
        <path d={`M${cx - 7} ${y + 11} q7 10 14 0 z`} fill={INK} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      ) : mouth === "tooth" ? (
        <>
          <path d={`M${cx - 6} ${y + 12} q6 6 12 0`} stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round" />
          <rect x={cx - 3} y={y + 14} width="6" height="5" rx="1" fill="#fff" stroke={INK} strokeWidth="1.2" />
        </>
      ) : null}
    </g>
  );
}

function Feet({ color, y = 106 }: { color: string; y?: number }) {
  return (
    <>
      <ellipse cx="46" cy={y} rx="9" ry="5" fill={color} />
      <ellipse cx="74" cy={y} rx="9" ry="5" fill={color} />
    </>
  );
}

const DRAWINGS: Record<string, () => ReactNode> = {
  // Pip the Chick — a first win is a first hatch.
  "first-win": () => (
    <g>
      <Feet color="#f59e0b" />
      <ellipse cx="26" cy="74" rx="8" ry="14" fill="#f5b800" transform="rotate(20 26 74)" />
      <ellipse cx="94" cy="74" rx="8" ry="14" fill="#f5b800" transform="rotate(-20 94 74)" />
      <circle cx="60" cy="70" r="34" fill="#ffd23f" />
      <path d="M56 38 q-4 -12 4 -14 q-2 8 4 6 q8 -2 4 8" fill="#ffd23f" stroke="#f5b800" strokeWidth="2" />
      <Face y={62} mouth="none" />
      <path d="M53 72 l7 7 l7 -7 z" fill="#ff8a3d" stroke="#e8701f" strokeWidth="1.5" strokeLinejoin="round" />
    </g>
  ),
  // Ember the Flame — the streak's fire.
  "streak-3": () => (
    <g>
      <path
        d="M60 10 C74 30 94 48 94 78 C94 98 79 110 60 110 C41 110 26 98 26 78 C26 62 36 50 44 36 C48 48 52 46 54 40 C56 30 56 20 60 10 Z"
        fill="#ff8a3d"
      />
      <path d="M60 50 C70 62 80 72 80 86 C80 98 71 104 60 104 C49 104 40 98 40 86 C40 74 52 66 60 50 Z" fill="#ffd23f" />
      <Face y={72} mouth="open" />
    </g>
  ),
  // Nova the Star — a week of shining.
  "streak-7": () => (
    <g>
      <path
        d="M60 12 L73 44 L106 46 L80 67 L89 100 L60 82 L31 100 L40 67 L14 46 L47 44 Z"
        fill="#f4b400"
        stroke="#f4b400"
        strokeWidth="10"
        strokeLinejoin="round"
      />
      <Face y={58} gap={10} r={6} />
    </g>
  ),
  // Luna the Moon Owl — thirty nights of practice.
  "streak-30": () => (
    <g>
      <Feet color="#f4b400" />
      <path d="M32 40 l-4 -20 l18 12 z" fill="#5b3fc4" />
      <path d="M88 40 l4 -20 l-18 12 z" fill="#5b3fc4" />
      <ellipse cx="60" cy="68" rx="34" ry="40" fill="#7c5ce6" />
      <ellipse cx="60" cy="84" rx="20" ry="20" fill="#b9a6ff" />
      <path d="M66 76 a10 10 0 1 0 0 16 a8 8 0 1 1 0 -16 z" fill="#f4b400" />
      <circle cx="46" cy="56" r="12" fill="#b9a6ff" />
      <circle cx="74" cy="56" r="12" fill="#b9a6ff" />
      <Face y={56} gap={14} r={8} mouth="none" />
      <path d="M56 66 l4 6 l4 -6 z" fill="#f4b400" />
    </g>
  ),
  // Zip the Bunny — quick hops, quick answers.
  "speed-10": () => (
    <g>
      <Feet color="#3b7de0" />
      <ellipse cx="44" cy="26" rx="9" ry="24" fill="#6ea8ff" transform="rotate(-12 44 26)" />
      <ellipse cx="76" cy="26" rx="9" ry="24" fill="#6ea8ff" transform="rotate(12 76 26)" />
      <ellipse cx="44" cy="28" rx="4" ry="16" fill="#ffc0cb" transform="rotate(-12 44 28)" />
      <ellipse cx="76" cy="28" rx="4" ry="16" fill="#ffc0cb" transform="rotate(12 76 28)" />
      <circle cx="60" cy="74" r="34" fill="#6ea8ff" />
      <ellipse cx="60" cy="86" rx="18" ry="16" fill="#dcebff" />
      <Face y={66} mouth="tooth" />
    </g>
  ),
  // Volt the Thunder Cat — lightning fast.
  "speed-100": () => (
    <g>
      <path d="M86 92 l16 -14 l-8 -2 l12 -18 l-20 16 l8 2 l-14 12 z" fill="#f4b400" stroke="#b07e00" strokeWidth="2" strokeLinejoin="round" />
      <Feet color="#d99a00" />
      <path d="M30 46 l2 -28 l20 18 z" fill="#ffc93c" />
      <path d="M90 46 l-2 -28 l-20 18 z" fill="#ffc93c" />
      <path d="M34 42 l1 -16 l11 10 z" fill="#ff9fb0" />
      <path d="M86 42 l-1 -16 l-11 10 z" fill="#ff9fb0" />
      <circle cx="60" cy="72" r="36" fill="#ffc93c" />
      <path d="M52 46 l6 10 l-6 2 l8 12" stroke="#d99a00" strokeWidth="3" fill="none" strokeLinejoin="round" />
      <Face y={66} />
      <path d="M30 76 h14 M30 82 h14 M76 76 h14 M76 82 h14" stroke={INK} strokeWidth="1.6" strokeLinecap="round" opacity="0.5" />
    </g>
  ),
  // Dot the Ladybug — every spot in the right place.
  "perfect-1": () => (
    <g>
      <path d="M48 30 q-8 -14 -16 -12 M72 30 q8 -14 16 -12" stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round" />
      <circle cx="32" cy="18" r="4" fill={INK} />
      <circle cx="88" cy="18" r="4" fill={INK} />
      <circle cx="60" cy="72" r="38" fill="#ef4b4b" />
      <path d="M60 36 v74" stroke={INK} strokeWidth="3" />
      <circle cx="40" cy="92" r="7" fill={INK} />
      <circle cx="80" cy="92" r="7" fill={INK} />
      <circle cx="32" cy="72" r="5" fill={INK} />
      <circle cx="88" cy="72" r="5" fill={INK} />
      <path d="M30 56 a30 30 0 0 1 60 0 z" fill={INK} />
      <Face y={48} gap={11} r={6} />
    </g>
  ),
  // Glim the Unicorn — ten perfect lessons is a little bit magic.
  "perfect-10": () => (
    <g>
      <Feet color="#d9c7ff" />
      <path d="M56 32 l4 -26 l4 26 z" fill="#f4b400" stroke="#b07e00" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M57 26 l6 -2 M57 18 l5 -2" stroke="#b07e00" strokeWidth="1.5" />
      <circle cx="60" cy="72" r="36" fill="#fff" stroke="var(--color-line)" strokeWidth="3" />
      <circle cx="36" cy="42" r="10" fill="#ff9fd0" />
      <circle cx="30" cy="58" r="9" fill="#b9a6ff" />
      <circle cx="30" cy="74" r="8" fill="#8fd4ff" />
      <circle cx="48" cy="36" r="9" fill="#ffd23f" />
      <Face y={68} gap={11} />
      <path d="M86 40 l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2 l5 -2 z" fill="#f4b400" />
    </g>
  ),
  // Scout the Fox — a hunter of words.
  "right-100": () => (
    <g>
      <Feet color="#c2410c" />
      <path d="M28 50 l6 -32 l20 22 z" fill="#ff7a2f" />
      <path d="M92 50 l-6 -32 l-20 22 z" fill="#ff7a2f" />
      <path d="M33 44 l4 -18 l10 12 z" fill="#fff4e6" />
      <path d="M87 44 l-4 -18 l-10 12 z" fill="#fff4e6" />
      <circle cx="60" cy="72" r="36" fill="#ff7a2f" />
      <path d="M30 70 q30 44 60 0 q-14 10 -30 10 q-16 0 -30 -10 z" fill="#fff4e6" />
      <Face y={64} mouth="none" />
      <ellipse cx="60" cy="80" rx="5" ry="4" fill={INK} />
      <path d="M56 86 q4 4 8 0" stroke={INK} strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </g>
  ),
  // Sage the Wise Owl — five hundred answers of wisdom.
  "right-500": () => (
    <g>
      <Feet color="#f4b400" />
      <path d="M32 40 l-2 -18 l16 12 z" fill="#7a5230" />
      <path d="M88 40 l2 -18 l-16 12 z" fill="#7a5230" />
      <ellipse cx="60" cy="68" rx="34" ry="40" fill="#a0703c" />
      <ellipse cx="60" cy="86" rx="20" ry="20" fill="#e8cfa6" />
      <path d="M52 82 q4 4 8 0 q4 4 8 0 M50 92 q5 4 10 0 q5 4 10 0" stroke="#a0703c" strokeWidth="2" fill="none" />
      <Face y={56} gap={14} r={8} mouth="none" />
      <circle cx="46" cy="56" r="11" fill="none" stroke={INK} strokeWidth="2.5" />
      <circle cx="74" cy="56" r="11" fill="none" stroke={INK} strokeWidth="2.5" />
      <path d="M57 56 h6" stroke={INK} strokeWidth="2.5" />
      <path d="M56 66 l4 6 l4 -6 z" fill="#f4b400" />
    </g>
  ),
  // Cubit the Robot — built from math.
  "math-star": () => (
    <g>
      <path d="M60 30 v-14" stroke="#5b3fc4" strokeWidth="3" />
      <circle cx="60" cy="14" r="5" fill="#f4b400" />
      <rect x="18" y="62" width="10" height="24" rx="5" fill="#5b3fc4" />
      <rect x="92" y="62" width="10" height="24" rx="5" fill="#5b3fc4" />
      <rect x="40" y="96" width="14" height="12" rx="3" fill="#5b3fc4" />
      <rect x="66" y="96" width="14" height="12" rx="3" fill="#5b3fc4" />
      <rect x="26" y="30" width="68" height="70" rx="16" fill="#7c5ce6" />
      <rect x="34" y="40" width="52" height="34" rx="10" fill="var(--color-night)" />
      <circle cx="48" cy="56" r="6" fill="#7df9c4" />
      <circle cx="72" cy="56" r="6" fill="#7df9c4" />
      <path d="M52 66 q8 5 16 0" stroke="#7df9c4" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <text x="60" y="92" textAnchor="middle" fontFamily="var(--font-display)" fontWeight="700" fontSize="14" fill="#fff">
        + − × ÷
      </text>
    </g>
  ),
  // Shelly the Turtle — slow and steady beats a whole unit.
  "unit-done": () => (
    <g>
      <ellipse cx="28" cy="96" rx="10" ry="7" fill="#5fd0b9" />
      <ellipse cx="92" cy="96" rx="10" ry="7" fill="#5fd0b9" />
      <path d="M16 88 a44 44 0 0 1 88 0 z" fill="#1f8f7f" />
      <path d="M40 56 l10 -12 h20 l10 12 l-10 12 h-20 z" fill="#2bb3a3" stroke="#17685d" strokeWidth="2" />
      <path d="M22 80 l12 -12 M98 80 l-12 -12 M40 56 h-14 M80 56 h14" stroke="#17685d" strokeWidth="2" />
      <rect x="14" y="84" width="92" height="8" rx="4" fill="#17685d" />
      <circle cx="60" cy="92" r="20" fill="#5fd0b9" />
      <Face y={88} gap={8} r={5} />
    </g>
  ),

  // ── Set 2: bigger goals ──────────────────────────────────────────────────

  // Blaze the Dragon — two months of fire.
  "streak-60": () => (
    <g>
      <Feet color="#17685d" />
      <path d="M84 94 q22 6 24 -14" stroke="#2bb3a3" strokeWidth="8" fill="none" strokeLinecap="round" />
      <path d="M102 84 l6 -14 l6 12 z" fill="#ff8a3d" />
      <path d="M32 62 L8 34 L14 58 L4 64 Z" fill="#5fd0b9" stroke="#17685d" strokeWidth="2" strokeLinejoin="round" />
      <path d="M88 62 L112 34 L106 58 L116 64 Z" fill="#5fd0b9" stroke="#17685d" strokeWidth="2" strokeLinejoin="round" />
      <path d="M40 44 l-6 -22 l16 12 z" fill="#ffd23f" />
      <path d="M80 44 l6 -22 l-16 12 z" fill="#ffd23f" />
      <path d="M52 38 l8 -14 l8 14 z" fill="#ff8a3d" />
      <circle cx="60" cy="72" r="36" fill="#2bb3a3" />
      <ellipse cx="60" cy="92" rx="20" ry="13" fill="#ffd23f" />
      <path d="M46 88 h28 M44 96 h32" stroke="#f5b800" strokeWidth="2" strokeLinecap="round" />
      <Face y={58} mouth="tooth" />
    </g>
  ),
  // Sol the Phoenix — a hundred days, and the fire never goes out.
  "streak-100": () => (
    <g>
      <path d="M42 94 q-10 14 -24 14 q10 -8 12 -20 z" fill="#ff8a3d" />
      <path d="M78 94 q10 14 24 14 q-10 -8 -12 -20 z" fill="#ff8a3d" />
      <path d="M50 98 l10 14 l10 -14 z" fill="#ffd23f" />
      <path d="M34 74 C18 66 8 48 8 30 C18 42 26 44 34 52 C30 40 32 32 36 26 C40 40 44 48 48 56 Z" fill="#ff8a3d" />
      <path d="M86 74 C102 66 112 48 112 30 C102 42 94 44 86 52 C90 40 88 32 84 26 C80 40 76 48 72 56 Z" fill="#ff8a3d" />
      <path
        d="M48 46 C44 34 48 24 52 16 C52 26 56 28 58 30 C58 20 62 14 68 8 C66 20 68 28 70 32 C72 28 76 26 80 22 C80 32 76 40 72 46 Z"
        fill="#ffd23f"
      />
      <circle cx="60" cy="72" r="32" fill="#ef4b4b" />
      <ellipse cx="60" cy="90" rx="16" ry="12" fill="#ffd23f" />
      <Face y={64} mouth="none" />
      <path d="M54 72 l6 8 l6 -8 z" fill="#f4b400" stroke="#b07e00" strokeWidth="1.5" strokeLinejoin="round" />
    </g>
  ),
  // Whirl the Hummingbird — wings too fast to see.
  "speed-500": () => (
    <g>
      <path d="M6 62 h14 M2 74 h14 M8 86 h10" stroke="#8fd4ff" strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="36" cy="34" rx="9" ry="24" fill="#8fd4ff" opacity="0.5" transform="rotate(-40 36 34)" />
      <ellipse cx="46" cy="30" rx="9" ry="24" fill="#1f8f7f" transform="rotate(-20 46 30)" />
      <path d="M42 92 l-16 18 l10 -2 l2 8 l12 -18 z" fill="#1f8f7f" />
      <path d="M52 40 q2 -12 12 -14 q-2 8 2 12" fill="#2bb3a3" />
      <circle cx="58" cy="70" r="32" fill="#2bb3a3" />
      <ellipse cx="58" cy="88" rx="18" ry="12" fill="#ff9fd0" />
      <path d="M86 66 L118 62 L86 74 Z" fill={INK} strokeLinejoin="round" />
      <Face y={62} cx={56} gap={11} mouth="none" />
    </g>
  ),
  // Pebble the Penguin — dressed up for 25 perfect lessons.
  "perfect-25": () => (
    <g>
      <Feet color="#ff8a3d" />
      <ellipse cx="24" cy="76" rx="8" ry="20" fill="var(--color-night-soft)" transform="rotate(20 24 76)" />
      <ellipse cx="96" cy="76" rx="8" ry="20" fill="var(--color-night-soft)" transform="rotate(-20 96 76)" />
      <ellipse cx="60" cy="68" rx="34" ry="40" fill="var(--color-night-soft)" />
      <circle cx="48" cy="58" r="14" fill="#fff" />
      <circle cx="72" cy="58" r="14" fill="#fff" />
      <ellipse cx="60" cy="84" rx="24" ry="22" fill="#fff" />
      <Face y={56} mouth="none" />
      <path d="M54 66 l6 7 l6 -7 z" fill="#ff8a3d" stroke="#e8701f" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M48 82 L60 88 L72 82 V94 L60 88 L48 94 Z" fill="#f4b400" stroke="#b07e00" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="60" cy="88" r="3" fill="#b07e00" />
    </g>
  ),
  // Leo the Lion King — 50 perfect lessons earns a crown.
  "perfect-50": () => (
    <g>
      <Feet color="#f5b800" />
      <g fill="#ff8a3d">
        <circle cx="92" cy="70" r="13" />
        <circle cx="86" cy="89" r="13" />
        <circle cx="70" cy="100" r="13" />
        <circle cx="50" cy="100" r="13" />
        <circle cx="34" cy="89" r="13" />
        <circle cx="28" cy="70" r="13" />
        <circle cx="34" cy="51" r="13" />
        <circle cx="50" cy="40" r="13" />
        <circle cx="70" cy="40" r="13" />
        <circle cx="86" cy="51" r="13" />
      </g>
      <circle cx="60" cy="72" r="28" fill="#ffd23f" />
      <path d="M42 38 L40 14 L51 25 L60 10 L69 25 L80 14 L78 38 Z" fill="#f4b400" stroke="#b07e00" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="60" cy="28" r="3.5" fill="#ef4b4b" />
      <Face y={66} gap={11} r={6} mouth="none" />
      <path d="M55 76 h10 l-5 6 z" fill="#a0703c" strokeLinejoin="round" />
      <path d="M60 82 v3 M53 85 q3.5 4 7 0 q3.5 4 7 0" stroke={INK} strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </g>
  ),
  // Inky the Octopus — so many arms, so many answers.
  "right-1000": () => (
    <g>
      <path
        d="M30 76 q-12 20 0 28 q6 2 6 -4 M46 82 q-2 18 -10 24 M60 84 v22 M74 82 q2 18 10 24 M90 76 q12 20 0 28 q-6 2 -6 -4"
        stroke="#ef6461"
        strokeWidth="10"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="60" cy="58" r="34" fill="#ef6461" />
      <circle cx="40" cy="38" r="5" fill="#ffe8e3" />
      <circle cx="78" cy="34" r="4" fill="#ffe8e3" />
      <circle cx="86" cy="50" r="3" fill="#ffe8e3" />
      <Face y={60} />
    </g>
  ),
  // Tide the Whale — the biggest friend for the biggest number.
  "right-2500": () => (
    <g>
      <path d="M58 36 v-12 M58 24 q-8 -8 -16 -4 M58 24 q8 -8 16 -4" stroke="#8fd4ff" strokeWidth="4" fill="none" strokeLinecap="round" />
      <circle cx="40" cy="16" r="3" fill="#8fd4ff" />
      <circle cx="76" cy="16" r="3" fill="#8fd4ff" />
      <path d="M96 76 C106 72 110 60 116 54 C114 66 116 72 112 80 C116 86 116 94 116 100 C108 94 104 86 96 84 Z" fill="#3b7de0" />
      <path d="M14 74 C14 46 38 36 60 36 C86 36 100 54 100 74 C100 96 80 104 56 104 C32 104 14 96 14 74 Z" fill="#3b7de0" />
      <path d="M20 86 q38 30 76 0 q-38 14 -76 0 z" fill="#dcebff" />
      <path d="M34 98 q22 8 44 0" stroke="#6ea8ff" strokeWidth="2" fill="none" />
      <Face y={62} cx={50} />
    </g>
  ),
  // Honey the Bee — builds with shapes and numbers.
  "math-50": () => (
    <g>
      <path d="M50 44 q-6 -16 -14 -18 M70 44 q6 -16 14 -18" stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round" />
      <circle cx="36" cy="26" r="4" fill={INK} />
      <circle cx="84" cy="26" r="4" fill={INK} />
      <ellipse cx="28" cy="46" rx="12" ry="20" fill="#dcebff" stroke="#8fd4ff" strokeWidth="2" transform="rotate(-35 28 46)" />
      <ellipse cx="92" cy="46" rx="12" ry="20" fill="#dcebff" stroke="#8fd4ff" strokeWidth="2" transform="rotate(35 92 46)" />
      <circle cx="60" cy="74" r="34" fill="#ffd23f" />
      <path d="M27.5 84 A34 34 0 0 0 31.2 92 H88.8 A34 34 0 0 0 92.5 84 Z" fill={INK} />
      <path d="M34.1 96 A34 34 0 0 0 40.7 102 H79.3 A34 34 0 0 0 85.9 96 Z" fill={INK} />
      <Face y={62} />
      <path d="M111 98 L106.5 105.8 H97.5 L93 98 L97.5 90.2 H106.5 Z" fill="#f4b400" stroke="#b07e00" strokeWidth="2" strokeLinejoin="round" />
    </g>
  ),
  // Wiggle the Bookworm — pops out of every book.
  "reading-5": () => (
    <g>
      <g fill="#ff9fd0" stroke="#f07cb8" strokeWidth="2">
        <circle cx="64" cy="90" r="12" />
        <circle cx="74" cy="76" r="13" />
        <circle cx="68" cy="62" r="13" />
      </g>
      <path d="M48 24 q-4 -10 -10 -12 M64 24 q4 -10 10 -12" stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round" />
      <circle cx="38" cy="12" r="3.5" fill={INK} />
      <circle cx="74" cy="12" r="3.5" fill={INK} />
      <circle cx="56" cy="44" r="22" fill="#ff9fd0" />
      <Face y={42} cx={56} gap={9} r={6} />
      <path d="M10 96 v14 q25 -8 50 0 q25 -8 50 0 v-14" fill="#3b7de0" />
      <path d="M12 92 q24 -10 48 0 v16 q-24 -10 -48 0 z" fill="#fff" stroke="#3b7de0" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M108 92 q-24 -10 -48 0 v16 q24 -10 48 0 z" fill="#fff" stroke="#3b7de0" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M20 96 q14 -5 30 0 M70 96 q16 -5 30 0" stroke="var(--color-line)" strokeWidth="2" fill="none" />
    </g>
  ),
  // Bao the Panda — read to the very top.
  "reading-10": () => (
    <g>
      <circle cx="34" cy="32" r="11" fill={INK} />
      <circle cx="86" cy="32" r="11" fill={INK} />
      <ellipse cx="60" cy="98" rx="30" ry="12" fill="#fff" stroke="var(--color-line)" strokeWidth="3" />
      <circle cx="60" cy="58" r="34" fill="#fff" stroke="var(--color-line)" strokeWidth="3" />
      <ellipse cx="47" cy="58" rx="10" ry="12" fill={INK} transform="rotate(25 47 58)" />
      <ellipse cx="73" cy="58" rx="10" ry="12" fill={INK} transform="rotate(-25 73 58)" />
      <Face y={56} gap={13} r={6} mouth="none" />
      <ellipse cx="60" cy="70" rx="5" ry="3.5" fill={INK} />
      <path d="M55 75 q5 4 10 0" stroke={INK} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M30 92 v16 q15 -6 30 0 q15 -6 30 0 v-16" fill="#7c5ce6" />
      <path d="M32 88 q14 -6 28 0 v18 q-14 -6 -28 0 z" fill="#fff" stroke="#7c5ce6" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M88 88 q-14 -6 -28 0 v18 q14 -6 28 0 z" fill="#fff" stroke="#7c5ce6" strokeWidth="2.5" strokeLinejoin="round" />
      <circle cx="30" cy="96" r="7" fill={INK} />
      <circle cx="90" cy="96" r="7" fill={INK} />
      <path d="M104 50 l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2 l5 -2 z" fill="#f4b400" />
    </g>
  ),
  // Rexy the Dino — ten levels tall.
  "level-10": () => (
    <g>
      <Feet color="#187a50" />
      <path d="M30 92 C16 92 8 84 4 72 C14 80 22 82 32 80 Z" fill="#22a06b" />
      <path d="M40 44 l4 -14 l8 10 z" fill="#f4b400" />
      <path d="M54 38 l6 -14 l6 14 z" fill="#f4b400" />
      <path d="M68 40 l8 -10 l4 14 z" fill="#f4b400" />
      <circle cx="60" cy="72" r="36" fill="#22a06b" />
      <ellipse cx="60" cy="92" rx="20" ry="13" fill="#eaf6f0" />
      <circle cx="86" cy="62" r="4" fill="#187a50" />
      <circle cx="82" cy="50" r="3" fill="#187a50" />
      <circle cx="34" cy="58" r="3" fill="#187a50" />
      <path d="M36 86 q-8 2 -8 -4 M84 86 q8 2 8 -4" stroke="#187a50" strokeWidth="5" fill="none" strokeLinecap="round" />
      <Face y={60} mouth="open" />
    </g>
  ),
  // Cosmo the Alien — level 20 is out of this world.
  "level-20": () => (
    <g>
      <path d="M50 42 l-8 -18 M70 42 l8 -18" stroke="#2bb3a3" strokeWidth="3" strokeLinecap="round" />
      <circle cx="42" cy="22" r="5" fill="#ff9fd0" />
      <circle cx="78" cy="22" r="5" fill="#ff9fd0" />
      <ellipse cx="60" cy="60" rx="24" ry="22" fill="#7df9c4" />
      <circle cx="60" cy="45" r="5" fill="#fff" />
      <circle cx="60.6" cy="45.6" r="2.9" fill={INK} />
      <Face y={60} gap={11} r={6} />
      <path d="M18 80 a42 42 0 0 1 84 0 z" fill="#8fd4ff" opacity="0.3" stroke="#8fd4ff" strokeWidth="2" />
      <ellipse cx="60" cy="86" rx="50" ry="14" fill="#7c5ce6" />
      <ellipse cx="60" cy="80" rx="42" ry="7" fill="#b9a6ff" />
      <g fill="#ffd23f">
        <circle cx="26" cy="89" r="3.5" />
        <circle cx="43" cy="94" r="3.5" />
        <circle cx="60" cy="96" r="3.5" />
        <circle cx="77" cy="94" r="3.5" />
        <circle cx="94" cy="89" r="3.5" />
      </g>
    </g>
  ),
};
