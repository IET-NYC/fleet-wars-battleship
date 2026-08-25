import { describe, expect, it } from "vitest";
import {
  clearShips,
  createBoard,
  isOnBoard,
  isValidPlacement,
  placeShip,
  randomPlacement,
  removeShip,
  shipCells,
} from "../src/game/board";
import { PLAYER_SHIPS } from "../src/game/theme";
import { BOARD_SIZE } from "../src/game/types";
import type { Board, ShipSpec } from "../src/game/types";

const carrier: ShipSpec = { id: "devin", name: "Devin", length: 5 };
const destroyer: ShipSpec = { id: "deep-wiki", name: "Deep Wiki", length: 2 };

function place(board: Board, spec: ShipSpec, row: number, col: number, orientation: "horizontal" | "vertical") {
  const next = placeShip(board, spec, { row, col }, orientation);
  expect(next).not.toBeNull();
  return next as Board;
}

describe("createBoard", () => {
  it("creates a 10x10 grid of empty, unfired cells", () => {
    const board = createBoard();
    expect(board.cells).toHaveLength(BOARD_SIZE);
    expect(board.cells.every((row) => row.length === BOARD_SIZE)).toBe(true);
    expect(board.cells.flat().every((cell) => cell.shipId === null && !cell.fired)).toBe(true);
    expect(board.ships).toEqual([]);
  });
});

describe("isOnBoard", () => {
  it("accepts the corners and rejects anything outside", () => {
    expect(isOnBoard({ row: 0, col: 0 })).toBe(true);
    expect(isOnBoard({ row: 9, col: 9 })).toBe(true);
    expect(isOnBoard({ row: -1, col: 0 })).toBe(false);
    expect(isOnBoard({ row: 0, col: 10 })).toBe(false);
  });
});

describe("shipCells", () => {
  it("lays cells out from the bow in the given orientation", () => {
    expect(shipCells({ row: 2, col: 3 }, "horizontal", 3)).toEqual([
      { row: 2, col: 3 },
      { row: 2, col: 4 },
      { row: 2, col: 5 },
    ]);
    expect(shipCells({ row: 2, col: 3 }, "vertical", 2)).toEqual([
      { row: 2, col: 3 },
      { row: 3, col: 3 },
    ]);
  });
});

describe("isValidPlacement", () => {
  it("rejects a ship running off the right edge", () => {
    const board = createBoard();
    expect(isValidPlacement(board, { row: 0, col: 6 }, "horizontal", 5)).toBe(false);
    expect(isValidPlacement(board, { row: 0, col: 5 }, "horizontal", 5)).toBe(true);
  });

  it("rejects a ship running off the bottom edge", () => {
    const board = createBoard();
    expect(isValidPlacement(board, { row: 6, col: 0 }, "vertical", 5)).toBe(false);
    expect(isValidPlacement(board, { row: 5, col: 0 }, "vertical", 5)).toBe(true);
  });

  it("rejects an overlap of exactly one cell", () => {
    const board = place(createBoard(), carrier, 4, 0, "horizontal");
    // Carrier occupies A5-E5; a vertical 2-ship bowed at E4 would cover E5.
    expect(isValidPlacement(board, { row: 3, col: 4 }, "vertical", 2)).toBe(false);
    // Shifted one column right it only touches the carrier, which is allowed.
    expect(isValidPlacement(board, { row: 3, col: 5 }, "vertical", 2)).toBe(true);
  });

  it("allows adjacent (touching) ships", () => {
    const board = place(createBoard(), carrier, 0, 0, "horizontal");
    expect(isValidPlacement(board, { row: 1, col: 0 }, "horizontal", 2)).toBe(true);
  });

  it("rejects a rotation that would leave the board", () => {
    const board = place(createBoard(), carrier, 9, 0, "horizontal");
    const rotated = placeShip(board, carrier, { row: 9, col: 0 }, "vertical");
    expect(rotated).toBeNull();
    expect(isValidPlacement(board, { row: 9, col: 0 }, "vertical", carrier.length, carrier.id)).toBe(
      false,
    );
  });

  it("ignores the ship's own footprint when it is being re-placed", () => {
    const board = place(createBoard(), carrier, 0, 0, "horizontal");
    expect(isValidPlacement(board, { row: 0, col: 1 }, "horizontal", carrier.length)).toBe(false);
    expect(
      isValidPlacement(board, { row: 0, col: 1 }, "horizontal", carrier.length, carrier.id),
    ).toBe(true);
  });
});

describe("placeShip", () => {
  it("marks every occupied cell and records the ship once", () => {
    const board = place(createBoard(), destroyer, 5, 5, "vertical");
    expect(board.cells[5][5].shipId).toBe("deep-wiki");
    expect(board.cells[6][5].shipId).toBe("deep-wiki");
    expect(board.ships).toHaveLength(1);
    expect(board.ships[0].hits).toEqual([]);
  });

  it("does not mutate the board it was given", () => {
    const original = createBoard();
    place(original, destroyer, 0, 0, "horizontal");
    expect(original.ships).toHaveLength(0);
    expect(original.cells[0][0].shipId).toBeNull();
  });

  it("moves a ship instead of duplicating it when re-placed", () => {
    const first = place(createBoard(), destroyer, 0, 0, "horizontal");
    const moved = place(first, destroyer, 4, 4, "vertical");
    expect(moved.ships).toHaveLength(1);
    expect(moved.cells[0][0].shipId).toBeNull();
    expect(moved.cells[0][1].shipId).toBeNull();
    expect(moved.cells[4][4].shipId).toBe("deep-wiki");
  });

  it("returns null for an invalid placement", () => {
    expect(placeShip(createBoard(), carrier, { row: 0, col: 9 }, "horizontal")).toBeNull();
  });
});

describe("removeShip and clearShips", () => {
  it("lifts a single ship off the grid", () => {
    const board = place(place(createBoard(), carrier, 0, 0, "horizontal"), destroyer, 3, 3, "vertical");
    const lifted = removeShip(board, carrier.id);
    expect(lifted.ships.map((ship) => ship.id)).toEqual(["deep-wiki"]);
    expect(lifted.cells[0][0].shipId).toBeNull();
    expect(lifted.cells[3][3].shipId).toBe("deep-wiki");
  });

  it("clears every ship", () => {
    const board = randomPlacement(PLAYER_SHIPS);
    const cleared = clearShips(board);
    expect(cleared.ships).toEqual([]);
    expect(cleared.cells.flat().every((cell) => cell.shipId === null)).toBe(true);
  });
});

describe("randomPlacement", () => {
  it("seats a full, valid, non-overlapping fleet across many rolls", () => {
    for (let run = 0; run < 200; run += 1) {
      const board = randomPlacement(PLAYER_SHIPS);
      expect(board.ships).toHaveLength(PLAYER_SHIPS.length);

      const occupied = board.cells.flat().filter((cell) => cell.shipId !== null).length;
      const expected = PLAYER_SHIPS.reduce((total, ship) => total + ship.length, 0);
      expect(occupied).toBe(expected);

      for (const ship of board.ships) {
        expect(ship.cells).toHaveLength(ship.length);
        for (const coord of ship.cells) {
          expect(isOnBoard(coord)).toBe(true);
          expect(board.cells[coord.row][coord.col].shipId).toBe(ship.id);
        }
      }
    }
  });

  it("is deterministic for a seeded random source", () => {
    const seeded = () => {
      let value = 42;
      return () => {
        value = (value * 1103515245 + 12345) % 2147483648;
        return value / 2147483648;
      };
    };
    const a = randomPlacement(PLAYER_SHIPS, seeded());
    const b = randomPlacement(PLAYER_SHIPS, seeded());
    expect(a.ships.map((ship) => [ship.id, ship.bow, ship.orientation])).toEqual(
      b.ships.map((ship) => [ship.id, ship.bow, ship.orientation]),
    );
  });
});
