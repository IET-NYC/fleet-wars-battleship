import { describe, expect, it } from "vitest";
import { isSunk, shotsFired } from "../src/game/rules";
import { ENEMY_SHIPS, PLAYER_SHIPS } from "../src/game/theme";
import type { Coord } from "../src/game/types";
import {
  LOG_LIMIT,
  createInitialState,
  fleetReady,
  gameReducer,
  unplacedShips,
} from "../src/state/gameReducer";
import type { GameMode, GameState } from "../src/state/gameReducer";

/** Deterministic 0..1 sequence so enemy layouts are reproducible. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function placedFleet(mode: GameMode = "standard"): GameState {
  let state = createInitialState(mode);
  for (const spec of PLAYER_SHIPS) {
    state = gameReducer(state, { type: "selectShip", shipId: spec.id });
    state = gameReducer(state, {
      type: "placeSelected",
      coord: { row: PLAYER_SHIPS.indexOf(spec) * 2, col: 0 },
    });
  }
  return state;
}

function inBattle(mode: GameMode = "standard"): GameState {
  return gameReducer(placedFleet(mode), { type: "startBattle", random: seededRandom(7) });
}

/** A coordinate that is water on the enemy board, for a guaranteed miss. */
function emptyEnemyCell(state: GameState): Coord {
  for (let row = 0; row < 10; row += 1) {
    for (let col = 0; col < 10; col += 1) {
      if (!state.enemyBoard.cells[row][col].shipId) return { row, col };
    }
  }
  throw new Error("the enemy board has no empty cell");
}

function firstEnemyShipCells(state: GameState): Coord[] {
  const ship = state.enemyBoard.ships[0];
  return ship.cells;
}

describe("placement phase", () => {
  it("starts with the largest ship selected and an empty board", () => {
    const state = createInitialState();
    expect(state.phase).toBe("placement");
    expect(state.selectedShipId).toBe(PLAYER_SHIPS[0].id);
    expect(state.playerBoard.ships).toHaveLength(0);
    expect(fleetReady(state.playerBoard)).toBe(false);
  });

  it("places the selected ship and advances the selection to the next one", () => {
    const state = gameReducer(createInitialState(), {
      type: "placeSelected",
      coord: { row: 0, col: 0 },
    });
    expect(state.playerBoard.ships).toHaveLength(1);
    expect(state.selectedShipId).toBe(PLAYER_SHIPS[1].id);
  });

  it("ignores an invalid placement instead of half-applying it", () => {
    const start = gameReducer(createInitialState(), {
      type: "placeSelected",
      coord: { row: 0, col: 0 },
    });
    const overlapping = gameReducer(start, { type: "placeSelected", coord: { row: 0, col: 1 } });
    expect(overlapping).toBe(start);
    expect(overlapping.playerBoard.ships).toHaveLength(1);
  });

  it("rotates between horizontal and vertical", () => {
    const rotated = gameReducer(createInitialState(), { type: "rotate" });
    expect(rotated.orientation).toBe("vertical");
    expect(gameReducer(rotated, { type: "rotate" }).orientation).toBe("horizontal");
  });

  it("picks a placed ship back up and re-selects it", () => {
    const placed = gameReducer(createInitialState(), {
      type: "placeSelected",
      coord: { row: 0, col: 0 },
    });
    const lifted = gameReducer(placed, { type: "pickUpShip", shipId: PLAYER_SHIPS[0].id });
    expect(lifted.playerBoard.ships).toHaveLength(0);
    expect(lifted.selectedShipId).toBe(PLAYER_SHIPS[0].id);
  });

  it("auto-places only the ships still in the tray", () => {
    const one = gameReducer(createInitialState(), {
      type: "placeSelected",
      coord: { row: 0, col: 0 },
    });
    const full = gameReducer(one, { type: "autoPlace", random: seededRandom(3) });
    expect(full.playerBoard.ships).toHaveLength(PLAYER_SHIPS.length);
    expect(unplacedShips(full.playerBoard)).toHaveLength(0);
    const devin = full.playerBoard.ships.find((ship) => ship.id === PLAYER_SHIPS[0].id);
    expect(devin?.bow).toEqual({ row: 0, col: 0 });
  });

  it("clears the whole fleet", () => {
    const cleared = gameReducer(placedFleet(), { type: "clearFleet" });
    expect(cleared.playerBoard.ships).toHaveLength(0);
    expect(cleared.selectedShipId).toBe(PLAYER_SHIPS[0].id);
  });

  it("refuses to start the battle until all five ships are placed", () => {
    const partial = gameReducer(createInitialState(), {
      type: "placeSelected",
      coord: { row: 0, col: 0 },
    });
    expect(gameReducer(partial, { type: "startBattle" })).toBe(partial);

    const started = inBattle();
    expect(started.phase).toBe("playerTurn");
    expect(started.enemyBoard.ships.map((ship) => ship.name)).toEqual(
      ENEMY_SHIPS.map((spec) => spec.name),
    );
  });
});

describe("battle phase", () => {
  it("gives the player the first shot and then hands the turn to the enemy", () => {
    const state = gameReducer(inBattle(), { type: "playerFire", coord: { row: 9, col: 9 } });
    expect(state.phase).toBe("enemyTurn");
    expect(shotsFired(state.enemyBoard)).toBe(1);
  });

  it("rejects a second player shot while it is the enemy's turn", () => {
    const afterShot = gameReducer(inBattle(), { type: "playerFire", coord: { row: 9, col: 9 } });
    const again = gameReducer(afterShot, { type: "playerFire", coord: { row: 8, col: 9 } });
    expect(again).toBe(afterShot);
    expect(shotsFired(again.enemyBoard)).toBe(1);
  });

  it("ignores a duplicate shot at a cell already fired upon", () => {
    const battle = inBattle();
    const first = gameReducer(battle, { type: "playerFire", coord: { row: 9, col: 9 } });
    const enemyDone = gameReducer(first, { type: "enemyFire", coord: { row: 9, col: 9 } });
    const duplicate = gameReducer(enemyDone, { type: "playerFire", coord: { row: 9, col: 9 } });
    expect(duplicate).toBe(enemyDone);
  });

  it("logs Hit & Sunk with the ship name and keeps the newest entry first", () => {
    let state = inBattle();
    const cells = firstEnemyShipCells(state);
    for (const coord of cells) {
      state = gameReducer(state, { type: "playerFire", coord });
      if (state.phase === "enemyTurn") {
        state = { ...state, phase: "playerTurn" };
      }
    }
    const shipName = state.enemyBoard.ships[0].name;
    expect(state.log.some((entry) => entry.text.includes(`Hit & Sunk ${shipName}`))).toBe(true);
    expect(state.log[0].id).toBeGreaterThan(state.log[1].id);
    expect(state.toast?.text).toBeTruthy();
  });

  it("caps the battle log at 50 entries", () => {
    let state = inBattle();
    for (let col = 0; col < 10; col += 1) {
      for (let row = 0; row < 10 && state.phase !== "gameOver"; row += 1) {
        state = gameReducer(state, { type: "playerFire", coord: { row, col } });
        if (state.phase === "enemyTurn") state = { ...state, phase: "playerTurn" };
      }
    }
    expect(state.log.length).toBe(LOG_LIMIT);
  });

  it("keeps fleet-health counts in sync with the board as hits land", () => {
    let state = inBattle();
    const cells = firstEnemyShipCells(state);
    const target = state.enemyBoard.ships[0].id;

    state = gameReducer(state, { type: "playerFire", coord: cells[0] });
    let ship = state.enemyBoard.ships.find((candidate) => candidate.id === target);
    expect(ship?.hits).toHaveLength(1);
    expect(ship && isSunk(ship)).toBe(false);

    state = { ...state, phase: "playerTurn" };
    for (const coord of cells.slice(1)) {
      state = gameReducer(state, { type: "playerFire", coord });
      state = { ...state, phase: state.phase === "gameOver" ? "gameOver" : "playerTurn" };
    }
    ship = state.enemyBoard.ships.find((candidate) => candidate.id === target);
    expect(ship?.hits).toHaveLength(cells.length);
    expect(ship && isSunk(ship)).toBe(true);
  });

  it("ends the game the moment the last enemy ship sinks and blocks further shots", () => {
    let state = inBattle();
    for (const ship of state.enemyBoard.ships) {
      for (const coord of ship.cells) {
        if (state.phase === "gameOver") break;
        state = gameReducer(state, { type: "playerFire", coord });
        if (state.phase === "enemyTurn") state = { ...state, phase: "playerTurn" };
      }
    }
    expect(state.phase).toBe("gameOver");
    expect(state.winner).toBe("player");

    const blocked = gameReducer(state, { type: "playerFire", coord: { row: 0, col: 0 } });
    expect(blocked).toBe(state);
  });

  it("declares the enemy the winner when the player fleet is wiped out", () => {
    let state = inBattle();
    for (const ship of state.playerBoard.ships) {
      for (const coord of ship.cells) {
        if (state.phase === "gameOver") break;
        state = { ...state, phase: "enemyTurn" };
        state = gameReducer(state, { type: "enemyFire", coord });
      }
    }
    expect(state.phase).toBe("gameOver");
    expect(state.winner).toBe("enemy");
  });
});

describe("play again", () => {
  it("resets every piece of state, not just the phase", () => {
    let state = inBattle();
    state = gameReducer(state, { type: "playerFire", coord: { row: 0, col: 9 } });
    state = gameReducer(state, { type: "enemyFire", coord: { row: 0, col: 0 } });

    const fresh = gameReducer(state, { type: "reset" });
    expect(fresh).toEqual(createInitialState());
    expect(shotsFired(fresh.playerBoard)).toBe(0);
    expect(shotsFired(fresh.enemyBoard)).toBe(0);
    expect(fresh.playerBoard.ships).toHaveLength(0);
    expect(fresh.enemyBoard.ships).toHaveLength(0);
    expect(fresh.toast).toBeNull();
    expect(fresh.winner).toBeNull();
    expect(fresh.log).toHaveLength(1);
  });

  it("dismisses only the toast it was asked to dismiss", () => {
    let state = inBattle();
    const cells = firstEnemyShipCells(state);
    for (const coord of cells) {
      state = gameReducer(state, { type: "playerFire", coord });
      if (state.phase === "enemyTurn") state = { ...state, phase: "playerTurn" };
    }
    const toast = state.toast;
    expect(toast).not.toBeNull();
    expect(gameReducer(state, { type: "dismissToast", id: -1 })).toBe(state);
    expect(gameReducer(state, { type: "dismissToast", id: toast!.id }).toast).toBeNull();
  });
});

describe("shot flash", () => {
  it("announces the outcome and coordinate of each side's shot", () => {
    const battle = inBattle();
    const miss = gameReducer(battle, { type: "playerFire", coord: emptyEnemyCell(battle) });
    expect(miss.flash).toMatchObject({ attacker: "player", outcome: "miss" });
    expect(miss.flash?.label).toMatch(/^[A-J]([1-9]|10)$/);

    const hitCoord = firstEnemyShipCells(battle)[0];
    const hit = gameReducer(battle, { type: "playerFire", coord: hitCoord });
    expect(hit.flash).toMatchObject({ attacker: "player", outcome: "hit" });

    const enemyShot = gameReducer(hit, {
      type: "enemyFire",
      coord: battle.playerBoard.ships[0].cells[0],
    });
    expect(enemyShot.flash).toMatchObject({ attacker: "enemy", outcome: "hit" });
  });

  it("clears only the flash it was asked to clear", () => {
    const battle = inBattle();
    const state = gameReducer(battle, { type: "playerFire", coord: emptyEnemyCell(battle) });
    const flash = state.flash;
    expect(flash).not.toBeNull();
    expect(gameReducer(state, { type: "dismissFlash", id: -1 })).toBe(state);
    expect(gameReducer(state, { type: "dismissFlash", id: flash!.id }).flash).toBeNull();
  });
});

describe("AI difficulty", () => {
  it("defaults to medium and can only be switched during placement", () => {
    expect(createInitialState().difficulty).toBe("medium");
    const chosen = gameReducer(createInitialState(), {
      type: "setDifficulty",
      difficulty: "hard",
    });
    expect(chosen.difficulty).toBe("hard");

    const battle = inBattle();
    expect(gameReducer(battle, { type: "setDifficulty", difficulty: "easy" })).toBe(battle);
  });

  it("keeps the chosen difficulty alongside the mode across Play Again", () => {
    const chosen = gameReducer(placedFleet("op"), { type: "setDifficulty", difficulty: "easy" });
    const battle = gameReducer(chosen, { type: "startBattle", random: seededRandom(7) });
    const fresh = gameReducer(battle, { type: "reset" });
    expect(fresh).toEqual(createInitialState("op", "easy"));
  });
});

describe("OP-MODE", () => {
  it("is off by default and can only be switched during placement", () => {
    expect(createInitialState().mode).toBe("standard");
    const chosen = gameReducer(createInitialState(), { type: "setMode", mode: "op" });
    expect(chosen.mode).toBe("op");

    const battle = inBattle();
    expect(gameReducer(battle, { type: "setMode", mode: "op" })).toBe(battle);
  });

  it("grants the player another shot after a hit but not after a miss", () => {
    const battle = inBattle("op");
    const cells = firstEnemyShipCells(battle);

    const afterHit = gameReducer(battle, { type: "playerFire", coord: cells[0] });
    expect(afterHit.phase).toBe("playerTurn");
    expect(afterHit.log[0].text).toContain("Hot streak");

    // The extra shot is real: a second shot lands without an enemy turn between.
    const afterSecond = gameReducer(afterHit, { type: "playerFire", coord: cells[1] });
    expect(shotsFired(afterSecond.enemyBoard)).toBe(2);

    const afterMiss = gameReducer(battle, {
      type: "playerFire",
      coord: emptyEnemyCell(battle),
    });
    expect(afterMiss.phase).toBe("enemyTurn");
  });

  it("does not hand the enemy a free shot for its own hits", () => {
    const battle = inBattle("op");
    const enemyTurn: GameState = { ...battle, phase: "enemyTurn" };
    const state = gameReducer(enemyTurn, {
      type: "enemyFire",
      coord: battle.playerBoard.ships[0].cells[0],
    });
    expect(state.phase).toBe("playerTurn");
  });

  it("keeps the chosen mode across Play Again", () => {
    const battle = inBattle("op");
    const fresh = gameReducer(battle, { type: "reset" });
    expect(fresh.mode).toBe("op");
    expect(fresh).toEqual(createInitialState("op"));
  });

  it("still ends the game immediately on the winning shot", () => {
    let state = inBattle("op");
    for (const ship of state.enemyBoard.ships) {
      for (const coord of ship.cells) {
        if (state.phase === "gameOver") break;
        state = gameReducer(state, { type: "playerFire", coord });
        if (state.phase === "enemyTurn") state = { ...state, phase: "playerTurn" };
      }
    }
    expect(state.phase).toBe("gameOver");
    expect(state.winner).toBe("player");
  });
});

describe("placement locks during battle", () => {
  it("ignores placement actions once the battle has started", () => {
    const battle = inBattle();
    for (const action of [
      { type: "rotate" } as const,
      { type: "clearFleet" } as const,
      { type: "autoPlace" } as const,
      { type: "pickUpShip", shipId: PLAYER_SHIPS[0].id } as const,
      { type: "placeSelected", coord: { row: 5, col: 5 } } as const,
      { type: "selectShip", shipId: PLAYER_SHIPS[0].id } as const,
    ]) {
      expect(gameReducer(battle, action)).toBe(battle);
    }
  });
});
