import { useEffect, useRef, useState } from "react";
import { accuracy, shotsFired } from "../game/rules";
import type { Board, Side } from "../game/types";

interface GameOverPanelProps {
  winner: Side;
  /** The enemy board carries the player's shots; the player board carries the AI's. */
  enemyBoard: Board;
  playerBoard: Board;
  onPlayAgain: () => void;
}

export default function GameOverPanel({
  winner,
  enemyBoard,
  playerBoard,
  onPlayAgain,
}: GameOverPanelProps) {
  const won = winner === "player";
  // The panel lands under a cursor that was just clicking cells, so a click
  // already in flight must not reset the game before the result is read.
  const [armed, setArmed] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const playAgainRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setArmed(true), 500);
    return () => window.clearTimeout(timer);
  }, []);

  // Move focus into the modal so a screen reader lands on the result, then onto
  // Play Again once it is clickable.
  useEffect(() => {
    if (armed) playAgainRef.current?.focus();
    else dialogRef.current?.focus();
  }, [armed]);

  // Play Again is the only exit, so Escape takes it; Tab cannot leave the modal.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && armed) {
        event.preventDefault();
        onPlayAgain();
        return;
      }
      if (event.key === "Tab") {
        event.preventDefault();
        (armed ? playAgainRef.current : dialogRef.current)?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [armed, onPlayAgain]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-abyss/85 px-4 backdrop-blur-sm">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={won ? "Victory" : "Defeat"}
        tabIndex={-1}
        className="w-full max-w-md rounded-xl border border-white/10 bg-hull p-6 text-center shadow-2xl"
      >
        <h2
          className={`text-3xl font-bold uppercase tracking-[0.25em] ${
            won ? "text-cognition-bright" : "text-cursor-bright"
          }`}
        >
          {won ? "Victory" : "Defeat"}
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          {won ? "Cursor Fleet is on the seabed." : "Cognition Fleet has been sunk."}
        </p>

        <dl className="mt-5 grid grid-cols-2 gap-3 text-left text-xs">
          <div className="rounded border border-white/10 p-3">
            <dt className="text-slate-500">Your shots</dt>
            <dd className="text-lg font-semibold text-slate-100">{shotsFired(enemyBoard)}</dd>
          </div>
          <div className="rounded border border-white/10 p-3">
            <dt className="text-slate-500">Your accuracy</dt>
            <dd className="text-lg font-semibold text-slate-100">{accuracy(enemyBoard)}%</dd>
          </div>
          <div className="rounded border border-white/10 p-3">
            <dt className="text-slate-500">Enemy shots</dt>
            <dd className="text-lg font-semibold text-slate-100">{shotsFired(playerBoard)}</dd>
          </div>
          <div className="rounded border border-white/10 p-3">
            <dt className="text-slate-500">Enemy accuracy</dt>
            <dd className="text-lg font-semibold text-slate-100">{accuracy(playerBoard)}%</dd>
          </div>
        </dl>

        <button
          ref={playAgainRef}
          type="button"
          onClick={onPlayAgain}
          disabled={!armed}
          className="mt-6 w-full rounded bg-cognition px-4 py-2 font-semibold uppercase tracking-wider text-abyss transition-opacity hover:bg-cognition-bright disabled:opacity-50"
        >
          Play Again
        </button>
      </div>
    </div>
  );
}
