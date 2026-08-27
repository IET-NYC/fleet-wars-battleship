import { describe, expect, it } from "vitest";
import { HuntTargetAI } from "../src/game/ai";
import { createBoard, placeShip } from "../src/game/board";
import { fireShot } from "../src/game/rules";
import { PLAYER_SHIPS } from "../src/game/theme";
import type { Board, Coord } from "../src/game/types";
import { seedAiFromBoard } from "../src/state/aiRecovery";

const LENGTHS = PLAYER_SHIPS.map((ship) => ship.length);

function boardWithFleet(): Board {
  let board = createBoard();
  PLAYER_SHIPS.forEach((ship, index) => {
    const placed = placeShip(board, ship, { row: index * 2, col: 0 }, "horizontal");
    if (!placed) throw new Error("fixture placement should be valid");
    board = placed;
  });
  return board;
}

function fireAll(board: Board, coords: Coord[]): Board {
  return coords.reduce((current, coord) => fireShot(current, coord).board, board);
}

describe("seedAiFromBoard", () => {
  it("marks every already-fired cell as fired", () => {
    const shots: Coord[] = [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 9, col: 9 },
      { row: 5, col: 5 },
    ];
    const board = fireAll(boardWithFleet(), shots);

    const ai = new HuntTargetAI(LENGTHS);
    seedAiFromBoard(ai, board);

    for (const shot of shots) {
      expect(ai.hasFiredAt(shot)).toBe(true);
    }
    expect(ai.hasFiredAt({ row: 3, col: 3 })).toBe(false);
  });

  it("never picks a cell that has already been fired upon", () => {
    // Fire at everything except one cell: a seeded AI must pick that cell.
    const shots: Coord[] = [];
    for (let row = 0; row < 10; row += 1) {
      for (let col = 0; col < 10; col += 1) {
        if (row === 7 && col === 7) continue;
        shots.push({ row, col });
      }
    }
    const board = fireAll(createBoard(), shots);

    const ai = new HuntTargetAI(LENGTHS);
    seedAiFromBoard(ai, board);

    expect(ai.nextShot()).toEqual({ row: 7, col: 7 });
  });

  it("chases an outstanding hit but not the hits of a sunk ship", () => {
    // Deep Wiki (length 2) sits at row 8; sinking it must retire both hits,
    // while the single hit on Devin at row 0 stays live.
    const board = fireAll(boardWithFleet(), [
      { row: 0, col: 0 },
      { row: 8, col: 0 },
      { row: 8, col: 1 },
    ]);

    const ai = new HuntTargetAI(LENGTHS);
    seedAiFromBoard(ai, board);

    expect(ai.mode).toBe("target");
    const queue = ai.debugTargetQueue;
    expect(queue).toContainEqual({ row: 1, col: 0 });
    expect(queue).not.toContainEqual({ row: 8, col: 2 });
    expect(queue).not.toContainEqual({ row: 9, col: 0 });
  });

  it("reports game over once the whole fleet is sunk", () => {
    let board = boardWithFleet();
    for (const ship of board.ships) {
      board = fireAll(board, ship.cells);
    }

    const ai = new HuntTargetAI(LENGTHS);
    seedAiFromBoard(ai, board);

    expect(ai.isGameOver).toBe(true);
  });
});
