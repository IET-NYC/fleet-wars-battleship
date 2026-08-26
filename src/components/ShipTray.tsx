import type { Board, Orientation, ShipSpec } from "../game/types";
import { PLAYER_SHIPS } from "../game/theme";
import type { GameMode } from "../state/gameReducer";
import HullSprite from "./HullSprite";

const MODES: { id: GameMode; label: string; blurb: string }[] = [
  { id: "standard", label: "Standard", blurb: "Even odds. Strict alternating turns." },
  {
    id: "op",
    label: "OP-Mode",
    blurb: "Cognition favoured: every hit earns another shot, and Cursor hunts blind.",
  },
];

interface ShipTrayProps {
  board: Board;
  tray: ShipSpec[];
  selectedShipId: string | null;
  orientation: Orientation;
  onSelect: (shipId: string) => void;
  onPickUp: (shipId: string) => void;
  onRotate: () => void;
  onAutoPlace: () => void;
  onClear: () => void;
  onStart: () => void;
  readyToStart: boolean;
  mode: GameMode;
  onModeChange: (mode: GameMode) => void;
}

export default function ShipTray({
  board,
  tray,
  selectedShipId,
  orientation,
  onSelect,
  onPickUp,
  onRotate,
  onAutoPlace,
  onClear,
  onStart,
  readyToStart,
  mode,
  onModeChange,
}: ShipTrayProps) {
  const trayIds = new Set(tray.map((spec) => spec.id));

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-white/10 bg-hull/80 p-4">
      <header className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-cognition-bright">
          Deploy Fleet
        </h2>
        <span className="text-xs text-slate-400">
          {PLAYER_SHIPS.length - tray.length}/{PLAYER_SHIPS.length} placed
        </span>
      </header>

      <div>
        <p className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-400">Game mode</p>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {MODES.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={mode === option.id}
              onClick={() => onModeChange(option.id)}
              className={`rounded border px-3 py-2 uppercase tracking-wider transition-colors ${
                mode === option.id
                  ? "border-cognition-bright bg-cognition-deep text-cognition-bright"
                  : "border-white/15 text-slate-300 hover:border-cognition/60"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {MODES.find((option) => option.id === mode)?.blurb}
        </p>
      </div>

      <ul className="flex flex-col gap-2">
        {PLAYER_SHIPS.map((spec) => {
          const placed = !trayIds.has(spec.id);
          const selected = selectedShipId === spec.id;
          return (
            <li key={spec.id}>
              <button
                type="button"
                onClick={() => (placed ? onPickUp(spec.id) : onSelect(spec.id))}
                className={`flex w-full items-center justify-between rounded border px-3 py-2 text-left text-sm transition-colors ${
                  selected
                    ? "border-cognition-bright bg-cognition-deep text-cognition-bright"
                    : placed
                      ? "border-white/10 bg-white/[0.03] text-slate-400 hover:border-cognition/60"
                      : "border-white/15 bg-white/[0.06] text-slate-200 hover:border-cognition-bright"
                }`}
              >
                <span className="font-medium">{spec.name}</span>
                <span className="flex items-center gap-2 font-mono text-xs">
                  <span aria-hidden className="flex items-center">
                    {Array.from({ length: spec.length }, (_, index) => (
                      <span key={index} className="relative h-4 w-4">
                        <HullSprite
                          part={
                            index === 0 ? "bow" : index === spec.length - 1 ? "stern" : "mid"
                          }
                          orientation="horizontal"
                        />
                      </span>
                    ))}
                  </span>
                  <span className="text-slate-500">{placed ? "deployed" : `${spec.length}`}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <button
          type="button"
          onClick={onRotate}
          className="rounded border border-white/15 px-3 py-2 uppercase tracking-wider text-slate-200 hover:border-cognition-bright"
        >
          Rotate (R) · {orientation === "horizontal" ? "→" : "↓"}
        </button>
        <button
          type="button"
          onClick={onAutoPlace}
          disabled={tray.length === 0}
          className="rounded border border-white/15 px-3 py-2 uppercase tracking-wider text-slate-200 hover:border-cognition-bright disabled:opacity-40"
        >
          Auto-place
        </button>
        <button
          type="button"
          onClick={onClear}
          disabled={board.ships.length === 0}
          className="rounded border border-white/15 px-3 py-2 uppercase tracking-wider text-slate-200 hover:border-rose-400 disabled:opacity-40"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={onStart}
          disabled={!readyToStart}
          className="rounded bg-cognition px-3 py-2 font-semibold uppercase tracking-wider text-abyss transition-opacity hover:bg-cognition-bright disabled:cursor-not-allowed disabled:opacity-40"
        >
          Start Battle
        </button>
      </div>
      <p className="text-xs text-slate-500">
        Click a cell to drop the bow. Click a deployed ship to pick it back up.
      </p>
    </section>
  );
}
