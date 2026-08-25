import { clearShips, createBoard, placeShip, randomPlacement, removeShip } from "../game/board";
import { alreadyFired, coordLabel, fireShot } from "../game/rules";
import { ENEMY_SHIPS, PLAYER_SHIPS, flavorFor } from "../game/theme";
import type {
  Board,
  Coord,
  Orientation,
  Ship,
  ShipSpec,
  ShotOutcome,
  Side,
} from "../game/types";

export type Phase = "placement" | "playerTurn" | "enemyTurn" | "gameOver";

/**
 * `standard` is even-handed Battleship. `op` skews everything towards the
 * Cognition Fleet: the player keeps firing while they keep hitting, and the
 * Cursor AI gives up its parity search and often wanders off a known hit.
 */
export type GameMode = "standard" | "op";

/** A shot worth announcing on screen — drives the DIRECT HIT / MISS flash. */
export interface ShotFlash {
  id: number;
  attacker: Side;
  outcome: ShotOutcome;
  label: string;
}

export interface LogEntry {
  id: number;
  /** Who acted; `system` covers setup and end-of-game lines. */
  source: Side | "system";
  text: string;
}

export interface GameState {
  phase: Phase;
  /** Player fleet. The AI fires at this board. */
  playerBoard: Board;
  /** Enemy fleet. The player fires at this board. */
  enemyBoard: Board;
  selectedShipId: string | null;
  orientation: Orientation;
  log: LogEntry[];
  toast: { id: number; text: string } | null;
  flash: ShotFlash | null;
  mode: GameMode;
  winner: Side | null;
  nextId: number;
}

export type GameAction =
  | { type: "selectShip"; shipId: string | null }
  | { type: "rotate" }
  | { type: "placeSelected"; coord: Coord }
  | { type: "pickUpShip"; shipId: string }
  | { type: "autoPlace"; random?: () => number }
  | { type: "clearFleet" }
  | { type: "startBattle"; random?: () => number }
  | { type: "playerFire"; coord: Coord }
  | { type: "enemyFire"; coord: Coord }
  | { type: "dismissToast"; id: number }
  | { type: "dismissFlash"; id: number }
  | { type: "setMode"; mode: GameMode }
  | { type: "reset" };

export const LOG_LIMIT = 50;

export function createInitialState(mode: GameMode = "standard"): GameState {
  return {
    phase: "placement",
    playerBoard: createBoard(),
    enemyBoard: createBoard(),
    selectedShipId: PLAYER_SHIPS[0].id,
    orientation: "horizontal",
    log: [
      {
        id: 0,
        source: "system",
        text: "Deploy your fleet. Click a cell to drop a bow, press R to rotate.",
      },
    ],
    toast: null,
    flash: null,
    mode,
    winner: null,
    nextId: 1,
  };
}

export function unplacedShips(board: Board): ShipSpec[] {
  return PLAYER_SHIPS.filter((spec) => !board.ships.some((ship) => ship.id === spec.id));
}

export function fleetReady(board: Board): boolean {
  return unplacedShips(board).length === 0;
}

export function shipAt(board: Board, { row, col }: Coord): Ship | undefined {
  const shipId = board.cells[row][col].shipId;
  if (!shipId) return undefined;
  return board.ships.find((ship) => ship.id === shipId);
}

function withLog(state: GameState, entries: Omit<LogEntry, "id">[]): GameState {
  let nextId = state.nextId;
  const added = entries.map((entry) => ({ ...entry, id: nextId++ }));
  return {
    ...state,
    nextId,
    log: [...added.reverse(), ...state.log].slice(0, LOG_LIMIT),
  };
}

function withToast(state: GameState, text: string): GameState {
  return { ...state, toast: { id: state.nextId, text }, nextId: state.nextId + 1 };
}

/** Selects the first ship still in the tray, or nothing when the fleet is full. */
function autoSelect(board: Board): string | null {
  return unplacedShips(board)[0]?.id ?? null;
}

function resolveShot(
  state: GameState,
  attacker: Side,
  coord: Coord,
  random: () => number,
): GameState {
  const targetBoard = attacker === "player" ? state.enemyBoard : state.playerBoard;
  if (alreadyFired(targetBoard, coord)) return state;

  const result = fireShot(targetBoard, coord);
  const defender: Side = attacker === "player" ? "enemy" : "player";
  const label = coordLabel(coord);
  const who = attacker === "player" ? "You fire" : "Cursor Fleet fires";
  const shipName = result.shot.shipName;

  let headline: string;
  if (result.shot.outcome === "miss") headline = `${who} at ${label} — Miss.`;
  else if (result.shot.outcome === "hit") headline = `${who} at ${label} — Hit.`;
  else headline = `${who} at ${label} — Hit & Sunk ${shipName ?? "ship"}.`;

  const flavor =
    result.shot.outcome === "sunk" && shipName
      ? flavorFor({ kind: "shipSunk", side: defender, shipName }, random)
      : result.shot.outcome === "hit" && shipName
        ? flavorFor({ kind: "hit", side: defender, shipName }, random)
        : flavorFor({ kind: "miss", side: defender, coord: label }, random);

  let next: GameState =
    attacker === "player"
      ? { ...state, enemyBoard: result.board }
      : { ...state, playerBoard: result.board };

  next = {
    ...next,
    flash: { id: next.nextId, attacker, outcome: result.shot.outcome, label },
    nextId: next.nextId + 1,
  };

  next = withLog(next, [
    { source: attacker, text: headline },
    { source: attacker, text: flavor },
  ]);

  if (result.shot.outcome === "sunk") next = withToast(next, flavor);

  if (result.allSunk) {
    const won = attacker === "player";
    const closing = flavorFor({ kind: won ? "win" : "loss" }, random);
    next = withLog({ ...next, phase: "gameOver", winner: attacker }, [
      { source: "system", text: closing },
    ]);
    return withToast(next, closing);
  }

  // OP-MODE: landing a hit buys the player another shot straight away.
  if (state.mode === "op" && attacker === "player" && result.shot.outcome !== "miss") {
    return withLog({ ...next, phase: "playerTurn" }, [
      { source: "system", text: "Hot streak — fire again." },
    ]);
  }

  return { ...next, phase: attacker === "player" ? "enemyTurn" : "playerTurn" };
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "selectShip": {
      if (state.phase !== "placement") return state;
      return { ...state, selectedShipId: action.shipId };
    }

    case "rotate": {
      if (state.phase !== "placement") return state;
      return {
        ...state,
        orientation: state.orientation === "horizontal" ? "vertical" : "horizontal",
      };
    }

    case "placeSelected": {
      if (state.phase !== "placement" || !state.selectedShipId) return state;
      const spec = PLAYER_SHIPS.find((candidate) => candidate.id === state.selectedShipId);
      if (!spec) return state;
      const board = placeShip(state.playerBoard, spec, action.coord, state.orientation);
      if (!board) return state;
      return { ...state, playerBoard: board, selectedShipId: autoSelect(board) };
    }

    case "pickUpShip": {
      if (state.phase !== "placement") return state;
      const board = removeShip(state.playerBoard, action.shipId);
      return { ...state, playerBoard: board, selectedShipId: action.shipId };
    }

    case "autoPlace": {
      if (state.phase !== "placement") return state;
      const board = randomPlacement(
        unplacedShips(state.playerBoard),
        action.random ?? Math.random,
        state.playerBoard,
      );
      return { ...state, playerBoard: board, selectedShipId: autoSelect(board) };
    }

    case "clearFleet": {
      if (state.phase !== "placement") return state;
      const board = clearShips(state.playerBoard);
      return { ...state, playerBoard: board, selectedShipId: autoSelect(board) };
    }

    case "startBattle": {
      if (state.phase !== "placement" || !fleetReady(state.playerBoard)) return state;
      const random = action.random ?? Math.random;
      const next: GameState = {
        ...state,
        phase: "playerTurn",
        enemyBoard: randomPlacement(ENEMY_SHIPS, random),
        selectedShipId: null,
      };
      return withLog(next, [
        { source: "system", text: "Cursor Fleet has deployed. You have the first shot." },
      ]);
    }

    case "playerFire": {
      if (state.phase !== "playerTurn") return state;
      return resolveShot(state, "player", action.coord, Math.random);
    }

    case "enemyFire": {
      if (state.phase !== "enemyTurn") return state;
      return resolveShot(state, "enemy", action.coord, Math.random);
    }

    case "dismissToast": {
      if (state.toast?.id !== action.id) return state;
      return { ...state, toast: null };
    }

    case "dismissFlash": {
      if (state.flash?.id !== action.id) return state;
      return { ...state, flash: null };
    }

    case "setMode": {
      if (state.phase !== "placement") return state;
      return { ...state, mode: action.mode };
    }

    case "reset":
      // A rematch keeps the mode the player chose.
      return createInitialState(state.mode);

    default:
      return state;
  }
}
