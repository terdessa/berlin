import { audioMetric } from "@/lib/sentinel-data";

export function AudioMetricBadge() {
  const rawPct = Math.round(audioMetric.raw * 100);
  const enhancedPct = Math.round(audioMetric.enhanced * 100);
  const delta = enhancedPct - rawPct;

  return (
    <div className="rounded-md border border-primary/30 bg-primary/5 p-3 backdrop-blur-sm">
      <div className="mono text-[10px] uppercase tracking-[0.2em] text-primary/90">
        audio intelligence metric
      </div>
      <div className="mt-1 mono text-sm text-foreground">
        {audioMetric.label}{" "}
        <span className="text-foreground">
          {rawPct}% → {enhancedPct}%
        </span>
        <span className="ml-2 mono text-[11px] text-primary">+{delta}pp</span>
      </div>
      <div className="mono mt-1 text-[10px] text-muted-foreground">
        raw guard mic vs ai-coustics enhanced · 200 noisy supermarket samples
      </div>
    </div>
  );
}
