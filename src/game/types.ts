export const BOARD_SIZE = 10;

export type Orientation = "horizontal" | "vertical";

export type Side = "player" | "enemy";

/** Zero-based grid coordinate. `row` 0 is display row 1, `col` 0 is column A. */
export interface Coord {
  row: number;
  col: number;
}

/** A ship's identity and length, independent of where it sits on a board. */
export interface ShipSpec {
  id: string;
  name: string;
  length: number;
}

/** A ship that has been committed to a board. */
export interface Ship extends ShipSpec {
  bow: Coord;
  orientation: Orientation;
  /** Cells occupied by the ship, bow first. */
  cells: Coord[];
  /** Indices into `cells` that have been hit. */
  hits: number[];
}

export type CellState = "empty" | "ship" | "miss" | "hit" | "sunk";

export interface Cell {
  /** `null` when no ship occupies the cell. */
  shipId: string | null;
  fired: boolean;
}

export interface Board {
  cells: Cell[][];
  ships: Ship[];
}

export type ShotOutcome = "miss" | "hit" | "sunk";

export interface Shot {
  coord: Coord;
  outcome: ShotOutcome;
  /** Set for `hit` and `sunk` outcomes. */
  shipId: string | null;
  shipName: string | null;
}

/** Result of firing at a board: the new board plus what happened. */
export interface ShotResult {
  board: Board;
  shot: Shot;
  /** True when the shot sank the last floating ship on that board. */
  allSunk: boolean;
}
