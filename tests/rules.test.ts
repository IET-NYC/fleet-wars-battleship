import { describe, expect, it } from "vitest";
import { createBoard, placeShip, randomPlacement } from "../src/game/board";
import {
  accuracy,
  allSunk,
  alreadyFired,
  cellState,
  coordLabel,
  columnLabels,
  fireShot,
  isSunk,
  opponentOf,
  shotsFired,
} from "../src/game/rules";
import { ENEMY_SHIPS, PLAYER_SHIPS, flavorFor } from "../src/game/theme";
import type { Board, Coord, ShipSpec } from "../src/game/types";

const destroyer: ShipSpec = { id: "deep-wiki", name: "Deep Wiki", length: 2 };
const cruiser: ShipSpec = { id: "cascade", name: "Cascade", length: 3 };

function boardWith(...placements: [ShipSpec, Coord, "horizontal" | "vertical"][]): Board {
  return placements.reduce<Board>((board, [spec, bow, orientation]) => {
    const next = placeShip(board, spec, bow, orientation);
    if (!next) throw new Error(`test fixture placement failed for ${spec.id}`);
    return next;
  }, createBoard());
}

describe("coordinate labels", () => {
  it("labels columns A-J and rows 1-10", () => {
    expect(coordLabel({ row: 0, col: 0 })).toBe("A1");
    expect(coordLabel({ row: 3, col: 3 })).toBe("D4");
    expect(coordLabel({ row: 9, col: 9 })).toBe("J10");
    expect(columnLabels()).toEqual(["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"]);
  });
});

describe("fireShot", () => {
  it("resolves an empty cell as a miss", () => {
    const board = boardWith([destroyer, { row: 0, col: 0 }, "horizontal"]);
    const result = fireShot(board, { row: 5, col: 5 });
    expect(result.shot.outcome).toBe("miss");
    expect(result.shot.shipName).toBeNull();
    expect(result.allSunk).toBe(false);
    expect(alreadyFired(result.board, { row: 5, col: 5 })).toBe(true);
  });

  it("resolves a partial hit as a hit, not a sink", () => {
    const board = boardWith([cruiser, { row: 2, col: 2 }, "horizontal"]);
    const result = fireShot(board, { row: 2, col: 3 });
    expect(result.shot.outcome).toBe("hit");
    expect(result.shot.shipName).toBe("Cascade");
    expect(isSunk(result.board.ships[0])).toBe(false);
    expect(result.board.ships[0].hits).toEqual([1]);
  });

  it("reports sunk on the final hit and names the ship", () => {
    let board = boardWith([destroyer, { row: 1, col: 1 }, "vertical"]);
    board = fireShot(board, { row: 1, col: 1 }).board;
    const result = fireShot(board, { row: 2, col: 1 });
    expect(result.shot.outcome).toBe("sunk");
    expect(result.shot.shipName).toBe("Deep Wiki");
    expect(isSunk(result.board.ships[0])).toBe(true);
  });

  it("does not mutate the board it was given", () => {
    const board = boardWith([destroyer, { row: 0, col: 0 }, "horizontal"]);
    fireShot(board, { row: 0, col: 0 });
    expect(board.cells[0][0].fired).toBe(false);
    expect(board.ships[0].hits).toEqual([]);
  });

  it("throws when the same cell is fired at twice", () => {
    const board = boardWith([destroyer, { row: 0, col: 0 }, "horizontal"]);
    const once = fireShot(board, { row: 4, col: 4 }).board;
    expect(() => fireShot(once, { row: 4, col: 4 })).toThrow(/already been fired/i);
  });
});

describe("allSunk", () => {
  it("is false while any ship floats and true once the last one sinks", () => {
    let board = boardWith(
      [destroyer, { row: 0, col: 0 }, "horizontal"],
      [cruiser, { row: 5, col: 0 }, "horizontal"],
    );
    board = fireShot(board, { row: 0, col: 0 }).board;
    board = fireShot(board, { row: 0, col: 1 }).board;
    expect(allSunk(board)).toBe(false);

    board = fireShot(board, { row: 5, col: 0 }).board;
    board = fireShot(board, { row: 5, col: 1 }).board;
    const final = fireShot(board, { row: 5, col: 2 });
    expect(final.shot.outcome).toBe("sunk");
    expect(final.allSunk).toBe(true);
    expect(allSunk(final.board)).toBe(true);
  });

  it("is false for a board with no ships at all", () => {
    expect(allSunk(createBoard())).toBe(false);
  });

  it("detects a win over a full randomly placed fleet", () => {
    let board = randomPlacement(ENEMY_SHIPS);
    const targets = board.ships.flatMap((ship) => ship.cells);
    for (const coord of targets) {
      board = fireShot(board, coord).board;
    }
    expect(allSunk(board)).toBe(true);
    expect(board.ships.every(isSunk)).toBe(true);
  });
});

describe("cellState", () => {
  it("hides un-hit enemy ships but reveals your own", () => {
    const board = boardWith([cruiser, { row: 0, col: 0 }, "horizontal"]);
    expect(cellState(board, { row: 0, col: 0 }, true)).toBe("ship");
    expect(cellState(board, { row: 0, col: 0 }, false)).toBe("empty");
  });

  it("reports miss, hit and sunk states", () => {
    let board = boardWith([destroyer, { row: 0, col: 0 }, "horizontal"]);
    board = fireShot(board, { row: 4, col: 4 }).board;
    expect(cellState(board, { row: 4, col: 4 }, false)).toBe("miss");

    board = fireShot(board, { row: 0, col: 0 }).board;
    expect(cellState(board, { row: 0, col: 0 }, false)).toBe("hit");

    board = fireShot(board, { row: 0, col: 1 }).board;
    expect(cellState(board, { row: 0, col: 0 }, false)).toBe("sunk");
    expect(cellState(board, { row: 0, col: 1 }, false)).toBe("sunk");
  });
});

describe("shot statistics", () => {
  it("counts shots and computes accuracy as a percentage", () => {
    let board = boardWith([destroyer, { row: 0, col: 0 }, "horizontal"]);
    expect(accuracy(board)).toBe(0);

    board = fireShot(board, { row: 0, col: 0 }).board;
    board = fireShot(board, { row: 9, col: 9 }).board;
    expect(shotsFired(board)).toBe(2);
    expect(accuracy(board)).toBe(50);
  });
});

describe("opponentOf", () => {
  it("flips sides", () => {
    expect(opponentOf("player")).toBe("enemy");
    expect(opponentOf("enemy")).toBe("player");
  });
});

describe("theme", () => {
  it("defines the five required ships per side with standard lengths", () => {
    expect(PLAYER_SHIPS.map((ship) => ship.name)).toEqual([
      "Devin",
      "Windsurf",
      "SWE-1",
      "Cascade",
      "Deep Wiki",
    ]);
    expect(ENEMY_SHIPS.map((ship) => ship.name)).toEqual([
      "Composer",
      "Cursor Tab",
      "Bugbot",
      "Agent Mode",
      "Autocomplete",
    ]);
    expect(PLAYER_SHIPS.map((ship) => ship.length)).toEqual([5, 4, 3, 3, 2]);
    expect(ENEMY_SHIPS.map((ship) => ship.length)).toEqual([5, 4, 3, 3, 2]);
  });

  it("interpolates ship names and coordinates into flavor text", () => {
    const always = () => 0;
    expect(flavorFor({ kind: "shipSunk", side: "enemy", shipName: "Composer" }, always)).toContain(
      "Composer",
    );
    expect(flavorFor({ kind: "hit", side: "player", shipName: "Windsurf" }, always)).toContain(
      "Windsurf",
    );
    expect(flavorFor({ kind: "miss", side: "enemy", coord: "D4" }, always)).toContain("D4");
    expect(flavorFor({ kind: "win" }, always)).toMatch(/Cognition/);
    expect(flavorFor({ kind: "loss" }, always)).toBeTruthy();
  });

  it("never leaves an unreplaced placeholder in any flavor line", () => {
    for (let index = 0; index < 5; index += 1) {
      const random = () => index / 5;
      const lines = [
        flavorFor({ kind: "shipSunk", side: "enemy", shipName: "Bugbot" }, random),
        flavorFor({ kind: "shipSunk", side: "player", shipName: "Devin" }, random),
        flavorFor({ kind: "hit", side: "enemy", shipName: "Bugbot" }, random),
        flavorFor({ kind: "hit", side: "player", shipName: "Devin" }, random),
        flavorFor({ kind: "miss", side: "enemy", coord: "A1" }, random),
        flavorFor({ kind: "miss", side: "player", coord: "A1" }, random),
        flavorFor({ kind: "win" }, random),
        flavorFor({ kind: "loss" }, random),
      ];
      for (const line of lines) {
        expect(line).not.toMatch(/\{ship\}|\{coord\}/);
      }
    }
  });
});
