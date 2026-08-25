import type { ShotFlash as ShotFlashState } from "../state/gameReducer";

interface ShotFlashProps {
  flash: ShotFlashState;
}

const HEADLINE: Record<ShotFlashState["outcome"], string> = {
  hit: "DIRECT HIT",
  sunk: "SHIP SUNK",
  miss: "MISS",
};

/**
 * Brief centred callout for the shot that just resolved. Purely decorative —
 * it clears itself from state after a moment and never blocks input.
 */
export default function ShotFlash({ flash }: ShotFlashProps) {
  const missed = flash.outcome === "miss";
  const byPlayer = flash.attacker === "player";

  const tone = missed
    ? "border-slate-400/40 text-slate-300"
    : byPlayer
      ? "border-cognition-bright/60 text-cognition-bright"
      : "border-rose-400/60 text-rose-300";

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center"
    >
      <div
        className={`rounded-lg border bg-abyss/70 px-6 py-3 text-center backdrop-blur-sm motion-safe:animate-flash-strike ${tone}`}
      >
        <p className="text-2xl font-bold uppercase tracking-[0.3em] sm:text-4xl">
          {HEADLINE[flash.outcome]}
        </p>
        <p className="mt-1 text-[0.65rem] uppercase tracking-[0.3em] text-slate-400">
          {byPlayer ? "Cognition" : "Cursor"} · {flash.label}
        </p>
      </div>
    </div>
  );
}
