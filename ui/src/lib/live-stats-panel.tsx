import type { TrackFlow } from "@/lib/use-livekit-stats";

// Small bitrate / codec / fps overlay. Drop into /video and /audio so you can
// confirm at a glance whether bytes are actually moving (kbps > 0) without
// opening chrome://webrtc-internals.
export function LiveStatsPanel({
  flows,
  hint,
}: {
  flows: TrackFlow[];
  hint?: string;
}) {
  const out = flows.filter((f) => f.direction === "out");
  const inn = flows.filter((f) => f.direction === "in");
  const totalKbps = flows.reduce((sum, f) => sum + f.kbps, 0);
  const flowing = totalKbps >= 1; // anything below 1 kbps is essentially silence

  return (
    <section className="mt-5 overflow-hidden rounded-lg border border-border bg-panel/60">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <span
            className={[
              "h-1.5 w-1.5 rounded-full",
              flowing ? "bg-ok animate-soft-pulse" : "bg-muted-foreground",
            ].join(" ")}
          />
          <h2 className="mono text-[11px] uppercase tracking-[0.2em] text-foreground">
            live transport
          </h2>
          <span className="mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            {flowing
              ? `${formatKbps(totalKbps)} total`
              : flows.length === 0
                ? "no peer connection"
                : "0 kbps · idle"}
          </span>
        </div>
        <span className="mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          rtcp · sampled every 1s
        </span>
      </header>
      <div className="grid gap-0 sm:grid-cols-2">
        <FlowColumn title="↑ publishing (outbound)" flows={out} empty="no local tracks published" />
        <FlowColumn
          title="↓ subscribing (inbound)"
          flows={inn}
          empty="no remote tracks subscribed"
        />
      </div>
      {hint && (
        <p className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
          {hint}
        </p>
      )}
    </section>
  );
}

function FlowColumn({
  title,
  flows,
  empty,
}: {
  title: string;
  flows: TrackFlow[];
  empty: string;
}) {
  return (
    <div className="border-border px-4 py-3 sm:[&:first-child]:border-r">
      <div className="mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        {title}
      </div>
      {flows.length === 0 ? (
        <div className="mono mt-3 text-[11px] text-muted-foreground/70">{empty}</div>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {flows.map((f) => (
            <FlowRow key={`${f.direction}-${f.sid}`} flow={f} />
          ))}
        </ul>
      )}
    </div>
  );
}

function FlowRow({ flow }: { flow: TrackFlow }) {
  const labelParts: string[] = [flow.kind, flow.source];
  if (flow.identity) labelParts.push(flow.identity);
  const flowing = flow.kbps >= 1;
  return (
    <li className="rounded-md border border-border/70 bg-background/40 px-2.5 py-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="mono text-[10px] uppercase tracking-wider text-foreground/90">
          {labelParts.join(" · ")}
        </span>
        <span
          className={[
            "mono text-[11px]",
            flowing ? "text-foreground" : "text-muted-foreground",
          ].join(" ")}
        >
          {formatKbps(flow.kbps)}
        </span>
      </div>
      <div className="mono mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
        {flow.width && flow.height && (
          <span>
            {flow.width}×{flow.height}
          </span>
        )}
        {flow.fps !== undefined && <span>{Math.round(flow.fps)} fps</span>}
        {flow.codec && <span>codec {flow.codec}</span>}
        {flow.packetsLost !== undefined && <span>{flow.packetsLost} lost</span>}
        {flow.limitedBy && flow.limitedBy !== "none" && (
          <span className="text-amber-300">limited by {flow.limitedBy}</span>
        )}
        <span>total {formatBytes(flow.bytesTotal)}</span>
      </div>
    </li>
  );
}

function formatKbps(kbps: number): string {
  if (kbps >= 1000) return `${(kbps / 1000).toFixed(2)} mbps`;
  if (kbps >= 10) return `${kbps.toFixed(0)} kbps`;
  return `${kbps.toFixed(1)} kbps`;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(1)} KB`;
  return `${bytes} B`;
}
