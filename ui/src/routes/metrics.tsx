import { Link, createFileRoute } from "@tanstack/react-router";
import {
  audioMetricCards,
  comparisonRows,
  failureBreakdown,
  recentOutcomes,
  type ComparisonRow,
  type InteractionOutcome,
  type MetricCard,
} from "@/lib/audio-metrics-data";

export const Route = createFileRoute("/metrics")({
  component: MetricsPage,
  head: () => ({
    meta: [
      { title: "Sentinel - Audio Intelligence Metrics" },
      {
        name: "description",
        content:
          "Sentinel Audio Intelligence Score dashboard for noisy retail voice-command benchmarks.",
      },
    ],
  }),
});

function MetricsPage() {
  return (
    <main className="min-h-screen px-5 py-5">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <p className="mono text-[10px] uppercase tracking-[0.2em] text-primary">
            Sentinel audio intelligence
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-foreground">
            SAIS quality dashboard
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Measures whether Sentinel makes the correct or safe security decision after noisy
            speech passes through enhancement, transcription, parsing, and context validation.
          </p>
        </div>
        <Link
          to="/"
          className="mono rounded-md border border-border bg-background/60 px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground transition hover:border-primary/50 hover:text-foreground"
        >
          dashboard
        </Link>
      </header>

      <section className="mt-5 grid gap-3 md:grid-cols-5">
        {audioMetricCards.map((card) => (
          <MetricCardView key={card.label} card={card} />
        ))}
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[1.45fr_0.9fr]">
        <div className="rounded-lg border border-border bg-panel/80">
          <div className="border-b border-border px-4 py-3">
            <h2 className="mono text-[11px] uppercase tracking-[0.2em] text-foreground">
              system comparison
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Raw audio shows the baseline problem. ai-coustics improves the audio path.
              Sentinel context validation reduces dangerous decisions.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-left text-xs">
              <thead className="border-b border-border bg-panel-elevated/60">
                <tr className="mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  <th className="px-4 py-3 font-medium">version</th>
                  <th className="px-3 py-3 text-right font-medium">SAIS</th>
                  <th className="px-3 py-3 text-right font-medium">correct</th>
                  <th className="px-3 py-3 text-right font-medium">recovery</th>
                  <th className="px-3 py-3 text-right font-medium">danger</th>
                  <th className="px-3 py-3 text-right font-medium">WER</th>
                  <th className="px-4 py-3 font-medium">note</th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row) => (
                  <ComparisonRowView key={row.version} row={row} />
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-panel/80">
          <div className="border-b border-border px-4 py-3">
            <h2 className="mono text-[11px] uppercase tracking-[0.2em] text-foreground">
              failure causes
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Categories used when an interaction becomes a safe recovery or dangerous error.
            </p>
          </div>
          <div className="space-y-3 px-4 py-4">
            {failureBreakdown.map((item) => (
              <div key={item.label}>
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="text-foreground">{item.label}</span>
                  <span className="mono text-muted-foreground">{item.pct}%</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary"
                    style={{ width: `${item.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-5 rounded-lg border border-border bg-panel/80">
        <div className="border-b border-border px-4 py-3">
          <h2 className="mono text-[11px] uppercase tracking-[0.2em] text-foreground">
            recent interaction outcomes
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Each row is scored as correct action, safe recovery, or dangerous error.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead className="border-b border-border bg-panel-elevated/60">
              <tr className="mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                <th className="px-4 py-3 font-medium">expected</th>
                <th className="px-3 py-3 font-medium">heard</th>
                <th className="px-3 py-3 font-medium">action</th>
                <th className="px-3 py-3 font-medium">decision</th>
                <th className="px-3 py-3 font-medium">reason</th>
              </tr>
            </thead>
            <tbody>
              {recentOutcomes.map((row) => (
                <OutcomeRow key={row.id} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function MetricCardView({ card }: { card: MetricCard }) {
  const toneClass =
    card.tone === "primary"
      ? "border-primary/50 bg-primary/10"
      : card.tone === "ok"
        ? "border-ok/40 bg-ok/10"
        : card.tone === "alert"
          ? "border-alert/50 bg-alert/10"
          : "border-amber-400/40 bg-amber-400/10";
  return (
    <div className={["rounded-lg border px-4 py-3", toneClass].join(" ")}>
      <div className="mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
        {card.label}
      </div>
      <div className="num mt-2 text-3xl font-semibold text-foreground">{card.value}</div>
      <div className="mt-1 min-h-8 text-[11px] leading-snug text-muted-foreground">
        {card.detail}
      </div>
    </div>
  );
}

function ComparisonRowView({ row }: { row: ComparisonRow }) {
  return (
    <tr className="border-b border-border/70 last:border-0">
      <td className="px-4 py-3 font-medium text-foreground">{row.version}</td>
      <td className="num px-3 py-3 text-right text-primary">{pct(row.sais)}</td>
      <td className="num px-3 py-3 text-right text-foreground">{pct(row.correctActionRate)}</td>
      <td className="num px-3 py-3 text-right text-amber-200">{pct(row.safeRecoveryRate)}</td>
      <td className="num px-3 py-3 text-right text-alert">{pct(row.dangerousErrorRate)}</td>
      <td className="num px-3 py-3 text-right text-muted-foreground">{pct(row.wer)}</td>
      <td className="px-4 py-3 text-muted-foreground">{row.note}</td>
    </tr>
  );
}

function OutcomeRow({ row }: { row: InteractionOutcome }) {
  const badgeClass =
    row.decisionType === "correct_action"
      ? "border-ok/40 bg-ok/10 text-ok"
      : row.decisionType === "safe_recovery"
        ? "border-amber-400/40 bg-amber-400/10 text-amber-200"
        : "border-alert/50 bg-alert/10 text-alert";
  return (
    <tr className="border-b border-border/70 last:border-0">
      <td className="px-4 py-3 text-foreground">{row.expected}</td>
      <td className="px-3 py-3 text-muted-foreground">{row.heard}</td>
      <td className="px-3 py-3 text-foreground">{row.action}</td>
      <td className="px-3 py-3">
        <span className={["mono rounded-full border px-2 py-1 text-[9px] uppercase", badgeClass].join(" ")}>
          {row.decisionType.replace("_", " ")}
        </span>
      </td>
      <td className="px-3 py-3 text-muted-foreground">{row.reason}</td>
    </tr>
  );
}

function pct(value: number) {
  return `${Math.round(value * 100)}%`;
}

