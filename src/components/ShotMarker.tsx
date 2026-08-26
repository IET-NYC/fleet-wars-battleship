import type { CellState } from "../game/types";

type MarkerState = Extract<CellState, "miss" | "hit" | "sunk">;

interface ShotMarkerProps {
  state: MarkerState;
}

/** Splash rings for open water, a blast for a hit, a burning wreck for a kill. */
export default function ShotMarker({ state }: ShotMarkerProps) {
  if (state === "miss") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 100 100"
        className="pointer-events-none absolute inset-0 text-sky-200 motion-safe:animate-splash-ring"
      >
        <circle cx="50" cy="50" r="30" fill="none" stroke="currentColor" strokeOpacity="0.35" strokeWidth="5" />
        <circle cx="50" cy="50" r="16" fill="none" stroke="currentColor" strokeOpacity="0.7" strokeWidth="6" />
        <circle cx="50" cy="50" r="5" fill="currentColor" fillOpacity="0.85" />
      </svg>
    );
  }

  if (state === "hit") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 100 100"
        className="pointer-events-none absolute inset-0 motion-safe:animate-blast-flare"
      >
        <path
          d="M50 2 L61 30 L92 16 L74 44 L98 56 L68 62 L78 94 L50 74 L22 94 L32 62 L2 56 L26 44 L8 16 L39 30 Z"
          fill="#f97316"
          fillOpacity="0.75"
        />
        <circle cx="50" cy="50" r="20" fill="#fde047" />
        <circle cx="50" cy="50" r="9" fill="#fff7ed" />
      </svg>
    );
  }

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 100 100"
      className="pointer-events-none absolute inset-0 motion-safe:animate-ember-flicker"
    >
      <path
        d="M50 8 C64 30 78 40 78 60 C78 79 65 92 50 92 C35 92 22 79 22 60 C22 40 36 30 50 8 Z"
        fill="#fb7185"
        fillOpacity="0.5"
      />
      <path
        d="M50 34 C59 48 66 54 66 65 C66 76 59 84 50 84 C41 84 34 76 34 65 C34 54 41 48 50 34 Z"
        fill="#fbbf24"
        fillOpacity="0.85"
      />
      <path d="M28 22 L72 78 M72 22 L28 78" stroke="#0f172a" strokeOpacity="0.55" strokeWidth="7" />
    </svg>
  );
}
