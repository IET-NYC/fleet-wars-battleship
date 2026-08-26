import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../src/App";
import GameOverPanel from "../src/components/GameOverPanel";
import Toast from "../src/components/Toast";
import { createBoard, placeShip } from "../src/game/board";
import { fireShot } from "../src/game/rules";
import type { Board } from "../src/game/types";

/** Deploys the whole fleet and starts the battle, leaving the player to fire. */
function startBattle() {
  fireEvent.click(screen.getByRole("button", { name: "Auto-place" }));
  fireEvent.click(screen.getByRole("button", { name: "Start Battle" }));
}

function targetGrid(): HTMLElement {
  return screen.getByRole("region", { name: /Cursor Fleet/i });
}

function cell(grid: HTMLElement, label: string): HTMLElement {
  return within(grid).getByRole("button", { name: new RegExp(`^${label} `) });
}

describe("App placement screen", () => {
  it("renders the fleet tray, mode and difficulty controls", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "Deploy Fleet" })).toBeTruthy();
    expect(screen.getByText("0/5 placed")).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Devin/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Standard" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(screen.getByRole("button", { name: "Medium" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(screen.getByText("Deploy your fleet.")).toBeTruthy();
  });

  it("selecting a difficulty updates the pressed state, blurb and header badge", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Hard" }));

    expect(screen.getByRole("button", { name: "Hard" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Medium" }).getAttribute("aria-pressed")).toBe(
      "false",
    );
    expect(screen.getByText(/sweeps by parity/i)).toBeTruthy();
    expect(screen.getByText("hard AI")).toBeTruthy();
  });

  it("switching to OP-Mode shows the OP-Mode badge", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "OP-Mode" }));

    expect(screen.getByText(/OP-Mode · Cognition favoured/)).toBeTruthy();
  });

  it("focusing a cell previews the selected ship without a mouse", () => {
    render(<App />);
    const ownGrid = screen.getByRole("region", { name: /Cognition Fleet/i });

    fireEvent.focus(cell(ownGrid, "A1"));

    // Devin is length 5, so A1..E1 preview horizontally.
    const previewed = ["A1", "B1", "C1", "D1", "E1"].map((label) => cell(ownGrid, label));
    for (const button of previewed) {
      expect(button.className).toContain("outline-cognition-bright/80");
    }

    fireEvent.blur(previewed[0]);
    expect(cell(ownGrid, "B1").className).not.toContain("outline-cognition-bright/80");
  });

  it("auto-place then Start Battle moves the game to the player's turn", () => {
    render(<App />);

    expect(screen.getByRole("button", { name: "Start Battle" }).hasAttribute("disabled")).toBe(true);
    startBattle();

    expect(screen.getByText("Your turn. Pick a target.")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Deploy Fleet" })).toBeNull();
  });
});

describe("App battle screen", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("firing marks the cell and logs the shot, then hands over to the enemy", async () => {
    render(<App />);
    startBattle();
    const grid = targetGrid();

    fireEvent.click(cell(grid, "A1"));

    await waitFor(() => {
      expect(cell(grid, "A1").getAttribute("aria-label")).toMatch(/A1 (miss|hit|sunk)/);
    });
    expect(screen.getByRole("list", { name: /battle log/i }).textContent).toContain("You fire at A1");
  });

  it("keeps target cells reachable but inert while the enemy is thinking", async () => {
    render(<App />);
    startBattle();
    const grid = targetGrid();

    fireEvent.click(cell(grid, "A1"));
    await waitFor(() => expect(screen.getByText("Enemy is thinking…")).toBeTruthy());

    const b1 = cell(grid, "B1");
    expect(b1.hasAttribute("disabled")).toBe(false);
    expect(b1.getAttribute("aria-disabled")).toBe("true");

    fireEvent.click(b1);
    expect(b1.getAttribute("aria-label")).toBe("B1 empty");
  });

  it("ignores a second shot at the same cell", async () => {
    render(<App />);
    startBattle();
    const grid = targetGrid();

    fireEvent.click(cell(grid, "C3"));
    const resolved = await waitFor(() => {
      const label = cell(grid, "C3").getAttribute("aria-label");
      expect(label).toMatch(/C3 (miss|hit|sunk)/);
      return label;
    });

    fireEvent.click(cell(grid, "C3"));
    expect(cell(grid, "C3").getAttribute("aria-label")).toBe(resolved);
  });
});

/** A board with a single two-cell ship, both cells hit, i.e. a wiped-out fleet. */
function sunkFleetBoard(): Board {
  const placed = placeShip(
    createBoard(),
    { id: "deep-wiki", name: "Deep Wiki", length: 2 },
    { row: 0, col: 0 },
    "horizontal",
  );
  if (!placed) throw new Error("fixture placement should be valid");
  let board = fireShot(placed, { row: 0, col: 0 }).board;
  board = fireShot(board, { row: 0, col: 1 }).board;
  return board;
}

describe("GameOverPanel", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("arms Play Again after the guard window and moves focus onto it", () => {
    const onPlayAgain = vi.fn();
    render(
      <GameOverPanel
        winner="player"
        enemyBoard={sunkFleetBoard()}
        playerBoard={createBoard()}
        onPlayAgain={onPlayAgain}
      />,
    );

    const dialog = screen.getByRole("dialog", { name: "Victory" });
    const playAgain = screen.getByRole("button", { name: "Play Again" });
    expect(playAgain.hasAttribute("disabled")).toBe(true);
    expect(document.activeElement).toBe(dialog);

    fireEvent.click(playAgain);
    expect(onPlayAgain).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(playAgain.hasAttribute("disabled")).toBe(false);
    expect(document.activeElement).toBe(playAgain);

    fireEvent.click(playAgain);
    expect(onPlayAgain).toHaveBeenCalledTimes(1);
  });

  it("Escape plays again once armed, and Tab cannot leave the dialog", () => {
    const onPlayAgain = vi.fn();
    render(
      <GameOverPanel
        winner="enemy"
        enemyBoard={createBoard()}
        playerBoard={sunkFleetBoard()}
        onPlayAgain={onPlayAgain}
      />,
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onPlayAgain).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(600);
    });

    fireEvent.keyDown(window, { key: "Tab" });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Play Again" }));

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onPlayAgain).toHaveBeenCalledTimes(1);
  });
});

describe("Toast", () => {
  it("announces through a status region and keeps the button's own semantics", () => {
    const onDismiss = vi.fn();
    render(<Toast text="Deep Wiki is on the seabed." onDismiss={onDismiss} />);

    const status = screen.getByRole("status");
    expect(status.textContent).toContain("Deep Wiki is on the seabed.");

    const button = screen.getByRole("button", { name: /Dismiss: Deep Wiki/ });
    expect(status.contains(button)).toBe(true);

    fireEvent.click(button);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
