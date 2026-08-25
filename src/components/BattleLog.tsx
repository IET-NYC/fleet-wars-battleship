import type { LogEntry } from "../state/gameReducer";

const SOURCE_CLASSES: Record<LogEntry["source"], string> = {
  player: "border-l-cognition-bright text-slate-200",
  enemy: "border-l-cursor-bright text-slate-300",
  system: "border-l-slate-500 text-slate-400",
};

export default function BattleLog({ entries }: { entries: LogEntry[] }) {
  return (
    <section className="flex min-h-0 flex-col rounded-lg border border-white/10 bg-hull/80 p-3">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">
        Battle Log
      </h3>
      <ol
        aria-live="polite"
        className="flex max-h-56 flex-col gap-1 overflow-y-auto pr-1 text-xs lg:max-h-80"
      >
        {entries.map((entry) => (
          <li key={entry.id} className={`border-l-2 pl-2 ${SOURCE_CLASSES[entry.source]}`}>
            {entry.text}
          </li>
        ))}
      </ol>
    </section>
  );
}
