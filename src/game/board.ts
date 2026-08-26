import { BOARD_SIZE } from "./types";
import type { Board, Cell, Coord, Orientation, Ship, ShipSpec } from "./types";

export function createBoard(): Board {
  const cells: Cell[][] = Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, (): Cell => ({ shipId: null, fired: false })),
  );
  return { cells, ships: [] };
}

export function isOnBoard({ row, col }: Coord): boolean {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

/** Cells a ship of `length` would occupy starting at `bow`, without bounds checking. */
export function shipCells(bow: Coord, orientation: Orientation, length: number): Coord[] {
  return Array.from({ length }, (_, index) =>
    orientation === "horizontal"
      ? { row: bow.row, col: bow.col + index }
      : { row: bow.row + index, col: bow.col },
  );
}

/**
 * A placement is valid when every cell is on-board and unoccupied. Ships may
 * touch, so only exact overlap is rejected. `ignoreShipId` lets a ship be
 * re-placed over its own current footprint.
 */
export function isValidPlacement(
  board: Board,
  bow: Coord,
  orientation: Orientation,
  length: number,
  ignoreShipId?: string,
): boolean {
  const cells = shipCells(bow, orientation, length);
  return cells.every((coord) => {
    if (!isOnBoard(coord)) return false;
    const occupant = board.cells[coord.row][coord.col].shipId;
    return occupant === null || occupant === ignoreShipId;
  });
}

/** Deep copy of `board`: cells, ships, ship footprints and hit lists. */
export function cloneBoard(board: Board): Board {
  return {
    cells: board.cells.map((row) => row.map((cell) => ({ ...cell }))),
    ships: board.ships.map((ship) => ({
      ...ship,
      cells: ship.cells.map((coord) => ({ ...coord })),
      hits: [...ship.hits],
    })),
  };
}

/**
 * Places `spec` with its bow at `bow`. Any existing ship with the same id is
 * lifted first, so this doubles as a "move ship" operation. Returns `null` when
 * the placement is invalid, leaving the input board untouched.
 */
export function placeShip(
  board: Board,
  spec: ShipSpec,
  bow: Coord,
  orientation: Orientation,
): Board | null {
  if (!isValidPlacement(board, bow, orientation, spec.length, spec.id)) return null;

  const next = removeShip(board, spec.id);
  const cells = shipCells(bow, orientation, spec.length);
  const ship: Ship = { ...spec, bow, orientation, cells, hits: [] };
  for (const coord of cells) {
    next.cells[coord.row][coord.col].shipId = spec.id;
  }
  next.ships.push(ship);
  return next;
}

/** Returns a copy of `board` with `shipId` lifted off the grid. */
export function removeShip(board: Board, shipId: string): Board {
  const next = cloneBoard(board);
  const ship = next.ships.find((candidate) => candidate.id === shipId);
  if (!ship) return next;

  for (const coord of ship.cells) {
    if (next.cells[coord.row][coord.col].shipId === shipId) {
      next.cells[coord.row][coord.col].shipId = null;
    }
  }
  next.ships = next.ships.filter((candidate) => candidate.id !== shipId);
  return next;
}

/** Returns a copy of `board` with every ship lifted off the grid. */
export function clearShips(board: Board): Board {
  const next = createBoard();
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      next.cells[row][col].fired = board.cells[row][col].fired;
    }
  }
  return next;
}

/**
 * Places every spec in `specs` at a random valid position. Placement is
 * attempted per ship with a bounded retry budget and restarts from scratch if a
 * ship cannot be seated, so the result is always a complete, valid fleet.
 */
export function randomPlacement(
  specs: ShipSpec[],
  random: () => number = Math.random,
  board: Board = createBoard(),
): Board {
  const attemptsPerShip = 200;

  for (let restart = 0; restart < 20; restart += 1) {
    let candidate = board;
    let seatedAll = true;

    for (const spec of specs) {
      let seated = false;
      for (let attempt = 0; attempt < attemptsPerShip; attempt += 1) {
        const orientation: Orientation = random() < 0.5 ? "horizontal" : "vertical";
        const span = spec.length - 1;
        const maxRow = orientation === "vertical" ? BOARD_SIZE - span : BOARD_SIZE;
        const maxCol = orientation === "horizontal" ? BOARD_SIZE - span : BOARD_SIZE;
        const bow: Coord = {
          row: Math.floor(random() * maxRow),
          col: Math.floor(random() * maxCol),
        };
        const placed = placeShip(candidate, spec, bow, orientation);
        if (placed) {
          candidate = placed;
          seated = true;
          break;
        }
      }
      if (!seated) {
        seatedAll = false;
        break;
      }
    }

    if (seatedAll) return candidate;
  }

  throw new Error("Unable to place fleet after repeated attempts");
}
