import { cloneBoard } from "./board";
import { BOARD_SIZE } from "./types";
import type {
  Board,
  CellState,
  Coord,
  Orientation,
  Ship,
  ShotResult,
  Side,
} from "./types";

const COLUMN_LABELS = "ABCDEFGHIJ";

/** "D4" for `{ row: 3, col: 3 }`. */
export function coordLabel({ row, col }: Coord): string {
  return `${COLUMN_LABELS[col]}${row + 1}`;
}

export function columnLabels(): string[] {
  return COLUMN_LABELS.slice(0, BOARD_SIZE).split("");
}

export function coordKey({ row, col }: Coord): string {
  return `${row},${col}`;
}

export function sameCoord(a: Coord, b: Coord): boolean {
  return a.row === b.row && a.col === b.col;
}

export function isSunk(ship: Ship): boolean {
  return ship.hits.length === ship.length;
}

export function allSunk(board: Board): boolean {
  return board.ships.length > 0 && board.ships.every(isSunk);
}

export function alreadyFired(board: Board, { row, col }: Coord): boolean {
  return board.cells[row][col].fired;
}

/**
 * Resolves a shot at `coord` against `board`. Throws when the cell was already
 * fired upon — callers must gate on `alreadyFired`, which keeps double-fire bugs
 * loud instead of silently wasting a turn.
 */
export function fireShot(board: Board, coord: Coord): ShotResult {
  if (alreadyFired(board, coord)) {
    throw new Error(`Cell ${coordLabel(coord)} has already been fired upon`);
  }

  const next: Board = cloneBoard(board);
  const cell = next.cells[coord.row][coord.col];
  cell.fired = true;

  if (cell.shipId === null) {
    return {
      board: next,
      shot: { coord, outcome: "miss", shipId: null, shipName: null },
      allSunk: false,
    };
  }

  const ship = next.ships.find((candidate) => candidate.id === cell.shipId);
  if (!ship) {
    throw new Error(`Board cell ${coordLabel(coord)} references unknown ship ${cell.shipId}`);
  }

  const hitIndex = ship.cells.findIndex((c) => sameCoord(c, coord));
  if (!ship.hits.includes(hitIndex)) {
    ship.hits.push(hitIndex);
  }

  const sunk = isSunk(ship);
  return {
    board: next,
    shot: {
      coord,
      outcome: sunk ? "sunk" : "hit",
      shipId: ship.id,
      shipName: ship.name,
    },
    allSunk: allSunk(next),
  };
}

/**
 * Visual state of a cell. `revealShips` is true for your own board (you see your
 * fleet) and false for the enemy board, where only sunk ships are revealed.
 */
export function cellState(board: Board, coord: Coord, revealShips: boolean): CellState {
  const cell = board.cells[coord.row][coord.col];
  const ship = cell.shipId
    ? board.ships.find((candidate) => candidate.id === cell.shipId)
    : undefined;

  if (ship && isSunk(ship)) return "sunk";
  if (cell.fired) return cell.shipId === null ? "miss" : "hit";
  if (ship && revealShips) return "ship";
  return "empty";
}

/** Which part of a hull a cell draws, bow first along the ship's cells. */
export type HullPart = "bow" | "mid" | "stern";

export interface HullSegment {
  shipId: string;
  orientation: Orientation;
  part: HullPart;
  /** True once this particular cell has been hit. */
  damaged: boolean;
}

/**
 * Per-cell hull rendering data for every ship on `board`, keyed by `coordKey`.
 * Lets the grid draw a continuous vessel out of independent cells.
 */
export function hullSegments(board: Board): Map<string, HullSegment> {
  const segments = new Map<string, HullSegment>();

  for (const ship of board.ships) {
    ship.cells.forEach((coord, index) => {
      segments.set(coordKey(coord), {
        shipId: ship.id,
        orientation: ship.orientation,
        part: index === 0 ? "bow" : index === ship.length - 1 ? "stern" : "mid",
        damaged: ship.hits.includes(index),
      });
    });
  }

  return segments;
}

export function shotsFired(board: Board): number {
  return board.cells.flat().filter((cell) => cell.fired).length;
}

export function hitsLanded(board: Board): number {
  return board.ships.reduce((total, ship) => total + ship.hits.length, 0);
}

/** Hit rate over shots fired at `board`, as a 0-100 percentage. */
export function accuracy(board: Board): number {
  const shots = shotsFired(board);
  if (shots === 0) return 0;
  return Math.round((hitsLanded(board) / shots) * 100);
}

export function opponentOf(side: Side): Side {
  return side === "player" ? "enemy" : "player";
}
