# BUGS.md

Running log of every real defect found while building Fleet Wars — from failing
tests, manual play, or code review. Entries are appended as they are found, not
written retroactively.

## Bug entries

### BUG-01: `npm run build` failed with "Cannot find type definition file for 'node'"
- **Found:** first run of `npm run build` on the fresh scaffold
- **Symptom:** `error TS2688: Cannot find type definition file for 'node'.` — the build aborted before Vite ever ran, so `tsc -b` gated every commit.
- **Root cause:** `tsconfig.node.json` declares `"types": ["node"]` (needed because `vite.config.ts` reads `process.env.VITE_BASE_PATH`), but `@types/node` was not in `devDependencies` after the dependency set was pinned to React 18 / Vite 5.
- **Fix:** added `@types/node` to `devDependencies` (PR #1).
- **Regression test:** `npm run build` in CI — the TypeScript project build is part of the build script, so a missing type package fails the pipeline.

### BUG-02: fixture fleet placed two ships on the same cell, and the placement API failed silently
- **Found:** first run of `tests/ai.test.ts` ("never fires off-board, even when hits sit against every edge")
- **Symptom:** the test threw `test fixture placement failed`. The edge-hugging fixture put Windsurf on J10 horizontally (`J10`–`G10`) and Deep Wiki vertically ending on the same J10 cell, so the second `placeShip` call returned `null`.
- **Root cause:** two bugs, one in the test and one in ergonomics. The fixture coordinates genuinely overlapped, but `placeShip` returns `Board | null` on invalid input, so a caller that ignores the return value silently keeps an incomplete fleet — the original fixture would have tested the AI against a four-ship board and still "passed".
- **Fix:** corrected the fixture coordinates, and every test now funnels placements through a `must()` helper that throws on `null` instead of accepting a partial board. The reducer path has the same guard: `placeSelected` returns the *identical* state object when `placeShip` returns `null`, which `tests/gameReducer.test.ts` asserts with `toBe`.
- **Regression test:** `tests/gameReducer.test.ts` → "ignores an invalid placement instead of half-applying it"; `tests/stress.test.ts` → "never leaves a ship overlapping or off-board across 500 random fleets".

### BUG-03: parity-fallback test asserted behaviour that is mathematically impossible
- **Found:** first run of `tests/ai.test.ts` ("falls back off parity and still finds a length-2 ship once parity is exhausted"), which failed with `expected 51 to be less than or equal to 50`
- **Symptom:** the AI could never sink a length-2 ship after the parity grid had been swept — it ran out of cells entirely.
- **Root cause:** the test fed the AI 50 parity *misses* while the board underneath still had both of the ship's cells unfired. A length-2 ship always covers exactly one parity cell, so the test had told the AI that one of the ship's own cells was a miss. The AI was behaving correctly; the test's premise was wrong. Worth logging because it is the exact bug you would ship if you wired the AI's belief state and the real board through separate code paths in the UI.
- **Fix:** split into two honest tests — one asserts the parity fallback returns unfired off-parity cells and then throws once the board is exhausted, the other sweeps parity *against the real board* so the AI's belief and the board agree, and checks the off-parity cell is reached through target mode. `useGame` was written to resolve the AI's shot against the live board and feed that same outcome back, so the two can never diverge.
- **Regression test:** `tests/ai.test.ts` → "falls back to off-parity cells once the parity pattern is exhausted" and "still sinks a length-2 ship whose remaining cell is off parity".

### BUG-04: sunk-ship retirement could discard a still-floating ship's hit
- **Found:** code review on PR #3
- **Symptom:** when two ships touch end-to-end in the same line, sinking one of them retired the wrong cells: the AI dropped a confirmed hit belonging to the ship that was still afloat and kept a cell of the ship that had just gone down. It then stopped hunting a ship it had already found.
- **Root cause:** `retireSunkShip` walked outwards from the killing shot collecting the contiguous run of outstanding hits, then kept `run.slice(0, length)`. With two collinear ships the run is longer than the sunk ship, and the slice took cells in traversal order (`[killingShot, ...backwards, ...forwards]`) rather than the sunk ship's actual footprint.
- **Fix:** enumerate every length-`n` window of outstanding hits that contains the killing shot, on both axes, and prefer a window whose two ends are capped by non-hits — the only window that can be the ship that actually sank.
- **Regression test:** `tests/ai.test.ts` → "retires only the sunk ship when two ships touch end to end in one line" (hits A1–A4, then A5 sinks the length-2 ship: A1–A3 must stay in target mode and A6 must not be queued).

### BUG-05: shot resolution wrote the result into the wrong board
- **Found:** self-review of `gameReducer.ts` before the first commit of the state machine
- **Symptom:** the enemy's shot landed on the enemy's own board. Left in, the AI would have been sinking its own fleet and the player's board would never take damage, so the game could never be lost.
- **Root cause:** the shared `resolveShot` helper assigned both boards in one object literal with a conditional per key, and the enemy branch evaluated `state.playerBoard && result.board` — always the new board — into `enemyBoard`.
- **Fix:** replaced the per-key conditionals with a single branch on the attacker that touches exactly one board.
- **Regression test:** `tests/gameReducer.test.ts` → "declares the enemy the winner when the player fleet is wiped out" plus `tests/stress.test.ts` → "terminates with exactly one winner and consistent boards across 60 games", which asserts `allSunk(playerBoard) === (winner === "enemy")` and that the two shot counts stay within one of each other.

### BUG-06: unused constant broke `npm run build` after the AI was rewritten
- **Found:** `npm run lint` / `npm run build` on the AI branch
- **Symptom:** `error TS6133: 'ORTHOGONAL' is declared but its value is never read` and the matching `@typescript-eslint/no-unused-vars` error — a clean-looking, fully passing test suite still could not be built.
- **Root cause:** neighbour generation was inlined into `buildTargets` during a refactor and the original direction table was left behind; the repo enables `noUnusedLocals`.
- **Fix:** deleted the dead constant.
- **Regression test:** CI runs `npm run lint` and `npm run build` on every push and pull request, so dead code cannot reach `main`.

### BUG-07: a click already in flight could reset the game before the result was read
- **Found:** manual play (first full desktop playthrough)
- **Symptom:** the game-over panel appeared and vanished again immediately, dropping straight back into a fresh placement phase, with no reachable record of who won. Observed once and not reproducible on demand.
- **Root cause:** the panel mounts on the same shot that ends the game, centred on the screen and directly under a cursor that has been rapid-clicking cells. Its Play Again button therefore appears underneath a pointer that may already be mid-click (or mid-double-click), and a `mouseup` landing on the freshly mounted button fires `reset` before the player has read anything. The state machine itself was cleared of blame first: the invariants in `tests/stress.test.ts` show the `gameOver` phase is only ever left through an explicit `reset`.
- **Fix:** the Play Again button stays `disabled` for 500ms after the panel mounts, so an in-flight click cannot activate it.
- **Regression test:** covered indirectly — `tests/gameReducer.test.ts` → "resets every piece of state, not just the phase" pins the reset semantics, and the stress invariants prove no other transition leaves `gameOver`. The 500ms arming delay itself is UI timing, verified by manual play.

## Testing approach

**Layered, with the rules and the AI kept out of React.** All game logic lives in
pure modules (`src/game/*`) and a pure reducer (`src/state/gameReducer.ts`), so
every rule is testable without a DOM. The React layer is deliberately thin: the
only stateful thing it owns is the AI instance, the enemy-turn timer, the toast
timer and the `R` shortcut (`src/state/useGame.ts`).

Four suites, 73 tests, run by `npm test` (Vitest) and in CI on every push and
pull request:

- **`tests/board.test.ts`** — placement validity: off-board overflow on both
  axes, one-cell overlap, rotation next to an edge, re-placing a ship over its
  own footprint, immutability of every board mutation, and 200 randomised fleets.
- **`tests/rules.test.ts`** — shot resolution: coordinate labels, miss/hit/sunk
  outcomes, duplicate fire throwing rather than silently wasting a turn, win
  detection, own-board vs enemy-board visibility, shot counts and accuracy, and
  the required fleet rosters and flavour text.
- **`tests/ai.test.ts`** — AI behaviour, including the three "never" rules (never
  fire twice, never fire off-board, never fire after game over) checked across
  seeded full playouts, plus parity hunting, the parity fallback, line extension
  through a run of three, the touching-ships retirement case, and a check that
  the AI beats undirected random fire.
- **`tests/gameReducer.test.ts`** — the state machine: turn alternation, the
  no-shot-during-enemy-turn and no-duplicate-shot guards, `Hit & Sunk <name>`
  logging, the 50-entry log cap, fleet-pip/board agreement, immediate game over,
  and Play Again resetting to `createInitialState()` by deep equality.
- **`tests/stress.test.ts`** — whole games driven through the reducer with the
  real AI (60 seeded games), asserting exactly one winner, no duplicate or
  off-board shots from either side, termination, and that the player is never
  more than one shot ahead; plus 500 random fleets checked for overlap.

**Determinism.** Every module that needs randomness takes an injectable
`random: () => number`, so fleets, AI tie-breaks and flavour text are all
reproducible from a seed — a failing stress seed can be replayed exactly.

**Illegal input is asserted by identity.** Guards return the *same* state object,
and the tests use `toBe`, so a guard that accidentally clones state (and would
re-render, or worse, half-apply an action) fails.

**Manual play.** Three full playthroughs, one at a 375px viewport, with the
browser console open: placement (preview validity, `R`, pick-up, auto-place,
clear, gating of Start Battle), battle (alternation, locked input during the AI
delay, duplicate clicks, sunk outlines, log order and cap, toasts), fleet pips
against real hit counts, game-over stats, and Play Again. BUG-07 came out of that
pass. Zero console errors and zero React warnings under StrictMode.
