import { Link } from "@tanstack/react-router";
import { audioMetricsDashboard } from "@/lib/audio-metrics-data";

function pct(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "n/a";
  return `${Math.round(value * 100)}%`;
}

const overall = audioMetricsDashboard.conditionComparison.find((row) => row.id === "overall");
const noisy = audioMetricsDashboard.conditionComparison.find((row) => row.id === "noisy");
const systemRows = audioMetricsDashboard.systemComparison;

const proofCards = [
  {
    label: "SAIS",
    value: pct(overall?.sais),
    detail: "correct or safe",
    tone: "primary",
  },
  {
    label: "danger",
    value: pct(overall?.dangerousErrorRate),
    detail: "wrong actions",
    tone: "alert",
  },
  {
    label: "clips",
    value: `${overall?.transcribed ?? 0}/${overall?.clips ?? 0}`,
    detail: "scored",
    tone: "ok",
  },
  {
    label: "noisy WER",
    value: pct(noisy?.wer),
    detail: "stress set",
    tone: "neutral",
  },
];

export function DashboardEvidencePanel() {
  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-primary/25 bg-panel/80">
      <header className="flex items-center justify-between gap-2 border-b border-border bg-panel-elevated px-3 py-2">
        <div>
          <div className="mono text-[10px] uppercase tracking-[0.2em] text-primary">
            audio intelligence
          </div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            raw → ai-coustics → Sentinel
          </div>
        </div>
        <Link
          to="/metrics"
          className="mono rounded-md border border-primary/40 bg-primary/10 px-2 py-1 text-[9px] uppercase tracking-[0.16em] text-primary transition hover:border-primary/70"
        >
          details
        </Link>
      </header>

      <div className="grid grid-cols-4 border-b border-border">
        {proofCards.map((card) => (
          <div key={card.label} className="border-r border-border px-2.5 py-2 last:border-r-0">
            <div className="mono text-[8px] uppercase tracking-[0.15em] text-muted-foreground">
              {card.label}
            </div>
            <div
              className={[
                "num mt-1 text-xl font-semibold",
                card.tone === "primary"
                  ? "text-primary"
                  : card.tone === "alert"
                    ? "text-alert"
                    : card.tone === "ok"
                      ? "text-ok"
                      : "text-foreground",
              ].join(" ")}
            >
              {card.value}
            </div>
            <div className="mt-0.5 text-[9px] text-muted-foreground">{card.detail}</div>
          </div>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-hidden px-3 py-2">
        <div className="space-y-1.5">
          {systemRows.map((row) => (
            <div key={row.id} className="grid grid-cols-[1fr_auto] items-center gap-3">
              <div className="min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[11px] text-foreground">{row.version}</span>
                  <span className="num text-[11px] text-primary">{pct(row.sais)}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary"
                    style={{ width: pct(row.sais).replace("n/a", "0%") }}
                  />
                </div>
              </div>
              <div className="mono w-16 text-right text-[9px] uppercase text-alert">
                {pct(row.dangerousErrorRate)} risk
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
