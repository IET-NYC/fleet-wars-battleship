import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { HuntTargetAI } from "../game/ai";
import { fireShot } from "../game/rules";
import { PLAYER_SHIPS } from "../game/theme";
import type { Coord } from "../game/types";
import { createInitialState, fleetReady, gameReducer, unplacedShips } from "./gameReducer";
import type { GameMode } from "./gameReducer";
import type { AiOptions } from "../game/ai";

/** Enemy turns feel deliberate rather than instant, and lock input while pending. */
const MIN_AI_DELAY_MS = 600;
const MAX_AI_DELAY_MS = 900;
const TOAST_MS = 3600;
const FLASH_MS = 900;

/** OP-MODE hobbles the Cursor AI: no parity sweep, and it often loses the scent. */
const OP_MODE_AI: AiOptions = { useParity: false, targetChance: 0.55 };

export function useGame() {
  const [state, dispatch] = useReducer(gameReducer, undefined, createInitialState);
  const aiRef = useRef<HuntTargetAI | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  const startBattle = useCallback(() => {
    aiRef.current = new HuntTargetAI(
      PLAYER_SHIPS.map((ship) => ship.length),
      Math.random,
      stateRef.current.mode === "op" ? OP_MODE_AI : {},
    );
    dispatch({ type: "startBattle" });
  }, []);

  const reset = useCallback(() => {
    aiRef.current = null;
    dispatch({ type: "reset" });
  }, []);

  // The AI turn: resolve the shot locally so the AI can learn its own outcome,
  // then let the reducer apply the very same shot to the board.
  useEffect(() => {
    if (state.phase !== "enemyTurn") return;
    const delay = MIN_AI_DELAY_MS + Math.random() * (MAX_AI_DELAY_MS - MIN_AI_DELAY_MS);
    const timer = window.setTimeout(() => {
      const ai = aiRef.current;
      if (!ai || ai.isGameOver) return;
      const coord = ai.nextShot();
      const result = fireShot(stateRef.current.playerBoard, coord);
      const sunkShip =
        result.shot.outcome === "sunk"
          ? result.board.ships.find((ship) => ship.id === result.shot.shipId)
          : undefined;
      ai.registerResult(
        { coord, outcome: result.shot.outcome, sunkShipLength: sunkShip?.length },
        result.allSunk,
      );
      dispatch({ type: "enemyFire", coord });
    }, delay);
    return () => window.clearTimeout(timer);
  }, [state.phase]);

  const flashId = state.flash?.id;
  useEffect(() => {
    if (flashId === undefined) return;
    const timer = window.setTimeout(() => dispatch({ type: "dismissFlash", id: flashId }), FLASH_MS);
    return () => window.clearTimeout(timer);
  }, [flashId]);

  const toastId = state.toast?.id;
  useEffect(() => {
    if (toastId === undefined) return;
    const timer = window.setTimeout(() => dispatch({ type: "dismissToast", id: toastId }), TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [toastId]);

  // R rotates during placement, matching the on-screen Rotate button.
  useEffect(() => {
    if (state.phase !== "placement") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "r" && event.key !== "R") return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      dispatch({ type: "rotate" });
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [state.phase]);

  const actions = useMemo(
    () => ({
      selectShip: (shipId: string | null) => dispatch({ type: "selectShip", shipId }),
      rotate: () => dispatch({ type: "rotate" }),
      placeSelected: (coord: Coord) => dispatch({ type: "placeSelected", coord }),
      pickUpShip: (shipId: string) => dispatch({ type: "pickUpShip", shipId }),
      autoPlace: () => dispatch({ type: "autoPlace" }),
      clearFleet: () => dispatch({ type: "clearFleet" }),
      fireAt: (coord: Coord) => dispatch({ type: "playerFire", coord }),
      dismissToast: (id: number) => dispatch({ type: "dismissToast", id }),
      setMode: (mode: GameMode) => dispatch({ type: "setMode", mode }),
      startBattle,
      reset,
    }),
    [reset, startBattle],
  );

  return {
    state,
    actions,
    /** Player input is only live on the player's own turn. */
    canFire: state.phase === "playerTurn",
    isEnemyThinking: state.phase === "enemyTurn",
    readyToStart: fleetReady(state.playerBoard),
    tray: unplacedShips(state.playerBoard),
  };
}
