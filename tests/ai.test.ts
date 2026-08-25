import { describe, expect, it } from "vitest";
import { createBoard, placeShip, randomPlacement } from "../src/game/board";
import { HuntTargetAI } from "../src/game/ai";
import { alreadyFired, coordLabel, fireShot, isSunk } from "../src/game/rules";
import { PLAYER_SHIPS } from "../src/game/theme";
import { BOARD_SIZE } from "../src/game/types";
import type { Board, Coord, ShipSpec } from "../src/game/types";

/** Deterministic LCG so AI runs are reproducible. */
function seededRandom(seed: number): () => number {
  let value = seed % 2147483647;
  if (value <= 0) value += 2147483646;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function must(board: Board | null): Board {
  if (!board) throw new Error("test fixture placement failed");
  return board;
}

function label(coord: Coord): string {
  return coordLabel(coord);
}

/**
 * Plays a full game of the AI against `board`, asserting the three "never"
 * rules on every single shot.
 */
function playOut(board: Board, random: () => number) {
  const ai = new HuntTargetAI(
    board.ships.map((ship) => ship.length),
    random,
  );
  const seen = new Set<string>();
  let current = board;
  let shots = 0;

  while (!ai.isGameOver) {
    shots += 1;
    if (shots > BOARD_SIZE * BOARD_SIZE) {
      throw new Error("AI failed to finish the board within 100 shots");
    }

    const coord = ai.nextShot();

    // never off-board
    expect(coord.row).toBeGreaterThanOrEqual(0);
    expect(coord.row).toBeLessThan(BOARD_SIZE);
    expect(coord.col).toBeGreaterThanOrEqual(0);
    expect(coord.col).toBeLessThan(BOARD_SIZE);
    // never a repeat
    expect(seen.has(label(coord))).toBe(false);
    expect(alreadyFired(current, coord)).toBe(false);
    seen.add(label(coord));

    const result = fireShot(current, coord);
    current = result.board;
    const sunkShip =
      result.shot.outcome === "sunk"
        ? current.ships.find((ship) => ship.id === result.shot.shipId)
        : undefined;

    ai.registerResult(
      {
        coord,
        outcome: result.shot.outcome,
        sunkShipLength: sunkShip?.length,
      },
      result.allSunk,
    );
  }

  return { ai, shots, board: current };
}

describe("HuntTargetAI never-rules", () => {
  it("never fires at a cell it has already fired at", () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const random = seededRandom(seed * 977);
      playOut(randomPlacement(PLAYER_SHIPS, random), random);
    }
  });

  it("never fires off-board, even when hits sit against every edge", () => {
    // Ships hugging all four edges maximise the chance of off-board neighbours.
    let board = createBoard();
    const edgeFleet: [ShipSpec, Coord, "horizontal" | "vertical"][] = [
      [PLAYER_SHIPS[0], { row: 0, col: 0 }, "horizontal"],
      [PLAYER_SHIPS[1], { row: 9, col: 6 }, "horizontal"],
      [PLAYER_SHIPS[2], { row: 7, col: 0 }, "vertical"],
      [PLAYER_SHIPS[3], { row: 0, col: 9 }, "vertical"],
      [PLAYER_SHIPS[4], { row: 4, col: 9 }, "vertical"],
    ];
    for (const [spec, bow, orientation] of edgeFleet) {
      board = must(placeShip(board, spec, bow, orientation));
    }
    const { board: final } = playOut(board, seededRandom(4242));
    expect(final.ships.every(isSunk)).toBe(true);
  });

  it("never fires after the game is over", () => {
    const board = must(placeShip(createBoard(), { id: "tiny", name: "Tiny", length: 2 }, { row: 0, col: 0 }, "horizontal"));
    const ai = new HuntTargetAI([2], seededRandom(7));
    ai.registerResult({ coord: { row: 0, col: 0 }, outcome: "hit" });
    ai.registerResult({ coord: { row: 0, col: 1 }, outcome: "sunk", sunkShipLength: 2 }, true);

    expect(ai.isGameOver).toBe(true);
    expect(() => ai.nextShot()).toThrow(/after the game is over/i);
    expect(board.ships).toHaveLength(1);
  });

  it("finishes every randomly placed fleet it is given", () => {
    for (let seed = 1; seed <= 30; seed += 1) {
      const random = seededRandom(seed * 31 + 5);
      const { board, ai } = playOut(randomPlacement(PLAYER_SHIPS, random), random);
      expect(board.ships.every(isSunk)).toBe(true);
      expect(ai.isGameOver).toBe(true);
    }
  });
});

describe("HuntTargetAI hunt mode", () => {
  it("fires only on parity cells while the pattern can still hide a ship", () => {
    const ai = new HuntTargetAI([5, 4, 3, 3, 2], seededRandom(99));
    for (let shot = 0; shot < 25; shot += 1) {
      const coord = ai.nextShot();
      expect((coord.row + coord.col) % 2).toBe(0);
      ai.registerResult({ coord, outcome: "miss" });
    }
    expect(ai.mode).toBe("hunt");
  });

  it("falls back to off-parity cells once the parity pattern is exhausted", () => {
    const ai = new HuntTargetAI([2], seededRandom(1234));
    for (let row = 0; row < BOARD_SIZE; row += 1) {
      for (let col = 0; col < BOARD_SIZE; col += 1) {
        if ((row + col) % 2 === 0) ai.registerResult({ coord: { row, col }, outcome: "miss" });
      }
    }

    const seen = new Set<string>();
    for (let shot = 0; shot < 50; shot += 1) {
      const coord = ai.nextShot();
      expect((coord.row + coord.col) % 2).toBe(1);
      expect(ai.hasFiredAt(coord)).toBe(false);
      expect(seen.has(label(coord))).toBe(false);
      seen.add(label(coord));
      ai.registerResult({ coord, outcome: "miss" });
    }
    expect(seen.size).toBe(50);
    expect(() => ai.nextShot()).toThrow(/no cells left/i);
  });

  it("still sinks a length-2 ship whose remaining cell is off parity", () => {
    // Deep Wiki sits on B1-B2 => (0,1) off parity and (1,1) on parity, so the
    // parity sweep can only ever touch one of its two cells.
    let current = must(
      placeShip(createBoard(), { id: "deep-wiki", name: "Deep Wiki", length: 2 }, { row: 0, col: 1 }, "vertical"),
    );
    const ai = new HuntTargetAI([2], seededRandom(1234));

    // Sweep the parity pattern for real, so board and AI stay consistent.
    for (let row = 0; row < BOARD_SIZE && !current.ships.every(isSunk); row += 1) {
      for (let col = 0; col < BOARD_SIZE; col += 1) {
        if ((row + col) % 2 !== 0) continue;
        const coord = { row, col };
        const result = fireShot(current, coord);
        current = result.board;
        ai.registerResult({ coord, outcome: result.shot.outcome, sunkShipLength: undefined });
        if (result.shot.outcome === "hit") break;
      }
    }

    expect(ai.mode).toBe("target");
    expect(ai.targetQueue.map(label)).toContain("B1");

    // The off-parity cell is reachable only through target mode; it must be
    // found within the four neighbours of the hit.
    let shots = 0;
    while (!current.ships.every(isSunk)) {
      shots += 1;
      expect(shots).toBeLessThanOrEqual(4);
      const coord = ai.nextShot();
      const result = fireShot(current, coord);
      current = result.board;
      ai.registerResult({
        coord,
        outcome: result.shot.outcome,
        sunkShipLength: result.shot.outcome === "sunk" ? 2 : undefined,
      });
    }
    expect(current.ships[0].hits).toHaveLength(2);
  });

  it("never proposes a cell that cannot hide the smallest remaining ship", () => {
    const ai = new HuntTargetAI([2], seededRandom(2024));
    // Isolate F6 by firing at all four of its neighbours.
    for (const coord of [
      { row: 4, col: 5 },
      { row: 6, col: 5 },
      { row: 5, col: 4 },
      { row: 5, col: 6 },
    ]) {
      ai.registerResult({ coord, outcome: "miss" });
    }
    for (let shot = 0; shot < 40; shot += 1) {
      const coord = ai.nextShot();
      expect(label(coord)).not.toBe("F6");
      ai.registerResult({ coord, outcome: "miss" });
    }
  });
});

describe("HuntTargetAI target mode", () => {
  it("queues the four orthogonal neighbours of a hit, skipping off-board cells", () => {
    const ai = new HuntTargetAI([5, 4, 3, 3, 2], seededRandom(11));
    ai.registerResult({ coord: { row: 0, col: 0 }, outcome: "hit" });

    expect(ai.mode).toBe("target");
    expect(ai.targetQueue.map(label).sort()).toEqual(["A2", "B1"]);
  });

  it("skips already-fired neighbours", () => {
    const ai = new HuntTargetAI([5, 4, 3, 3, 2], seededRandom(11));
    ai.registerResult({ coord: { row: 5, col: 4 }, outcome: "miss" });
    ai.registerResult({ coord: { row: 5, col: 5 }, outcome: "hit" });

    expect(ai.targetQueue.map(label).sort()).toEqual(["F5", "F7", "G6"]);
  });

  it("prioritises both line extensions over perpendicular neighbours after a second hit", () => {
    const ai = new HuntTargetAI([5, 4, 3, 3, 2], seededRandom(11));
    ai.registerResult({ coord: { row: 4, col: 4 }, outcome: "hit" });
    ai.registerResult({ coord: { row: 4, col: 5 }, outcome: "hit" });

    const queue = ai.targetQueue.map(label);
    // E5-F5 is a horizontal run; D5 and G5 extend it in both directions.
    expect(queue.slice(0, 2).sort()).toEqual(["D5", "G5"]);
    expect(queue).toContain("E4");
    expect(queue).toContain("F6");
    expect(queue.indexOf("D5")).toBeLessThan(queue.indexOf("E4"));
    expect(queue.indexOf("G5")).toBeLessThan(queue.indexOf("F6"));
    expect(ai.nextShot()).toEqual(expect.objectContaining({ row: 4 }));
  });

  it("extends past a run of three collinear hits rather than re-targeting between them", () => {
    const ai = new HuntTargetAI([5, 4, 3, 3, 2], seededRandom(11));
    for (const row of [3, 4, 5]) {
      ai.registerResult({ coord: { row, col: 6 }, outcome: "hit" });
    }
    const queue = ai.targetQueue.map(label);
    expect(queue.slice(0, 2).sort()).toEqual(["G3", "G7"]);
  });

  it("keeps hunting a second adjacent ship after the first one sinks", () => {
    const ai = new HuntTargetAI([3, 2], seededRandom(11));
    // Cascade lies C5-E5 horizontally; Deep Wiki lies D6-D7 vertically, touching it.
    ai.registerResult({ coord: { row: 4, col: 3 }, outcome: "hit" }); // D5, Cascade
    ai.registerResult({ coord: { row: 5, col: 3 }, outcome: "hit" }); // D6, Deep Wiki
    ai.registerResult({ coord: { row: 4, col: 2 }, outcome: "hit" }); // C5, Cascade
    ai.registerResult({ coord: { row: 4, col: 4 }, outcome: "sunk", sunkShipLength: 3 }); // E5

    // Cascade's cells are retired, but D6 is still an unresolved hit.
    expect(ai.mode).toBe("target");
    const queue = ai.targetQueue.map(label);
    expect(queue).toContain("D7");
    expect(queue).not.toContain("D5");
    expect(queue).not.toContain("C5");
    expect(queue).not.toContain("E5");
  });

  it("clears target mode when the sunk ship was the only outstanding hit", () => {
    const ai = new HuntTargetAI([3, 2], seededRandom(11));
    ai.registerResult({ coord: { row: 2, col: 2 }, outcome: "hit" });
    ai.registerResult({ coord: { row: 2, col: 3 }, outcome: "sunk", sunkShipLength: 2 });

    expect(ai.mode).toBe("hunt");
    expect(ai.targetQueue).toEqual([]);
  });

  it("requires a ship length alongside a sunk report", () => {
    const ai = new HuntTargetAI([2], seededRandom(11));
    expect(() => ai.registerResult({ coord: { row: 0, col: 0 }, outcome: "sunk" })).toThrow(
      /sunk ship's length/i,
    );
  });

  it("beats undirected random fire on average", () => {
    let aiTotal = 0;
    let randomTotal = 0;
    const games = 25;

    for (let seed = 1; seed <= games; seed += 1) {
      const random = seededRandom(seed * 613);
      const layout = randomPlacement(PLAYER_SHIPS, random);
      aiTotal += playOut(layout, random).shots;

      let board = layout;
      const order: Coord[] = [];
      for (let row = 0; row < BOARD_SIZE; row += 1) {
        for (let col = 0; col < BOARD_SIZE; col += 1) order.push({ row, col });
      }
      for (let index = order.length - 1; index > 0; index -= 1) {
        const swap = Math.floor(random() * (index + 1));
        [order[index], order[swap]] = [order[swap], order[index]];
      }
      let shots = 0;
      for (const coord of order) {
        shots += 1;
        board = fireShot(board, coord).board;
        if (board.ships.every(isSunk)) break;
      }
      randomTotal += shots;
    }

    expect(aiTotal / games).toBeLessThan(randomTotal / games);
    // A competent hunt/target AI clears the board in well under 70 shots.
    expect(aiTotal / games).toBeLessThan(70);
  });
});
