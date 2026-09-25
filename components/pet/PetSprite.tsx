import type { PetMood, PetStageId } from "@/lib/pet";

/**
 * Sparky, drawn inline: no image files, crisp at any size, works offline.
 * Each stage adds one thing (shell, wings, horns, spikes, crown) so a
 * growth is easy to see.
 */
export default function PetSprite({
  stage,
  mood,
  size = 112,
}: {
  stage: PetStageId;
  mood: PetMood;
  size?: number;
}) {
  if (stage === "egg") return <Egg size={size} />;

  const scale = { baby: 0.72, kid: 0.82, teen: 0.92, grown: 1, legend: 1 }[stage];
  const has = (from: PetStageId) => rank(stage) >= rank(from);

  return (
    <svg viewBox="0 0 120 120" width={size} height={size} role="img" aria-label={`Sparky, ${mood}`}>
      <ellipse cx="60" cy="112" rx={34 * scale} ry="5" fill="rgb(31 42 55 / 0.12)" />
      <g transform={`translate(60 108) scale(${scale}) translate(-60 -108)`}>
        {has("grown") ? (
          <path d="M92 92 q18 -2 22 -18 q-8 6 -14 4 q4 -6 2 -12 q-6 8 -16 10 z" fill="var(--color-green-dark)" />
        ) : null}
        {has("kid") ? (
          <>
            <path
              d={has("grown") ? "M30 58 q-26 -14 -24 8 q10 -4 14 4 q4 -8 12 -2 z" : "M32 62 q-18 -10 -16 6 q8 -2 10 4 z"}
              fill="var(--color-green-dark)"
            />
            <path
              d={has("grown") ? "M90 58 q26 -14 24 8 q-10 -4 -14 4 q-4 -8 -12 -2 z" : "M88 62 q18 -10 16 6 q-8 -2 -10 4 z"}
              fill="var(--color-green-dark)"
            />
          </>
        ) : null}
        {has("teen") ? (
          <>
            <path d="M42 34 l-6 -16 l14 10 z" fill="var(--color-gold)" />
            <path d="M78 34 l6 -16 l-14 10 z" fill="var(--color-gold)" />
          </>
        ) : null}
        {/* Body */}
        <ellipse cx="60" cy="70" rx="34" ry="38" fill="var(--color-green)" />
        <ellipse cx="60" cy="82" rx="22" ry="22" fill="#c9f0dc" />
        {/* Feet */}
        <ellipse cx="45" cy="106" rx="9" ry="5" fill="var(--color-green-dark)" />
        <ellipse cx="75" cy="106" rx="9" ry="5" fill="var(--color-green-dark)" />
        <Face mood={mood} />
        {stage === "legend" ? (
          <path
            d="M44 26 l6 -14 l10 10 l10 -10 l6 14 z"
            fill="var(--color-gold)"
            stroke="var(--color-gold-dark)"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        ) : null}
        {stage === "baby" ? (
          <path
            d="M24 84 l8 -8 l8 8 l8 -8 l8 8 l8 -8 l8 8 l8 -8 l8 8 l8 -8 l8 8 v12 q-36 22 -72 0 z"
            fill="#fdf6e3"
            stroke="var(--color-line)"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        ) : null}
      </g>
      {mood === "sleepy" ? (
        <text x="92" y="30" fontFamily="var(--font-display)" fontWeight="700" fontSize="16" fill="var(--color-blue)">
          z<tspan dx="2" dy="-8" fontSize="12">z</tspan>
        </text>
      ) : null}
    </svg>
  );
}

const ORDER: PetStageId[] = ["egg", "baby", "kid", "teen", "grown", "legend"];
function rank(id: PetStageId): number {
  return ORDER.indexOf(id);
}

function Face({ mood }: { mood: PetMood }) {
  return (
    <g>
      {mood === "sleepy" ? (
        <>
          <path d="M42 60 q6 5 12 0" stroke="var(--color-ink)" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M66 60 q6 5 12 0" stroke="var(--color-ink)" strokeWidth="3" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="48" cy="58" r="8" fill="#fff" />
          <circle cx="72" cy="58" r="8" fill="#fff" />
          <circle cx="49" cy="59" r="4.5" fill="var(--color-ink)" />
          <circle cx="73" cy="59" r="4.5" fill="var(--color-ink)" />
          <circle cx="51" cy="57" r="1.6" fill="#fff" />
          <circle cx="75" cy="57" r="1.6" fill="#fff" />
        </>
      )}
      <circle cx="38" cy="70" r="5" fill="var(--color-coral)" opacity="0.35" />
      <circle cx="82" cy="70" r="5" fill="var(--color-coral)" opacity="0.35" />
      {mood === "proud" ? (
        <path d="M50 70 q10 12 20 0 z" fill="var(--color-ink)" stroke="var(--color-ink)" strokeWidth="2" strokeLinejoin="round" />
      ) : mood === "happy" ? (
        <path d="M52 70 q8 7 16 0" stroke="var(--color-ink)" strokeWidth="3" fill="none" strokeLinecap="round" />
      ) : (
        <circle cx="60" cy="72" r="2.5" fill="var(--color-ink)" />
      )}
    </g>
  );
}

function Egg({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} role="img" aria-label="A pet egg">
      <ellipse cx="60" cy="112" rx="26" ry="5" fill="rgb(31 42 55 / 0.12)" />
      <path
        d="M60 14 C84 14 94 52 94 74 C94 96 79 108 60 108 C41 108 26 96 26 74 C26 52 36 14 60 14 Z"
        fill="#fdf6e3"
        stroke="var(--color-line)"
        strokeWidth="3"
      />
      <circle cx="48" cy="48" r="7" fill="var(--color-green)" opacity="0.7" />
      <circle cx="72" cy="66" r="9" fill="var(--color-green)" opacity="0.7" />
      <circle cx="46" cy="86" r="6" fill="var(--color-green)" opacity="0.7" />
      <circle cx="70" cy="36" r="4" fill="var(--color-green)" opacity="0.7" />
    </svg>
  );
}
