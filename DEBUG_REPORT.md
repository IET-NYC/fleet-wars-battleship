# Debug Report — Fleet Wars

Every real defect found while building Fleet Wars is logged chronologically in
[`BUGS.md`](./BUGS.md). Entries were appended as they were discovered — from
failing tests, manual play, or code review — not written retroactively. This
report summarises that log plus the fixes that landed after it.

## Deep Wiki

Generated architecture documentation lives at
<https://deepwiki.com/IET-NYC/fleet-wars-battleship>. Section **5.2 "Bug Log and
QA Process"** covers the same material as this report in the context of the
codebase.

## The seven logged bugs

**BUG-01 — build failed with "Cannot find type definition file for 'node'".**
The first `npm run build` on the fresh scaffold aborted with `TS2688` before Vite
ran, so `tsc -b` gated every commit. `tsconfig.node.json` declares
`"types": ["node"]` (needed because `vite.config.ts` reads
`process.env.VITE_BASE_PATH`), but `@types/node` was missing from
`devDependencies` after the dependency set was pinned to React 18 / Vite 5.
Fixed by adding `@types/node` to `devDependencies`.

**BUG-02 — fixture placed two ships on the same cell and `placeShip` failed
silently.** An edge-hugging AI fixture put Windsurf on J10 horizontally and Deep
Wiki vertically ending on the same J10 cell, so the second `placeShip` returned
`null`. Because `placeShip` returns `Board | null`, a caller ignoring the return
value keeps an incomplete fleet — the fixture would have tested the AI against a
four-ship board and still "passed". Fixed by correcting the coordinates and
routing every test placement through a `must()` helper that throws on `null`;
the reducer's `placeSelected` returns the identical state object on an invalid
placement, asserted with `toBe`.

**BUG-03 — parity-fallback test asserted a mathematically impossible premise.**
The test fed the AI 50 parity *misses* while both cells of a length-2 ship were
still unfired. A length-2 ship always covers exactly one parity cell, so the
test had declared one of the ship's own cells a miss; the AI was correct and the
test was wrong. Split into two honest tests: one checks the parity fallback
returns unfired off-parity cells and then throws once the board is exhausted,
the other sweeps parity *against the real board* so the AI's belief and the
board agree. `useGame` resolves the AI's shot against the live board and feeds
that same outcome back, so the two cannot diverge.

**BUG-04 — `retireSunkShip` discarded a still-floating ship's hit.** With two
ships touching end-to-end in one line, sinking one retired the wrong cells: a
confirmed hit on the surviving ship was dropped and the AI stopped hunting a
ship it had already found. The helper collected the contiguous run of
outstanding hits and kept `run.slice(0, length)`, which takes cells in traversal
order rather than the sunk ship's footprint. Fixed by enumerating every
length-`n` window of outstanding hits containing the killing shot on both axes
and preferring the window whose ends are capped by non-hits.

**BUG-05 — `resolveShot` wrote the result into the wrong board.** The enemy's
shot landed on the enemy's own board, so the AI sank its own fleet and the game
could never be lost. The helper assigned both boards in one object literal with
a conditional per key, and the enemy branch evaluated
`state.playerBoard && result.board` — always the new board — into `enemyBoard`.
Fixed by branching on the attacker so exactly one board is touched.

**BUG-06 — unused `ORTHOGONAL` constant broke the build.** After neighbour
generation was inlined into `buildTargets`, the leftover direction table
tripped `TS6133` and `@typescript-eslint/no-unused-vars` under `noUnusedLocals`:
a fully passing test suite that could not be built. Fixed by deleting the dead
constant.

**BUG-07 — an in-flight click could reset the game.** The game-over panel mounts
on the shot that ends the game, centred under a cursor that has been
rapid-clicking cells, so a `mouseup` landing on the freshly mounted Play Again
button fired `reset` before the result could be read. The state machine was
cleared first: stress invariants show `gameOver` is only left through an
explicit `reset`. Fixed by keeping Play Again `disabled` for 500ms after the
panel mounts.

## Two additional fixes (post-`BUGS.md`)

**Code review on PR #13.** The status headline was moved out of the React layer
into the pure reducer helper `statusFor(state)` in `src/state/gameReducer.ts`, so
the phase-to-copy mapping is testable without a DOM and `useGame` only reads it.
`fireShot` in `src/game/rules.ts` now reuses the exported `cloneBoard` from
`src/game/board.ts` instead of duplicating clone logic. The game-over panel
became a real modal: `role="dialog"` with `aria-modal="true"`, focus moved into
the dialog on mount and onto Play Again once it arms, Tab wrapped inside the
dialog, and Escape triggering Play Again once armed. A new `enemyStandDown`
action lets the enemy hand the turn back with a log line instead of leaving the
game stuck in `enemyTurn`.

**Enemy-AI recovery on PR #14.** A hot reload drops the AI ref while keeping
game state, which previously stranded the game on "Enemy is thinking…". The
enemy-turn effect now rebuilds the AI and calls `seedAiFromBoard`
(`src/state/aiRecovery.ts`), which replays every already-fired cell of the
player board into the fresh instance — misses and hits first, then sunk ships
last so their hits are retired rather than chased — so the rebuilt AI cannot
pick a cell that would make `fireShot` throw. The shot itself is wrapped in
`try`/`catch`: nothing can catch a throw from a timer, so a failure is logged
and dispatched as `enemyStandDown` rather than hanging the turn.

## Testing approach

The design is layered so that almost everything is testable without a DOM: all
rules and AI logic live in pure modules (`src/game/*`) and a pure reducer
(`src/state/gameReducer.ts`), and the React layer is deliberately thin — it owns
only the AI instance, the enemy-turn timer, the toast/flash timers and the `R`
shortcut (`src/state/useGame.ts`).

`BUGS.md` records four suites and 73 tests at the time it was written; the suite
has since grown to **seven suites and 115 tests** (`board`, `rules`, `ai`,
`gameReducer`, `stress`, `aiRecovery`, `app`), run by `npm test` under Vitest and
in CI (alongside `npm run lint` and `npm run build`) on every push and pull
request.

Every module that needs randomness takes an injectable `random: () => number`,
so fleets, AI tie-breaks and flavour text are all reproducible from a seed — a
failing stress seed can be replayed exactly. Illegal input is asserted by
identity: guards return the *same* state object and tests use `toBe`, so a guard
that accidentally clones state fails.
