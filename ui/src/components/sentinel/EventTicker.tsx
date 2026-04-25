export type TickerEntry = {
  id: number;
  text: string;
  at: string;
};

type Props = {
  entries: TickerEntry[];
};

export function EventTicker({ entries }: Props) {
  return (
    <div className="rounded-md border border-border bg-panel/60 p-2 backdrop-blur-sm">
      <div className="mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/80">
        event ticker · newest first
      </div>
      <ul className="mt-1.5 max-h-28 space-y-0.5 overflow-y-auto pr-1">
        {entries.length === 0 && (
          <li className="mono text-[11px] text-muted-foreground/60">
            quiet · no events in the last minute
          </li>
        )}
        {entries.map((e, idx) => (
          <li
            key={e.id}
            className={[
              "mono flex items-baseline gap-2 text-[11px] transition-opacity",
              idx === 0
                ? "text-foreground"
                : idx < 3
                  ? "text-foreground/80"
                  : "text-muted-foreground/70",
            ].join(" ")}
            style={{ opacity: Math.max(0.4, 1 - idx * 0.12) }}
          >
            <span className="text-muted-foreground">{e.at}</span>
            <span className="truncate">{e.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
