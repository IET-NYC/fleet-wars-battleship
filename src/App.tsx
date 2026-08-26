import BattleLog from "./components/BattleLog";
import BoardGrid from "./components/BoardGrid";
import FleetStatus from "./components/FleetStatus";
import GameOverPanel from "./components/GameOverPanel";
import ShipTray from "./components/ShipTray";
import ShotFlash from "./components/ShotFlash";
import Toast from "./components/Toast";
import { PLAYER_SHIPS } from "./game/theme";
import { useGame } from "./state/useGame";

const REPO_URL = "https://github.com/IET-NYC/fleet-wars-battleship";

export default function App() {
  const { state, actions, canFire, isEnemyThinking, readyToStart, tray } = useGame();
  const placing = state.phase === "placement";
  const selectedSpec = PLAYER_SHIPS.find((spec) => spec.id === state.selectedShipId);

  const status = placing
    ? readyToStart
      ? "Fleet ready. Start the battle when you are."
      : "Deploy your fleet."
    : isEnemyThinking
      ? "Enemy is thinking…"
      : state.phase === "gameOver"
        ? state.winner === "player"
          ? "Cursor Fleet destroyed."
          : "Cognition Fleet destroyed."
        : "Your turn. Pick a target.";

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-4 py-6">
      <header className="text-center">
        <h1 className="text-3xl font-bold tracking-[0.3em] text-cognition-bright sm:text-4xl">
          FLEET WARS
        </h1>
        <p className="mt-1 text-xs uppercase tracking-[0.35em] text-slate-400 sm:text-sm">
          Cognition vs. Cursor
        </p>
        {state.mode === "op" ? (
          <p className="mt-2 inline-block rounded-full border border-cognition-bright/50 px-3 py-1 text-[0.65rem] uppercase tracking-[0.3em] text-cognition-bright">
            OP-Mode · Cognition favoured
          </p>
        ) : null}
        <p
          aria-live="polite"
          className={`mt-3 text-sm ${
            isEnemyThinking
              ? "text-cursor-bright motion-safe:animate-radar-sweep"
              : "text-slate-300"
          }`}
        >
          {status}
        </p>
      </header>

      <main className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="flex flex-col gap-6">
          <div className="grid gap-6 md:grid-cols-2">
            <section className="rounded-lg border border-cognition/25 bg-hull/60 p-3">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-cognition-bright">
                Cognition Fleet · your waters
              </h2>
              <BoardGrid
                board={state.playerBoard}
                side="player"
                revealShips
                interactive={placing}
                placement={
                  placing
                    ? {
                        shipLength: selectedSpec?.length ?? 0,
                        orientation: state.orientation,
                        onPlace: actions.placeSelected,
                        onPickUp: actions.pickUpShip,
                      }
                    : undefined
                }
              />
            </section>

            <section className="rounded-lg border border-cursor/25 bg-hull/60 p-3">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-cursor-bright">
                Cursor Fleet · target grid
              </h2>
              <BoardGrid
                board={state.enemyBoard}
                side="enemy"
                revealShips={false}
                interactive={canFire}
                onFire={actions.fireAt}
              />
            </section>
          </div>

          {placing ? (
            <ShipTray
              board={state.playerBoard}
              tray={tray}
              selectedShipId={state.selectedShipId}
              orientation={state.orientation}
              onSelect={actions.selectShip}
              onPickUp={actions.pickUpShip}
              onRotate={actions.rotate}
              onAutoPlace={actions.autoPlace}
              onClear={actions.clearFleet}
              onStart={actions.startBattle}
              readyToStart={readyToStart}
              mode={state.mode}
              onModeChange={actions.setMode}
            />
          ) : null}
        </div>

        <aside className="flex flex-col gap-4">
          <FleetStatus board={state.playerBoard} side="player" />
          <FleetStatus board={state.enemyBoard} side="enemy" />
          <BattleLog entries={state.log} />
        </aside>
      </main>

      <footer className="mt-auto pt-4 text-center text-xs text-slate-500">
        Built with Devin + Windsurf ·{" "}
        <a href={REPO_URL} className="underline hover:text-cognition-bright">
          source on GitHub
        </a>
      </footer>

      {state.flash ? <ShotFlash flash={state.flash} /> : null}

      {state.toast ? (
        <Toast
          text={state.toast.text}
          onDismiss={() => state.toast && actions.dismissToast(state.toast.id)}
        />
      ) : null}

      {state.phase === "gameOver" && state.winner ? (
        <GameOverPanel
          winner={state.winner}
          enemyBoard={state.enemyBoard}
          playerBoard={state.playerBoard}
          onPlayAgain={actions.reset}
        />
      ) : null}
    </div>
  );
}
