import { useState } from "react";
import { isValidPlacement, shipCells } from "../game/board";
import { cellState, columnLabels, coordKey, coordLabel, hullSegments } from "../game/rules";
import type { Board, Coord, Orientation, Side } from "../game/types";
import { BOARD_SIZE } from "../game/types";
import HullSprite from "./HullSprite";
import ShotMarker from "./ShotMarker";

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
  miss: "bg-slate-900/50 text-slate-300",
  hit: "bg-rose-500/40 text-white",
  sunk: "bg-rose-950/70 text-rose-200 ring-1 ring-inset ring-rose-300/40",
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
      ? "bg-cognition-deep/40 text-cognition-bright"
      : "bg-cursor-deep/40 text-cursor-bright";
  const hulls = hullSegments(board);

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
    <div className="sea-surface relative w-full overflow-hidden rounded-md p-1">
      <div className="sea-swell pointer-events-none absolute inset-0 motion-safe:animate-swell" />
      <div className="relative grid grid-cols-[1.25rem_repeat(10,minmax(0,1fr))] gap-[2px]">
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
              const showsHull =
                state === "ship" || state === "sunk" || (state === "hit" && revealShips);
              const hull = showsHull ? hulls.get(key) : undefined;

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
                  {hull ? (
                    <HullSprite
                      part={hull.part}
                      orientation={hull.orientation}
                      wrecked={state === "sunk" || state === "hit"}
                    />
                  ) : null}
                  {state === "miss" || state === "hit" || state === "sunk" ? (
                    <ShotMarker state={state} />
                  ) : null}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
