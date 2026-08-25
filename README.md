# Fleet Wars — Cognition vs. Cursor

A browser Battleship game where you command the **Cognition Fleet** against a
hunt/target AI commanding the **Cursor Fleet**. No backend, no accounts, no
database — the whole game (including the AI) runs client-side.

- **Live:** https://iet-nyc.github.io/fleet-wars-battleship/
- **Repo:** https://github.com/IET-NYC/fleet-wars-battleship
- **Bug log:** [BUGS.md](./BUGS.md)

## What it is

Standard Battleship on two 10x10 grids (columns A-J, rows 1-10) with five ships
per side (sizes 5, 4, 3, 3, 2). You place your fleet, then trade shots with the
AI until one fleet is fully sunk. Shots resolve to Miss, Hit, or Hit & Sunk, and
sunk ships are revealed on the enemy grid. A battle log, per-ship health pips,
and flavour text narrate the fight.

## Run locally

```bash
npm i
npm run dev
```

Then open the printed URL (defaults to http://localhost:5173).

## Run tests / checks

```bash
npm test        # 73 Vitest tests: board, rules, AI, reducer, full-game stress
npm run lint    # ESLint
npm run build   # TypeScript project build + Vite production bundle
```

All three run in CI on every push and pull request
(`.github/workflows/ci.yml`).

## File structure

```
fleet-wars-battleship/
├── README.md
├── BUGS.md
├── LICENSE
├── package.json
├── vite.config.ts
├── tailwind.config.ts
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── game/
│   │   ├── types.ts        # Cell, Ship, Board, GameState, Shot
│   │   ├── board.ts        # createBoard, placeShip, isValidPlacement, randomPlacement
│   │   ├── rules.ts        # fireShot, isSunk, allSunk, coordLabel
│   │   ├── ai.ts           # HuntTargetAI (pure, no React imports)
│   │   └── theme.ts        # ship names, colors, flavor text
│   ├── state/
│   │   ├── gameReducer.ts  # pure phase/turn state machine
│   │   └── useGame.ts      # React hook: AI instance, enemy delay, toasts, R key
│   ├── components/
│   │   ├── BoardGrid.tsx   # grid + cells, placement preview and firing
│   │   ├── ShipTray.tsx
│   │   ├── FleetStatus.tsx
│   │   ├── BattleLog.tsx
│   │   ├── Toast.tsx
│   │   └── GameOverPanel.tsx
│   └── styles/
│       └── index.css
└── tests/
    ├── board.test.ts
    ├── rules.test.ts
    ├── ai.test.ts
    ├── gameReducer.test.ts
    └── stress.test.ts      # seeded full games driven through the reducer
```

Game logic lives entirely in `src/game/` and `src/state/` and never imports
React (except the hook itself), so it is unit-testable in a plain Node
environment.

## How the AI works

`src/game/ai.ts` implements a classic **hunt / target** search with parity, as a
pure class with no React dependency.

**Hunt mode** — when there is no live hit to chase, the AI fires at a random
unfired cell restricted to a checkerboard parity pattern (`(row + col) % 2 === 0`).
Since the smallest ship is length 2, every ship must cover at least one parity
cell, so this halves the search space for free. The AI only falls back to
unrestricted random fire once no remaining ship length can still fit anywhere on
the untouched parity cells.

**Target mode** — a hit pushes its four orthogonal neighbours onto a target
stack (off-board and already-fired cells are skipped). Once two hits line up,
the AI re-prioritises the stack so cells that extend that line — in both
directions — are fired before perpendicular neighbours. When a ship sinks, only
the targets belonging to that ship's line are dropped; outstanding hits from a
*different*, still-floating ship stay on the stack, which is what keeps the AI
from stalling when two ships are placed adjacent to each other.

Three invariants are enforced by construction and covered by tests: the AI never
fires at a cell it has already fired at, never fires off-board, and never fires
after the game is over.

Its own fleet is placed randomly (valid, non-overlapping) and re-rolled every
game.

## Deployment

GitHub Pages, built from `main` by `.github/workflows/deploy.yml`: the workflow
runs the tests, builds with `VITE_BASE_PATH` set to the repository path so asset
URLs resolve under the Pages subdirectory, and publishes `dist/`.

## License

MIT — see [LICENSE](./LICENSE).
