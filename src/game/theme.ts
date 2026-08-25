import type { ShipSpec, Side } from "./types";

export const PLAYER_FLEET_NAME = "Cognition Fleet";
export const ENEMY_FLEET_NAME = "Cursor Fleet";

export const PLAYER_SHIPS: ShipSpec[] = [
  { id: "devin", name: "Devin", length: 5 },
  { id: "windsurf", name: "Windsurf", length: 4 },
  { id: "swe-1", name: "SWE-1", length: 3 },
  { id: "cascade", name: "Cascade", length: 3 },
  { id: "deep-wiki", name: "Deep Wiki", length: 2 },
];

export const ENEMY_SHIPS: ShipSpec[] = [
  { id: "composer", name: "Composer", length: 5 },
  { id: "cursor-tab", name: "Cursor Tab", length: 4 },
  { id: "bugbot", name: "Bugbot", length: 3 },
  { id: "agent-mode", name: "Agent Mode", length: 3 },
  { id: "autocomplete", name: "Autocomplete", length: 2 },
];

export function fleetFor(side: Side): ShipSpec[] {
  return side === "player" ? PLAYER_SHIPS : ENEMY_SHIPS;
}

export function fleetNameFor(side: Side): string {
  return side === "player" ? PLAYER_FLEET_NAME : ENEMY_FLEET_NAME;
}

const ENEMY_SHIP_SUNK: string[] = [
  "{ship} has been sunk. Guess it couldn't autocomplete its way out of that one.",
  "{ship} is going down with an unsaved buffer.",
  "{ship} sank without ever finishing its diff.",
  "{ship} has been refactored into the seabed.",
  "{ship} requested one more suggestion. The ocean declined.",
];

const PLAYER_SHIP_SUNK: string[] = [
  "{ship} has been sunk. Time to spin up a new session.",
  "{ship} is lost. Escalating to the rest of the fleet.",
  "{ship} went down mid-task. Context lost.",
  "{ship} has sunk — checkpoint was not saved.",
  "{ship} is gone. The Cursor Fleet is taking notes.",
];

const ENEMY_HIT_PLAYER: string[] = [
  "Direct hit on {ship}. Rerouting through Cascade.",
  "{ship} is taking water. Patch incoming.",
  "Hull breach on {ship}. Somebody rerun the tests.",
  "{ship} took a clean hit. Not ideal.",
  "{ship} is smoking. Still floating, still shipping.",
];

const PLAYER_HIT_ENEMY: string[] = [
  "Hit on {ship}. Its tab completion did not see that coming.",
  "{ship} is breached. That's one failing assertion.",
  "Solid hit on {ship}. Suggest it accept the change.",
  "{ship} is leaking. No linter will save it.",
  "{ship} caught that one head-on.",
];

const PLAYER_MISS: string[] = [
  "Miss. Open water at {coord}.",
  "Nothing at {coord}. Adjusting the search space.",
  "{coord} is empty ocean. Try the parity cells.",
  "Splash at {coord}. No contact.",
  "Miss at {coord}. Even good agents guess wrong.",
];

const ENEMY_MISS: string[] = [
  "Cursor fired at {coord} and hit nothing.",
  "{coord}: splash. The Cursor Fleet is guessing.",
  "Cursor wasted a shot on {coord}.",
  "{coord} is clear. Their heuristic is off.",
  "Cursor missed at {coord}. Hallucinated a target.",
];

const PLAYER_WIN: string[] = [
  "The Cursor Fleet has been refactored out of existence. Cognition wins.",
  "Every Cursor ship is on the seabed. Merged and shipped.",
  "Cursor Fleet: sunk. That's a clean green build.",
  "The Cursor Fleet has been fully deprecated. Cognition wins.",
  "All five enemy hulls are down. Closing the PR.",
];

const PLAYER_LOSS: string[] = [
  "The Cognition Fleet is lost. Time to spin up a new session.",
  "Fleet sunk. Rolling back to the last good checkpoint.",
  "Cursor took the sea this round. Rematch?",
  "Every Cognition hull is down. Reverting the merge.",
  "The Cursor Fleet held the line. This one goes in the bug log.",
];

export type FlavorEvent =
  | { kind: "shipSunk"; side: Side; shipName: string }
  | { kind: "hit"; side: Side; shipName: string }
  | { kind: "miss"; side: Side; coord: string }
  | { kind: "win" }
  | { kind: "loss" };

function pick(lines: string[], random: () => number): string {
  return lines[Math.floor(random() * lines.length)] ?? lines[0];
}

/**
 * Flavor line for an event. `side` is the *owner* of the affected ship, so
 * `{ kind: "hit", side: "player" }` means the enemy hit one of your ships.
 */
export function flavorFor(event: FlavorEvent, random: () => number = Math.random): string {
  switch (event.kind) {
    case "shipSunk":
      return pick(event.side === "enemy" ? ENEMY_SHIP_SUNK : PLAYER_SHIP_SUNK, random).replace(
        "{ship}",
        event.shipName,
      );
    case "hit":
      return pick(event.side === "enemy" ? PLAYER_HIT_ENEMY : ENEMY_HIT_PLAYER, random).replace(
        "{ship}",
        event.shipName,
      );
    case "miss":
      return pick(event.side === "enemy" ? PLAYER_MISS : ENEMY_MISS, random).replace(
        "{coord}",
        event.coord,
      );
    case "win":
      return pick(PLAYER_WIN, random);
    case "loss":
      return pick(PLAYER_LOSS, random);
  }
}
