import { describe, expect, it } from "vitest";
import { HuntTargetAI } from "../src/game/ai";
import { randomPlacement } from "../src/game/board";
import { accuracy, allSunk, alreadyFired, coordKey, fireShot, shotsFired } from "../src/game/rules";
import { PLAYER_SHIPS } from "../src/game/theme";
import { BOARD_SIZE } from "../src/game/types";
import type { Coord } from "../src/game/types";
import { LOG_LIMIT, createInitialState, gameReducer } from "../src/state/gameReducer";
import type { GameMode, GameState } from "../src/state/gameReducer";

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function shuffledBoardOrder(random: () => number): Coord[] {
  const cells: Coord[] = [];
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) cells.push({ row, col });
  }
  for (let index = cells.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [cells[index], cells[swap]] = [cells[swap], cells[index]];
  }
  return cells;
}

/**
 * Plays a whole game through the reducer: the "player" fires in a shuffled order
 * and the enemy fires through the real AI, exactly as `useGame` drives it.
 */
function playFullGame(seed: number, mode: GameMode = "standard") {
  const random = seededRandom(seed);
  let state: GameState = createInitialState(mode);
  state = gameReducer(state, { type: "autoPlace", random });
  state = gameReducer(state, { type: "startBattle", random });

  const ai = new HuntTargetAI(
    PLAYER_SHIPS.map((ship) => ship.length),
    random,
  );
  const playerOrder = shuffledBoardOrder(random);
  const playerSeen = new Set<string>();
  const enemySeen = new Set<string>();
  let turns = 0;

  while (state.phase !== "gameOver") {
    turns += 1;
    if (turns > BOARD_SIZE * BOARD_SIZE * 2) throw new Error("game failed to terminate");

    if (state.phase === "playerTurn") {
      const coord = playerOrder.shift();
      if (!coord) throw new Error("player ran out of cells before the game ended");
      expect(playerSeen.has(coordKey(coord))).toBe(false);
      expect(alreadyFired(state.enemyBoard, coord)).toBe(false);
      playerSeen.add(coordKey(coord));
      state = gameReducer(state, { type: "playerFire", coord });
      continue;
    }

    const coord = ai.nextShot();
    expect(enemySeen.has(coordKey(coord))).toBe(false);
    expect(alreadyFired(state.playerBoard, coord)).toBe(false);
    enemySeen.add(coordKey(coord));

    const preview = fireShot(state.playerBoard, coord);
    const sunkShip =
      preview.shot.outcome === "sunk"
        ? preview.board.ships.find((ship) => ship.id === preview.shot.shipId)
        : undefined;
    ai.registerResult(
      { coord, outcome: preview.shot.outcome, sunkShipLength: sunkShip?.length },
      preview.allSunk,
    );
    state = gameReducer(state, { type: "enemyFire", coord });
  }

  return { state, ai, enemyShots: enemySeen.size, playerShots: playerSeen.size };
}

describe("full-game stress", () => {
  it("terminates with exactly one winner and consistent boards across 60 games", () => {
    for (let seed = 1; seed <= 60; seed += 1) {
      const { state, ai } = playFullGame(seed * 7919);

      expect(state.phase).toBe("gameOver");
      expect(state.winner).not.toBeNull();
      // Exactly one fleet is wiped out — never both.
      expect(allSunk(state.enemyBoard)).toBe(state.winner === "player");
      expect(allSunk(state.playerBoard)).toBe(state.winner === "enemy");
      expect(ai.isGameOver).toBe(state.winner === "enemy");

      expect(shotsFired(state.enemyBoard)).toBeLessThanOrEqual(BOARD_SIZE * BOARD_SIZE);
      expect(shotsFired(state.playerBoard)).toBeLessThanOrEqual(BOARD_SIZE * BOARD_SIZE);
      expect(accuracy(state.enemyBoard)).toBeLessThanOrEqual(100);
      expect(accuracy(state.playerBoard)).toBeLessThanOrEqual(100);
      expect(state.log.length).toBeLessThanOrEqual(LOG_LIMIT);
    }
  });

  it("keeps the player at most one shot ahead of the enemy", () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const { state, playerShots, enemyShots } = playFullGame(seed * 104729);
      const lead = playerShots - enemyShots;
      expect(lead === 0 || lead === 1).toBe(true);
      expect(shotsFired(state.enemyBoard)).toBe(playerShots);
      expect(shotsFired(state.playerBoard)).toBe(enemyShots);
    }
  });

  it("never leaves a ship overlapping or off-board across 500 random fleets", () => {
    for (let seed = 1; seed <= 500; seed += 1) {
      const board = randomPlacement(PLAYER_SHIPS, seededRandom(seed * 2654435761));
      const occupied = new Set<string>();
      for (const ship of board.ships) {
        expect(ship.cells).toHaveLength(ship.length);
        for (const cell of ship.cells) {
          expect(cell.row).toBeGreaterThanOrEqual(0);
          expect(cell.row).toBeLessThan(BOARD_SIZE);
          expect(cell.col).toBeGreaterThanOrEqual(0);
          expect(cell.col).toBeLessThan(BOARD_SIZE);
          expect(occupied.has(coordKey(cell))).toBe(false);
          occupied.add(coordKey(cell));
        }
      }
      expect(occupied.size).toBe(PLAYER_SHIPS.reduce((total, s) => total + s.length, 0));
    }
  });

  it("terminates in OP-MODE too, with the player taking the extra shots", () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const { state, playerShots, enemyShots } = playFullGame(seed * 15485863, "op");
      expect(state.phase).toBe("gameOver");
      expect(state.mode).toBe("op");
      expect(playerShots).toBeGreaterThanOrEqual(enemyShots);
      expect(allSunk(state.enemyBoard)).toBe(state.winner === "player");
      expect(allSunk(state.playerBoard)).toBe(state.winner === "enemy");
    }
  });

  it("resets cleanly after a finished game, so a rematch is a fresh board", () => {
    const { state } = playFullGame(31337);
    const fresh = gameReducer(state, { type: "reset" });
    const replayed = gameReducer(
      gameReducer(fresh, { type: "autoPlace", random: seededRandom(5) }),
      { type: "startBattle", random: seededRandom(5) },
    );
    expect(shotsFired(replayed.playerBoard)).toBe(0);
    expect(shotsFired(replayed.enemyBoard)).toBe(0);
    expect(replayed.phase).toBe("playerTurn");
  });
});
