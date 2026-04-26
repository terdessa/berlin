import { audioMetricsDashboard } from "@/lib/audio-metrics-data";

/** Compact pill — always visible in the top bar so the partner-track headline stays in every screenshot. */
export function AudioMetricPill() {
  const overall = audioMetricsDashboard.conditionComparison.find((row) => row.id === "overall");
  const danger = Math.round((overall?.dangerousErrorRate ?? 0) * 100);
  const sais = Math.round((overall?.sais ?? 0) * 100);
  const scored = `${overall?.transcribed ?? 0}/${overall?.clips ?? 0}`;

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] backdrop-blur-sm"
      title="Sentinel Audio Intelligence Score · correct actions plus safe recoveries"
    >
      <span className="mono uppercase tracking-[0.14em] text-primary/90">SAIS</span>
      <span className="mono text-foreground">{sais}%</span>
      <span className="mono text-muted-foreground">{scored}</span>
      <span className="mono text-alert">{danger}% danger</span>
    </span>
  );
}
