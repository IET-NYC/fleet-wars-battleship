import type { Board, Orientation, ShipSpec } from "../game/types";
import { PLAYER_SHIPS } from "../game/theme";

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
                  <span className="tracking-[0.2em]">{"■".repeat(spec.length)}</span>
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
