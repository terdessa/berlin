import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { audioMetricsDashboard } from "@/lib/audio-metrics-data";

/**
 * Compact pill that doubles as the "Audio Intelligence" entry-point — clicking
 * it routes to the bench page. Stays visible in every screenshot so the
 * partner-track headline travels with the dashboard.
 */
export function AudioMetricPill() {
  const overall = audioMetricsDashboard.conditionComparison.find((row) => row.id === "overall");
  const danger = Math.round((overall?.dangerousErrorRate ?? 0) * 100);
  const sais = Math.round((overall?.sais ?? 0) * 100);
  const scored = `${overall?.transcribed ?? 0}/${overall?.clips ?? 0}`;

  return (
    <Link
      to="/metrics"
      title="Open the Audio Intelligence bench"
      className="group inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 pl-2.5 pr-1.5 text-[10px] backdrop-blur-sm transition-colors duration-200 hover:border-primary/70 hover:bg-primary/15"
    >
      <span className="mono uppercase tracking-[0.14em] text-primary/90">SAIS</span>
      <span className="mono tabular-nums text-foreground">{sais}%</span>
      <span className="mono tabular-nums text-muted-foreground">{scored}</span>
      <span className="mono tabular-nums text-alert">{danger}% danger</span>
      <span
        aria-hidden
        className="mono inline-flex h-5 w-5 items-center justify-center rounded-full border border-primary/30 bg-primary/15 text-primary transition-transform duration-200 group-hover:translate-x-0.5"
      >
        <ArrowUpRight className="h-3 w-3" />
      </span>
    </Link>
  );
}
