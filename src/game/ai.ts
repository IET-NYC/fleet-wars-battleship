import { BOARD_SIZE } from "./types";
import type { Coord, ShotOutcome } from "./types";

/**
 * Pure hunt/target Battleship AI with parity. Deliberately free of React and of
 * the `Board` type: the AI only ever learns what a real opponent would learn —
 * the outcome of its own shots — so it can never peek at ship positions.
 */

interface TargetCandidate {
  coord: Coord;
  /** Higher fires first. Line extensions outrank plain neighbours. */
  priority: number;
}

function key({ row, col }: Coord): string {
  return `${row},${col}`;
}

function onBoard({ row, col }: Coord): boolean {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

function isParity({ row, col }: Coord): boolean {
  return (row + col) % 2 === 0;
}

export interface AiShotReport {
  coord: Coord;
  outcome: ShotOutcome;
  /** Length of the ship that just sank; required when `outcome` is `"sunk"`. */
  sunkShipLength?: number;
}

export class HuntTargetAI {
  private readonly fired = new Set<string>();
  /** Hits not yet attributed to a sunk ship — these drive target mode. */
  private activeHits: Coord[] = [];
  private remainingShipLengths: number[];
  private gameOver = false;
  private readonly random: () => number;

  constructor(shipLengths: number[], random: () => number = Math.random) {
    this.remainingShipLengths = [...shipLengths];
    this.random = random;
  }

  get mode(): "hunt" | "target" {
    return this.activeHits.length > 0 ? "target" : "hunt";
  }

  get isGameOver(): boolean {
    return this.gameOver;
  }

  hasFiredAt(coord: Coord): boolean {
    return this.fired.has(key(coord));
  }

  /** Cells the AI would consider next, highest priority first. Exposed for tests. */
  get targetQueue(): Coord[] {
    return this.buildTargets().map((candidate) => candidate.coord);
  }

  /**
   * Picks the next cell to fire at. Guaranteed to be on-board and never
   * previously fired at. Throws once the game is over rather than returning a
   * dummy coordinate, so a caller that forgets to stop is caught immediately.
   */
  nextShot(): Coord {
    if (this.gameOver) {
      throw new Error("AI cannot fire after the game is over");
    }

    const targets = this.buildTargets();
    if (targets.length > 0) {
      return targets[0].coord;
    }

    const candidates = this.huntCandidates();
    if (candidates.length === 0) {
      throw new Error("AI has no cells left to fire at");
    }
    return candidates[Math.floor(this.random() * candidates.length)];
  }

  /**
   * Feeds the outcome of the AI's shot back in. `gameOver` should be true when
   * that shot sank the player's last ship.
   */
  registerResult(report: AiShotReport, gameOver = false): void {
    this.fired.add(key(report.coord));

    if (report.outcome === "hit") {
      this.activeHits.push(report.coord);
    } else if (report.outcome === "sunk") {
      const length = report.sunkShipLength;
      if (length === undefined) {
        throw new Error("A sunk report must include the sunk ship's length");
      }
      this.activeHits.push(report.coord);
      this.retireSunkShip(report.coord, length);
      this.dropShipLength(length);
    }

    if (gameOver) {
      this.gameOver = true;
    }
  }

  /**
   * Removes the hits belonging to the ship that just sank, keeping hits that
   * belong to a *different* still-floating ship. This is the adjacent-ships
   * case: an L-shaped hit cluster where only one arm sank must leave the other
   * arm on the stack.
   */
  private retireSunkShip(sunkAt: Coord, length: number): void {
    const active = new Set(this.activeHits.map(key));
    const windows = [
      ...this.sunkWindows(sunkAt, length, active, { row: 0, col: 1 }),
      ...this.sunkWindows(sunkAt, length, active, { row: 1, col: 0 }),
    ];
    // Prefer a footprint whose ends are capped by non-hits: a run of hits longer
    // than the sunk ship means a second ship is touching it, and only the capped
    // window can be the ship that actually went down.
    windows.sort((a, b) => b.score - a.score);

    const sunkKeys = new Set((windows[0]?.cells ?? [sunkAt]).map(key));
    sunkKeys.add(key(sunkAt));
    this.activeHits = this.activeHits.filter((coord) => !sunkKeys.has(key(coord)));
  }

  /**
   * Every length-`length` run of hit cells along `step` that contains `sunkAt`.
   * `score` counts how many of the run's two ends are capped by a cell that is
   * not an outstanding hit (off-board counts as capped).
   */
  private sunkWindows(
    sunkAt: Coord,
    length: number,
    active: Set<string>,
    step: Coord,
  ): { cells: Coord[]; score: number }[] {
    const at = (offset: number): Coord => ({
      row: sunkAt.row + step.row * offset,
      col: sunkAt.col + step.col * offset,
    });
    const isHit = (coord: Coord) => onBoard(coord) && active.has(key(coord));
    const windows: { cells: Coord[]; score: number }[] = [];

    for (let back = 0; back < Math.max(length, 1); back += 1) {
      const cells: Coord[] = [];
      for (let index = 0; index < Math.max(length, 1); index += 1) {
        cells.push(at(index - back));
      }
      if (!cells.every(isHit)) continue;
      const before = at(-back - 1);
      const after = at(length - back);
      windows.push({ cells, score: (isHit(before) ? 0 : 1) + (isHit(after) ? 0 : 1) });
    }

    return windows;
  }

  private dropShipLength(length: number): void {
    const index = this.remainingShipLengths.indexOf(length);
    if (index >= 0) {
      this.remainingShipLengths.splice(index, 1);
    }
  }

  /**
   * Builds the target list from outstanding hits. Two hits in a line promote the
   * cells that extend that line — in both directions — above the perpendicular
   * neighbours of either hit.
   */
  private buildTargets(): TargetCandidate[] {
    const active = new Set(this.activeHits.map(key));
    const byKey = new Map<string, TargetCandidate>();

    const add = (coord: Coord, priority: number) => {
      if (!onBoard(coord) || this.fired.has(key(coord))) return;
      const existing = byKey.get(key(coord));
      if (!existing || existing.priority < priority) {
        byKey.set(key(coord), { coord, priority });
      }
    };

    for (const hit of this.activeHits) {
      for (const axis of ["row", "col"] as const) {
        const step: Coord = axis === "row" ? { row: 0, col: 1 } : { row: 1, col: 0 };
        const neighbourA: Coord = { row: hit.row - step.row, col: hit.col - step.col };
        const neighbourB: Coord = { row: hit.row + step.row, col: hit.col + step.col };
        const inLine = active.has(key(neighbourA)) || active.has(key(neighbourB));

        if (!inLine) {
          add(neighbourA, 1);
          add(neighbourB, 1);
          continue;
        }

        // Walk to both ends of the contiguous run of hits along this axis and
        // target the first unfired cell past each end.
        for (const direction of [-1, 1]) {
          let cursor: Coord = hit;
          for (;;) {
            const next: Coord = {
              row: cursor.row + direction * step.row,
              col: cursor.col + direction * step.col,
            };
            if (!onBoard(next) || !active.has(key(next))) {
              add(next, 10);
              break;
            }
            cursor = next;
          }
        }
      }
    }

    return [...byKey.values()].sort((a, b) => b.priority - a.priority);
  }

  private get smallestRemainingLength(): number {
    return this.remainingShipLengths.length > 0 ? Math.min(...this.remainingShipLengths) : 2;
  }

  /**
   * Hunt cells: unfired parity cells that could still hide the smallest
   * remaining ship. Falls back to any unfired cell once the parity pattern can
   * no longer accommodate that ship — the classic parity trap where a length-2
   * ship sits entirely on off-parity cells.
   */
  private huntCandidates(): Coord[] {
    const unfired: Coord[] = [];
    for (let row = 0; row < BOARD_SIZE; row += 1) {
      for (let col = 0; col < BOARD_SIZE; col += 1) {
        if (!this.fired.has(key({ row, col }))) unfired.push({ row, col });
      }
    }
    if (unfired.length === 0) return [];

    const length = this.smallestRemainingLength;
    const viable = unfired.filter((coord) => this.canHideShip(coord, length));
    const parityViable = viable.filter(isParity);

    if (parityViable.length > 0) return parityViable;
    if (viable.length > 0) return viable;
    return unfired;
  }

  /** True when a ship of `length` could still cover `coord` given fired cells. */
  private canHideShip(coord: Coord, length: number): boolean {
    if (length <= 1) return true;

    for (const axis of ["row", "col"] as const) {
      const step: Coord = axis === "row" ? { row: 0, col: 1 } : { row: 1, col: 0 };
      for (let offset = 0; offset < length; offset += 1) {
        const start: Coord = {
          row: coord.row - offset * step.row,
          col: coord.col - offset * step.col,
        };
        const cells = Array.from({ length }, (_, index) => ({
          row: start.row + index * step.row,
          col: start.col + index * step.col,
        }));
        if (cells.every((cell) => onBoard(cell) && !this.fired.has(key(cell)))) {
          return true;
        }
      }
    }
    return false;
  }
}
