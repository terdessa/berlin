import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Activity } from "lucide-react";
import { audioMetricsDashboard } from "@/lib/audio-metrics-data";

const STATUS_DOT: Record<"pass" | "warn" | "fail", string> = {
  pass: "bg-ok",
  warn: "bg-amber-400",
  fail: "bg-alert",
};

export function MetricsPanel() {
  const overall = audioMetricsDashboard.conditionComparison.find((row) => row.id === "overall");
  const sais = Math.round((overall?.sais ?? 0) * 100);
  const danger = Math.round((overall?.dangerousErrorRate ?? 0) * 100);
  const correct = Math.round((overall?.correctActionRate ?? 0) * 100);
  const safe = Math.round((overall?.safeRecoveryRate ?? 0) * 100);
  const transcribed = overall?.transcribed ?? 0;
  const clips = overall?.clips ?? 0;

  const signals = audioMetricsDashboard.qualitySignals;
  const stages = audioMetricsDashboard.pipelineStages.slice(0, 5);
  const conditions = audioMetricsDashboard.conditionComparison.filter(
    (row) => row.id !== "overall",
  );

  return (
    <section
      aria-label="Audio intelligence metrics"
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-border/60 bg-panel/30"
    >
      <header className="flex items-center justify-between gap-2 border-b border-border/60 bg-panel-elevated/35 px-3 py-2">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <div className="mono text-[14px] uppercase tracking-[0.2em] text-primary">metrics</div>
        </div>
        <Link
          to="/metrics"
          title="Open the Audio Intelligence bench"
          className="mono inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[9px] uppercase tracking-[0.14em] text-primary transition-colors duration-200 hover:border-primary/60 hover:bg-primary/15"
        >
          bench
          <ArrowUpRight className="h-3 w-3" />
        </Link>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 py-3">
        <div className="grid grid-cols-2 gap-2">
          <Stat label="SAIS" value={`${sais}%`} tone="primary" />
          <Stat label="Danger" value={`${danger}%`} tone={danger > 0 ? "alert" : "muted"} />
          <Stat label="Correct" value={`${correct}%`} tone="muted" />
          <Stat label="Safe recovery" value={`${safe}%`} tone="muted" />
        </div>

        <div className="flex items-center justify-between rounded-md border border-border/60 bg-background/40 px-2.5 py-1.5">
          <span className="mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground/80">
            Scored
          </span>
          <span className="mono tabular-nums text-[14px] text-foreground">
            {transcribed}
            <span className="text-muted-foreground"> / {clips}</span>
          </span>
        </div>

        <Section title="Quality signals">
          <ul className="flex flex-col gap-1">
            {signals.map((s) => (
              <li
                key={s.signal}
                className="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-background/40 px-2 py-1.5"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    aria-hidden
                    className={["h-1.5 w-1.5 shrink-0 rounded-full", STATUS_DOT[s.status]].join(
                      " ",
                    )}
                  />
                  <span className="truncate text-[14px] text-foreground">{s.signal}</span>
                </div>
                <span className="mono shrink-0 tabular-nums text-[14px] font-semibold text-foreground">
                  {s.value}
                </span>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Pipeline">
          <ul className="flex flex-col gap-1">
            {stages.map((s) => (
              <li
                key={s.stage}
                className="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-background/40 px-2 py-1.5"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    aria-hidden
                    className={["h-1.5 w-1.5 shrink-0 rounded-full", STATUS_DOT[s.status]].join(
                      " ",
                    )}
                  />
                  <span className="truncate text-[14px] text-foreground">{s.stage}</span>
                </div>
                <span className="mono shrink-0 tabular-nums text-[14px] font-semibold text-foreground">
                  {s.value}
                </span>
              </li>
            ))}
          </ul>
        </Section>

        {conditions.length > 0 ? (
          <Section title="By condition">
            <ul className="flex flex-col gap-1">
              {conditions.map((row) => (
                <li
                  key={row.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-background/40 px-2 py-1.5"
                >
                  <span className="truncate text-[14px] text-foreground">{row.version}</span>
                  <span className="mono shrink-0 tabular-nums text-[14px] font-semibold text-foreground">
                    SAIS {Math.round((row.sais ?? 0) * 100)}%
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        ) : null}
      </div>
    </section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="mono text-[12px] uppercase tracking-[0.18em] text-muted-foreground">
        {title}
      </div>
      {children}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "primary" | "alert" | "muted";
}) {
  const valueClass =
    tone === "primary" ? "text-primary" : tone === "alert" ? "text-alert" : "text-foreground";
  return (
    <div className="flex flex-col gap-0.5 rounded-md border border-border/60 bg-background/40 px-2 py-1.5">
      <div className="mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground/80">
        {label}
      </div>
      <div className={["mono text-xl tabular-nums leading-tight", valueClass].join(" ")}>
        {value}
      </div>
    </div>
  );
}
