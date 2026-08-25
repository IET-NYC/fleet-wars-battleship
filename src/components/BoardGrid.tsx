import { useState } from "react";
import { isValidPlacement, shipCells } from "../game/board";
import { cellState, columnLabels, coordKey, coordLabel } from "../game/rules";
import type { Board, Coord, Orientation, Side } from "../game/types";
import { BOARD_SIZE } from "../game/types";

interface PlacementConfig {
  shipLength: number;
  orientation: Orientation;
  onPlace: (coord: Coord) => void;
  onPickUp: (shipId: string) => void;
}

interface BoardGridProps {
  board: Board;
  side: Side;
  /** Player sees its own fleet; the enemy fleet stays hidden until sunk. */
  revealShips: boolean;
  interactive: boolean;
  onFire?: (coord: Coord) => void;
  placement?: PlacementConfig;
}

const CELL_BASE =
  "relative flex aspect-square items-center justify-center border border-white/5 text-[0.6rem] font-mono transition-colors";

const STATE_CLASSES: Record<string, string> = {
  empty: "bg-white/[0.02]",
  miss: "bg-slate-700/40 text-slate-300",
  hit: "bg-rose-500/70 text-white",
  sunk: "bg-rose-900/80 text-rose-100 ring-1 ring-inset ring-rose-300/60",
};

export default function BoardGrid({
  board,
  side,
  revealShips,
  interactive,
  onFire,
  placement,
}: BoardGridProps) {
  const [hover, setHover] = useState<Coord | null>(null);
  const accent = side === "player" ? "text-cognition-bright" : "text-cursor-bright";
  const shipFill =
    side === "player"
      ? "bg-cognition-deep text-cognition-bright ring-1 ring-inset ring-cognition/60"
      : "bg-cursor-deep text-cursor-bright ring-1 ring-inset ring-cursor/60";

  const previewCells =
    placement && hover
      ? shipCells(hover, placement.orientation, placement.shipLength)
      : [];
  const previewValid =
    placement && hover
      ? isValidPlacement(board, hover, placement.orientation, placement.shipLength)
      : false;
  const previewKeys = new Set(previewCells.map(coordKey));

  const handleClick = (coord: Coord) => {
    if (!interactive) return;
    if (placement) {
      const shipId = board.cells[coord.row][coord.col].shipId;
      if (shipId) {
        placement.onPickUp(shipId);
        return;
      }
      placement.onPlace(coord);
      return;
    }
    onFire?.(coord);
  };

  return (
    <div className="w-full">
      <div className="grid grid-cols-[1.25rem_repeat(10,minmax(0,1fr))] gap-[2px]">
        <span aria-hidden />
        {columnLabels().map((label) => (
          <span key={label} className={`text-center text-[0.6rem] font-mono ${accent}`}>
            {label}
          </span>
        ))}

        {Array.from({ length: BOARD_SIZE }, (_, row) => (
          <div key={`row-${row}`} className="contents">
            <span
              className={`flex items-center justify-center text-[0.6rem] font-mono ${accent}`}
            >
              {row + 1}
            </span>
            {Array.from({ length: BOARD_SIZE }, (_, col) => {
              const coord = { row, col };
              const key = coordKey(coord);
              const state = cellState(board, coord, revealShips);
              const isPreview = previewKeys.has(key);
              const label = coordLabel(coord);

              const classes = [CELL_BASE];
              if (state === "ship") classes.push(shipFill);
              else classes.push(STATE_CLASSES[state]);
              if (isPreview) {
                classes.push(
                  previewValid
                    ? "outline outline-2 outline-cognition-bright/80 bg-cognition/30"
                    : "outline outline-2 outline-rose-400/80 bg-rose-500/20",
                );
              }
              if (interactive && !placement && state !== "miss" && state !== "hit" && state !== "sunk") {
                classes.push("cursor-crosshair hover:bg-cursor/25");
              }
              if (interactive && placement) classes.push("cursor-pointer");
              if (!interactive) classes.push("cursor-default");
              if (state === "hit") classes.push("motion-safe:animate-hit-pulse");
              if (state === "miss") classes.push("motion-safe:animate-miss-fade");
              if (state === "sunk") classes.push("motion-safe:animate-sunk-shake");

              return (
                <button
                  key={key}
                  type="button"
                  disabled={!interactive}
                  aria-label={`${label} ${state}`}
                  className={classes.join(" ")}
                  onMouseEnter={() => placement && setHover(coord)}
                  onMouseLeave={() => placement && setHover(null)}
                  onClick={() => handleClick(coord)}
                >
                  {state === "miss" ? "•" : null}
                  {state === "hit" ? "✕" : null}
                  {state === "sunk" ? "▣" : null}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
