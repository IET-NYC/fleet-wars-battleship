import { fleetFor, fleetNameFor } from "../game/theme";
import { isSunk } from "../game/rules";
import type { Board, Side } from "../game/types";

interface FleetStatusProps {
  board: Board;
  side: Side;
}

export default function FleetStatus({ board, side }: FleetStatusProps) {
  const accent = side === "player" ? "text-cognition-bright" : "text-cursor-bright";
  const pip = side === "player" ? "bg-cognition-bright" : "bg-cursor-bright";

  return (
    <section className="rounded-lg border border-white/10 bg-hull/80 p-3">
      <h3 className={`mb-2 text-xs font-semibold uppercase tracking-[0.2em] ${accent}`}>
        {fleetNameFor(side)}
      </h3>
      <ul className="flex flex-col gap-1.5">
        {fleetFor(side).map((spec) => {
          const ship = board.ships.find((candidate) => candidate.id === spec.id);
          const hits = ship?.hits.length ?? 0;
          const sunk = ship ? isSunk(ship) : false;
          return (
            <li key={spec.id} className="flex items-center justify-between gap-2 text-xs">
              <span className={sunk ? "text-slate-500 line-through" : "text-slate-200"}>
                {spec.name}
              </span>
              <span className="flex items-center gap-1" aria-label={`${hits} of ${spec.length} hit`}>
                {Array.from({ length: spec.length }, (_, index) => (
                  <span
                    key={index}
                    className={`h-2 w-2 rounded-sm ${
                      index < hits ? (sunk ? "bg-rose-500" : "bg-rose-400/80") : `${pip} opacity-40`
                    }`}
                  />
                ))}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
