import { audioMetric } from "@/lib/sentinel-data";

/** Compact pill — always visible in the top bar so the partner-track headline stays in every screenshot. */
export function AudioMetricPill() {
  const rawPct = Math.round(audioMetric.raw * 100);
  const enhPct = Math.round(audioMetric.enhanced * 100);
  const delta = enhPct - rawPct;

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] backdrop-blur-sm"
      title="Command recognition under noisy supermarket audio · raw guard mic vs ai-coustics enhanced"
    >
      <span className="mono uppercase tracking-[0.14em] text-primary/90">
        audio
      </span>
      <span className="mono text-foreground">
        {rawPct}% → {enhPct}%
      </span>
      <span className="mono text-primary">+{delta}pp</span>
    </span>
  );
}
