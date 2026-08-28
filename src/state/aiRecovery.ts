import { isSunk } from "../game/rules";
import type { HuntTargetAI } from "../game/ai";
import type { Board, Coord } from "../game/types";

function keyOf({ row, col }: Coord): string {
  return `${row},${col}`;
}

/**
 * Replays the shots already visible on `board` into a fresh AI. A rebuilt
 * opponent starts with an empty fired set, so without this it would happily
 * pick a cell that has already been fired upon and make `fireShot` throw.
 */
export function seedAiFromBoard(ai: HuntTargetAI, board: Board): void {
  const sunkShips = board.ships.filter(isSunk);
  const sunkCells = new Set(sunkShips.flatMap((ship) => ship.cells.map(keyOf)));

  for (let row = 0; row < board.cells.length; row += 1) {
    for (let col = 0; col < board.cells[row].length; col += 1) {
      const cell = board.cells[row][col];
      if (!cell.fired || sunkCells.has(keyOf({ row, col }))) continue;
      ai.registerResult({
        coord: { row, col },
        outcome: cell.shipId === null ? "miss" : "hit",
      });
    }
  }

  // Sunk ships go in last so the AI retires their hits instead of chasing them.
  const gameOver = sunkShips.length === board.ships.length && board.ships.length > 0;
  sunkShips.forEach((ship, index) => {
    const last = ship.cells.length - 1;
    ship.cells.forEach((coord, cellIndex) => {
      if (cellIndex === last) return;
      ai.registerResult({ coord, outcome: "hit" });
    });
    ai.registerResult(
      { coord: ship.cells[last], outcome: "sunk", sunkShipLength: ship.length },
      gameOver && index === sunkShips.length - 1,
    );
  });
}
