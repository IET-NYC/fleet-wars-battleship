import type { HullPart } from "../game/rules";
import type { Orientation } from "../game/types";

interface HullSpriteProps {
  part: HullPart;
  orientation: Orientation;
  /** Dimmed, listing hull for a vessel that has been sunk. */
  wrecked?: boolean;
}

/** Silhouettes are drawn bow-left in a 100x100 cell and rotated for vertical ships. */
const HULL_PATH: Record<HullPart, string> = {
  bow: "M2 50 L34 20 H100 V80 H34 Z",
  mid: "M0 20 H100 V80 H0 Z",
  stern: "M0 20 H86 Q100 20 100 34 V66 Q100 80 86 80 H0 Z",
};

export default function HullSprite({ part, orientation, wrecked = false }: HullSpriteProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className={`pointer-events-none absolute -inset-[1.5px] ${wrecked ? "opacity-60" : ""}`}
      style={orientation === "vertical" ? { transform: "rotate(90deg)" } : undefined}
    >
      <path d={HULL_PATH[part]} fill="currentColor" fillOpacity={wrecked ? 0.35 : 0.55} />
      <path
        d={HULL_PATH[part]}
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.9"
        strokeWidth="5"
      />
      {/* Deck line runs the length of the vessel so segments read as one hull. */}
      <path d="M0 50 H100" stroke="currentColor" strokeOpacity="0.45" strokeWidth="4" />

      {part === "bow" ? (
        <path d="M46 50 L62 38 V62 Z" fill="currentColor" fillOpacity="0.95" />
      ) : null}
      {part === "mid" ? (
        <>
          <rect x="30" y="28" width="40" height="44" rx="6" fill="currentColor" fillOpacity="0.9" />
          <rect x="44" y="6" width="12" height="24" rx="4" fill="currentColor" fillOpacity="0.8" />
        </>
      ) : null}
      {part === "stern" ? (
        <>
          <circle cx="46" cy="50" r="13" fill="currentColor" fillOpacity="0.9" />
          <path d="M78 34 V66" stroke="currentColor" strokeOpacity="0.7" strokeWidth="5" />
        </>
      ) : null}
    </svg>
  );
}
