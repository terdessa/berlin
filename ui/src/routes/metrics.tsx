import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Database,
  FileJson,
  Gauge,
  GitCompareArrows,
  ListChecks,
  Mic2,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import {
  PUBLIC_AUDIO_RESULTS_PATH,
  audioMetricsDashboard,
  buildAudioMetricsDashboard,
  parseAudioBenchmarkJson,
  type AudioMetricsDashboard,
  type CommandPerformance,
  type ComparisonRow,
  type FailureBreakdown,
  type InteractionOutcome,
  type PipelineStage,
  type QualitySignal,
} from "@/lib/audio-metrics-data";

export const Route = createFileRoute("/metrics")({
  component: MetricsPage,
  head: () => ({
    meta: [
      { title: "Sentinel - Submission Metrics" },
      {
        name: "description",
        content:
          "Submission-ready Sentinel Audio Intelligence Score dashboard for noisy retail voice commands.",
      },
    ],
  }),
});

function MetricsPage() {
  const [dashboard, setDashboard] = useState<AudioMetricsDashboard>(audioMetricsDashboard);
  const [loadState, setLoadState] = useState<"bundled" | "public" | "missing" | "invalid">(
    "bundled",
  );

  useEffect(() => {
    let cancelled = false;

    fetch(PUBLIC_AUDIO_RESULTS_PATH, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          if (!cancelled) setLoadState("missing");
          return;
        }

        const text = await response.text();
        const payload = parseAudioBenchmarkJson(text);

        if (!cancelled) {
          setDashboard(buildAudioMetricsDashboard(payload, PUBLIC_AUDIO_RESULTS_PATH));
          setLoadState("public");
        }
      })
      .catch(() => {
        if (!cancelled) setLoadState("invalid");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const model = useMemo(() => buildSubmissionModel(dashboard), [dashboard]);

  return (
    <main className="min-h-screen bg-background px-4 py-4 text-foreground sm:px-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <header className="grid gap-4 border-b border-border/70 pb-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to="/"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background/60 text-muted-foreground transition hover:border-primary/50 hover:text-foreground"
                aria-label="Back to dashboard"
                title="Back to dashboard"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <span className="mono rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-primary">
                telli + ai-coustics submission
              </span>
              <SourceBadge source={dashboard.source} loadState={loadState} />
            </div>
            <h1 className="mt-3 max-w-4xl text-3xl font-semibold leading-tight text-foreground">
              Sentinel Audio Intelligence Score
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              A reproducible quality dashboard for noisy retail guard commands. It measures the four
              required audio-health signals, then scores the application outcome: correct action,
              safe recovery, or dangerous error.
            </p>
          </div>

          <div className="grid min-w-[280px] gap-2 sm:grid-cols-2 lg:grid-cols-1">
            <SubmissionStatus model={model} />
            <SourceSummary source={dashboard.source} loadState={loadState} />
          </div>
        </header>

        {dashboard.warnings.length > 0 ? (
          <section className="rounded-md border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-xs text-amber-100">
            {dashboard.warnings.join(" ")}
          </section>
        ) : null}

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
          <HeroScore model={model} />
          <RequirementChecklist rows={dashboard.qualitySignals} model={model} />
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
          <SystemLiftPanel rows={dashboard.systemComparison} model={model} />
          <ConditionPanel rows={dashboard.conditionComparison} />
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(300px,0.72fr)_minmax(0,1.28fr)]">
          <div className="grid gap-4">
            <CoveragePanel items={dashboard.stressCoverage} />
            <FailurePanel items={dashboard.failureBreakdown} />
          </div>
          <CommandMatrix rows={dashboard.commandPerformance} />
        </section>

        <PipelinePanel rows={dashboard.pipelineStages} />
        <CorpusPanel rows={dashboard.outcomes} />
      </div>
    </main>
  );
}

function buildSubmissionModel(dashboard: AudioMetricsDashboard) {
  const overall = dashboard.conditionComparison.find((row) => row.id === "overall");
  const clean = dashboard.conditionComparison.find((row) => row.id === "clean");
  const noisy = dashboard.conditionComparison.find((row) => row.id === "noisy");
  const raw = dashboard.systemComparison.find((row) => row.id === "raw_noisy");
  const enhanced = dashboard.systemComparison.find((row) => row.id === "aicoustics_only");
  const final = dashboard.systemComparison.find((row) => row.id === "aicoustics_plus_sentinel");
  const allScored = Boolean(overall?.clips && overall.clips === overall.transcribed);
  const noDanger = overall?.dangerousErrorRate === 0;
  const targetHit = (overall?.sais ?? 0) >= 0.9;

  return {
    overall,
    clean,
    noisy,
    raw,
    enhanced,
    final,
    allScored,
    noDanger,
    targetHit,
    ready: allScored && noDanger && targetHit,
    clips: overall?.clips ?? null,
    transcribed: overall?.transcribed ?? null,
    sais: overall?.sais ?? null,
    correct: overall?.correctActionRate ?? null,
    recovery: overall?.safeRecoveryRate ?? null,
    danger: overall?.dangerousErrorRate ?? null,
    wer: overall?.wer ?? null,
    confidence: overall?.avgConfidence ?? null,
    cleanWer: clean?.wer ?? null,
    noisyWer: noisy?.wer ?? null,
    rawSais: raw?.sais ?? null,
    finalSais: final?.sais ?? null,
    rawDanger: raw?.dangerousErrorRate ?? null,
    finalDanger: final?.dangerousErrorRate ?? null,
    saisLift: raw?.sais != null && final?.sais != null ? Math.max(0, final.sais - raw.sais) : null,
    dangerReduction:
      raw?.dangerousErrorRate != null && final?.dangerousErrorRate != null
        ? Math.max(0, raw.dangerousErrorRate - final.dangerousErrorRate)
        : null,
  };
}

function SourceBadge({
  source,
  loadState,
}: {
  source: string;
  loadState: "bundled" | "public" | "missing" | "invalid";
}) {
  const label =
    loadState === "public"
      ? "public JSON"
      : loadState === "invalid"
        ? "bundled JSON"
        : "bundled JSON";

  return (
    <span
      className="mono rounded-full border border-border bg-panel/70 px-2.5 py-1 text-[9px] uppercase tracking-[0.14em] text-muted-foreground"
      title={source}
    >
      {label}
    </span>
  );
}

function SubmissionStatus({ model }: { model: ReturnType<typeof buildSubmissionModel> }) {
  return (
    <div
      className={[
        "rounded-md border px-3 py-2",
        model.ready ? "border-ok/45 bg-ok/10" : "border-amber-400/40 bg-amber-400/10",
      ].join(" ")}
    >
      <div className="flex items-center gap-2">
        {model.ready ? (
          <ShieldCheck className="h-4 w-4 text-ok" />
        ) : (
          <AlertTriangle className="h-4 w-4 text-amber-200" />
        )}
        <span className="mono text-[10px] uppercase tracking-[0.16em] text-foreground">
          {model.ready ? "submission ready" : "needs review"}
        </span>
      </div>
      <div className="mt-1 text-[11px] leading-snug text-muted-foreground">
        {model.ready
          ? "All benchmark clips scored, SAIS target met, zero dangerous actions."
          : "One or more submission checks are not passing."}
      </div>
    </div>
  );
}

function SourceSummary({
  source,
  loadState,
}: {
  source: string;
  loadState: "bundled" | "public" | "missing" | "invalid";
}) {
  return (
    <div className="rounded-md border border-border bg-panel/70 px-3 py-2">
      <div className="flex items-center gap-2">
        <FileJson className="h-4 w-4 text-primary" />
        <span className="mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          result source
        </span>
      </div>
      <div className="mt-1 truncate text-[11px] text-foreground" title={source}>
        {source}
      </div>
      {loadState === "missing" || loadState === "invalid" ? (
        <div className="mt-1 text-[10px] text-amber-200">
          Public result unavailable; bundled generated benchmark is shown.
        </div>
      ) : null}
    </div>
  );
}

function HeroScore({ model }: { model: ReturnType<typeof buildSubmissionModel> }) {
  return (
    <section className="overflow-hidden rounded-lg border border-primary/35 bg-panel/85">
      <div className="grid md:grid-cols-[1fr_0.78fr]">
        <div className="border-b border-border p-5 md:border-b-0 md:border-r">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <span className="mono text-[10px] uppercase tracking-[0.2em] text-primary">
              final score
            </span>
          </div>
          <div className="mt-5 flex flex-wrap items-end gap-x-4 gap-y-2">
            <span className="num text-7xl font-semibold leading-none text-foreground">
              {pct(model.sais)}
            </span>
            <div className="pb-1">
              <div className="mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                SAIS
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                (correct actions + safe recoveries) / scored commands
              </div>
            </div>
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            <ScoreTile
              icon={<Database className="h-3.5 w-3.5" />}
              label="scored clips"
              value={`${count(model.transcribed)}/${count(model.clips)}`}
              tone={model.allScored ? "ok" : "warn"}
            />
            <ScoreTile
              icon={<CheckCircle2 className="h-3.5 w-3.5" />}
              label="safe outcome"
              value={pct(model.sais)}
              tone="primary"
            />
            <ScoreTile
              icon={<AlertTriangle className="h-3.5 w-3.5" />}
              label="dangerous action"
              value={pct(model.danger)}
              tone={model.noDanger ? "ok" : "alert"}
            />
          </div>
        </div>

        <div className="p-5">
          <div className="mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            action policy
          </div>
          <DecisionBar correct={model.correct} recovery={model.recovery} danger={model.danger} />
          <div className="mt-4 grid gap-2">
            <PolicyRow label="correct actions" value={pct(model.correct)} tone="ok" />
            <PolicyRow label="safe recoveries" value={pct(model.recovery)} tone="warn" />
            <PolicyRow label="dangerous errors" value={pct(model.danger)} tone="alert" />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <SmallFact label="overall WER" value={pct(model.wer)} />
            <SmallFact label="avg confidence" value={pct(model.confidence)} />
          </div>
        </div>
      </div>
    </section>
  );
}

function ScoreTile({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  tone: "primary" | "ok" | "warn" | "alert";
}) {
  return (
    <div className={["rounded-md border px-3 py-2", toneClass(tone)].join(" ")}>
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="mono text-[9px] uppercase tracking-[0.16em]">{label}</span>
      </div>
      <div className="num mt-1 text-xl font-semibold text-foreground">{value}</div>
    </div>
  );
}

function DecisionBar({
  correct,
  recovery,
  danger,
}: {
  correct: number | null;
  recovery: number | null;
  danger: number | null;
}) {
  return (
    <div className="mt-3 overflow-hidden rounded-full border border-border bg-muted">
      <div className="flex h-3 w-full">
        <div className="bg-ok" style={{ width: pctWidth(correct) }} />
        <div className="bg-amber-300" style={{ width: pctWidth(recovery) }} />
        <div className="bg-alert" style={{ width: pctWidth(danger) }} />
      </div>
    </div>
  );
}

function PolicyRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "ok" | "warn" | "alert";
}) {
  const color = tone === "ok" ? "text-ok" : tone === "warn" ? "text-amber-200" : "text-alert";
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border border-border bg-background/30 px-3 py-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={["num text-sm font-semibold", color].join(" ")}>{value}</span>
    </div>
  );
}

function SmallFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background/25 px-3 py-2">
      <div className="mono text-[8px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </div>
      <div className="num mt-1 text-sm font-semibold text-foreground">{value}</div>
    </div>
  );
}

function RequirementChecklist({
  rows,
  model,
}: {
  rows: QualitySignal[];
  model: ReturnType<typeof buildSubmissionModel>;
}) {
  const requirements = [
    {
      label: "audio quality",
      detail: rows.find((row) => row.signal === "Non-intrusive MOS"),
      icon: <Gauge className="h-4 w-4" />,
    },
    {
      label: "WER under noise",
      detail: rows.find((row) => row.signal === "WER under noise"),
      icon: <Mic2 className="h-4 w-4" />,
    },
    {
      label: "VAD miss-rate",
      detail: rows.find((row) => row.signal === "VAD miss-rate"),
      icon: <Activity className="h-4 w-4" />,
    },
    {
      label: "input level",
      detail: rows.find((row) => row.signal === "Input level"),
      icon: <SlidersHorizontal className="h-4 w-4" />,
    },
    {
      label: "task completion",
      detail: rows.find((row) => row.signal === "Task completion"),
      icon: <ShieldCheck className="h-4 w-4" />,
    },
  ];

  return (
    <section className="rounded-lg border border-border bg-panel/85">
      <SectionHeader
        icon={<ListChecks className="h-4 w-4 text-primary" />}
        title="submission checklist"
        detail="The required quality-dashboard signals plus Sentinel's app-specific score."
      />
      <div className="divide-y divide-border">
        {requirements.map(({ label, detail, icon }) => (
          <div key={label} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3">
            <span className="text-primary">{icon}</span>
            <div className="min-w-0">
              <div className="text-sm font-medium text-foreground">{label}</div>
              <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                {detail?.threshold ?? "tracked"}
              </div>
            </div>
            <div className="text-right">
              <div className="num text-sm font-semibold text-foreground">
                {detail?.value ?? "n/a"}
              </div>
              <StatusBadge status={detail?.status ?? "warn"} />
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-border px-4 py-3">
        <div className="grid grid-cols-3 gap-2">
          <SmallFact label="target" value=">= 90%" />
          <SmallFact label="actual" value={pct(model.sais)} />
          <SmallFact label="danger" value={pct(model.danger)} />
        </div>
      </div>
    </section>
  );
}

function SystemLiftPanel({
  rows,
  model,
}: {
  rows: ComparisonRow[];
  model: ReturnType<typeof buildSubmissionModel>;
}) {
  return (
    <section className="rounded-lg border border-border bg-panel/85">
      <SectionHeader
        icon={<GitCompareArrows className="h-4 w-4 text-primary" />}
        title="system lift"
        detail="The measured contribution from raw audio, ai-coustics enhancement, and Sentinel validation."
      />
      <div className="grid gap-3 border-b border-border p-4 sm:grid-cols-2">
        <ImpactStat label="SAIS lift" value={signedPct(model.saisLift)} tone="primary" />
        <ImpactStat label="danger reduction" value={signedPct(model.dangerReduction)} tone="ok" />
      </div>
      {rows.length > 0 ? (
        <div className="divide-y divide-border">
          {rows.map((row, index) => (
            <SystemStep key={row.id} row={row} index={index} />
          ))}
        </div>
      ) : (
        <EmptyState text="No system comparison rows were found in this result file." />
      )}
    </section>
  );
}

function ImpactStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "primary" | "ok";
}) {
  const color = tone === "primary" ? "text-primary" : "text-ok";
  return (
    <div className="rounded-md border border-border bg-background/30 px-3 py-3">
      <div className="mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </div>
      <div className={["num mt-1 text-2xl font-semibold", color].join(" ")}>{value}</div>
    </div>
  );
}

function SystemStep({ row, index }: { row: ComparisonRow; index: number }) {
  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
            stage {index + 1}
          </div>
          <div className="mt-0.5 text-sm font-medium text-foreground">{row.version}</div>
        </div>
        <StatusBadge status={row.dangerousErrorRate === 0 ? "pass" : "warn"} />
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <MetricBar label="SAIS" value={row.sais} tone="primary" />
        <MetricBar label="danger" value={row.dangerousErrorRate} tone="alert" />
      </div>
    </div>
  );
}

function ConditionPanel({ rows }: { rows: ComparisonRow[] }) {
  return (
    <section className="rounded-lg border border-border bg-panel/85">
      <SectionHeader
        icon={<Mic2 className="h-4 w-4 text-primary" />}
        title="clean vs noisy"
        detail="The same scoring policy applied across recording conditions."
      />
      <div className="divide-y divide-border">
        {rows.map((row) => (
          <ConditionRow key={row.id} row={row} />
        ))}
      </div>
    </section>
  );
}

function ConditionRow({ row }: { row: ComparisonRow }) {
  return (
    <div className="grid gap-3 px-4 py-3 lg:grid-cols-[minmax(0,1fr)_230px] lg:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-foreground">{row.version}</span>
          <span className="mono rounded-full border border-border bg-background/40 px-2 py-0.5 text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
            {count(row.transcribed)}/{count(row.clips)} clips
          </span>
        </div>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          <MetricBar label="SAIS" value={row.sais} tone="primary" />
          <MetricBar label="WER" value={row.wer} tone="neutral" />
          <MetricBar label="confidence" value={row.avgConfidence} tone="ok" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <SmallNumber label="correct" value={pct(row.correctActionRate)} />
        <SmallNumber label="recover" value={pct(row.safeRecoveryRate)} />
        <SmallNumber label="danger" value={pct(row.dangerousErrorRate)} tone="alert" />
      </div>
    </div>
  );
}

function CoveragePanel({
  items,
}: {
  items: Array<{ label: string; value: string; detail: string }>;
}) {
  return (
    <section className="rounded-lg border border-border bg-panel/85">
      <SectionHeader
        icon={<Database className="h-4 w-4 text-primary" />}
        title="evidence pack"
        detail="The recorded corpus behind the score."
      />
      <div className="grid gap-0 sm:grid-cols-2 xl:grid-cols-1">
        {items.map((item) => (
          <div key={item.label} className="border-b border-border/70 px-4 py-3 last:border-b-0">
            <div className="mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
              {item.label}
            </div>
            <div className="num mt-1 text-2xl font-semibold text-foreground">{item.value}</div>
            <div className="mt-1 text-[11px] leading-snug text-muted-foreground">{item.detail}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function FailurePanel({ items }: { items: FailureBreakdown[] }) {
  return (
    <section className="rounded-lg border border-border bg-panel/85">
      <SectionHeader
        icon={<AlertTriangle className="h-4 w-4 text-alert" />}
        title="recoveries"
        detail="Uncertain commands are classified and held instead of executed unsafely."
      />
      {items.length > 0 ? (
        <div className="space-y-3 px-4 py-4">
          {items.map((item) => (
            <div key={item.label}>
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="text-foreground">{humanize(item.label)}</span>
                <span className="mono text-muted-foreground">
                  {item.count} / {pct(item.pct)}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-amber-300" style={{ width: pctWidth(item.pct) }} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState text="No failures or missing-transcript records were found." />
      )}
    </section>
  );
}

function CommandMatrix({ rows }: { rows: CommandPerformance[] }) {
  return (
    <section className="rounded-lg border border-border bg-panel/85">
      <SectionHeader
        icon={<Activity className="h-4 w-4 text-primary" />}
        title="command matrix"
        detail="Coverage and safety by expected guard command."
      />
      {rows.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[840px] text-left text-xs">
            <thead className="border-b border-border bg-panel-elevated/60">
              <tr className="mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                <th className="px-4 py-3 font-medium">command</th>
                <th className="px-3 py-3 text-right font-medium">clips</th>
                <th className="px-3 py-3 text-right font-medium">SAIS</th>
                <th className="px-3 py-3 text-right font-medium">correct</th>
                <th className="px-3 py-3 text-right font-medium">recovery</th>
                <th className="px-3 py-3 text-right font-medium">danger</th>
                <th className="px-3 py-3 text-right font-medium">WER</th>
                <th className="px-4 py-3 text-right font-medium">confidence</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.command} className="border-b border-border/70 last:border-0">
                  <td className="px-4 py-3 font-medium text-foreground">{humanize(row.command)}</td>
                  <td className="num px-3 py-3 text-right text-muted-foreground">
                    {row.transcribed}/{row.clips}
                  </td>
                  <td className="num px-3 py-3 text-right text-primary">{pct(row.sais)}</td>
                  <td className="num px-3 py-3 text-right text-foreground">
                    {pct(row.correctActionRate)}
                  </td>
                  <td className="num px-3 py-3 text-right text-amber-200">
                    {pct(row.safeRecoveryRate)}
                  </td>
                  <td className="num px-3 py-3 text-right text-alert">
                    {pct(row.dangerousErrorRate)}
                  </td>
                  <td className="num px-3 py-3 text-right text-muted-foreground">{pct(row.wer)}</td>
                  <td className="num px-4 py-3 text-right text-muted-foreground">
                    {pct(row.avgConfidence)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState text="No command rows were found in this result file." />
      )}
    </section>
  );
}

function PipelinePanel({ rows }: { rows: PipelineStage[] }) {
  return (
    <section className="rounded-lg border border-border bg-panel/85">
      <SectionHeader
        icon={<Gauge className="h-4 w-4 text-primary" />}
        title="pipeline audit"
        detail="Capture, quality, speech detection, recognition, and final decision are all scored."
      />
      <div className="grid gap-0 md:grid-cols-5">
        {rows.map((row) => (
          <div
            key={row.stage}
            className="border-b border-border px-4 py-3 md:border-b-0 md:border-r md:last:border-r-0"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
                {row.stage}
              </span>
              <StatusDot status={row.status} />
            </div>
            <div className="num mt-2 text-lg font-semibold text-foreground">{row.value}</div>
            <div className="mt-1 text-[11px] leading-snug text-muted-foreground">{row.signal}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function CorpusPanel({ rows }: { rows: InteractionOutcome[] }) {
  const recentRows = rows.slice(-10).reverse();

  return (
    <section className="rounded-lg border border-border bg-panel/85">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <div className="mono text-[11px] uppercase tracking-[0.2em] text-foreground">
            scored records
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Recent benchmark rows are shown first; the full corpus remains available below.
          </div>
        </div>
        <span className="mono rounded-full border border-border bg-background/40 px-2.5 py-1 text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
          {rows.length} records
        </span>
      </div>
      <OutcomesTable rows={recentRows} compact />
      {rows.length > recentRows.length ? (
        <details className="border-t border-border">
          <summary className="mono cursor-pointer select-none px-4 py-3 text-[10px] uppercase tracking-[0.18em] text-muted-foreground transition hover:text-foreground">
            show full corpus table
          </summary>
          <OutcomesTable rows={rows} />
        </details>
      ) : null}
    </section>
  );
}

function OutcomesTable({
  rows,
  compact = false,
}: {
  rows: InteractionOutcome[];
  compact?: boolean;
}) {
  if (rows.length === 0) {
    return <EmptyState text="No benchmark outcome rows were found." />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] text-left text-xs">
        <thead className="border-b border-border bg-panel-elevated/60">
          <tr className="mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            <th className="px-4 py-3 font-medium">clip</th>
            <th className="px-3 py-3 font-medium">condition</th>
            <th className="px-3 py-3 font-medium">expected</th>
            <th className="px-3 py-3 font-medium">heard</th>
            {!compact ? <th className="px-3 py-3 font-medium">action</th> : null}
            <th className="px-3 py-3 font-medium">decision</th>
            <th className="px-3 py-3 text-right font-medium">conf</th>
            <th className="px-3 py-3 text-right font-medium">WER</th>
            {!compact ? <th className="px-4 py-3 font-medium">reason</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <OutcomeRow key={row.id} row={row} compact={compact} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OutcomeRow({ row, compact }: { row: InteractionOutcome; compact: boolean }) {
  return (
    <tr className="border-b border-border/70 last:border-0">
      <td className="px-4 py-3 text-muted-foreground">{row.id}</td>
      <td className="px-3 py-3 text-muted-foreground">
        {row.system ? `${row.condition} / ${row.system}` : row.condition}
      </td>
      <td className="px-3 py-3 text-foreground">{humanize(row.expected)}</td>
      <td className="px-3 py-3 text-muted-foreground">{row.heard || "not transcribed"}</td>
      {!compact ? <td className="px-3 py-3 text-foreground">{humanize(row.action)}</td> : null}
      <td className="px-3 py-3">
        <DecisionBadge decision={row.decisionType} />
      </td>
      <td className="num px-3 py-3 text-right text-muted-foreground">{pct(row.confidence)}</td>
      <td className="num px-3 py-3 text-right text-muted-foreground">{pct(row.wer)}</td>
      {!compact ? (
        <td className="px-4 py-3 text-muted-foreground">{humanize(row.reason)}</td>
      ) : null}
    </tr>
  );
}

function SectionHeader({
  icon,
  title,
  detail,
}: {
  icon: ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <div className="border-b border-border px-4 py-3">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="mono text-[11px] uppercase tracking-[0.2em] text-foreground">{title}</h2>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function MetricBar({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | null;
  tone: "primary" | "ok" | "alert" | "neutral";
}) {
  const color =
    tone === "primary"
      ? "bg-primary"
      : tone === "ok"
        ? "bg-ok"
        : tone === "alert"
          ? "bg-alert"
          : "bg-muted-foreground";

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <span className="mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </span>
        <span className="num text-[10px] text-muted-foreground">{pct(value)}</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className={["h-full", color].join(" ")} style={{ width: pctWidth(value) }} />
      </div>
    </div>
  );
}

function SmallNumber({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "alert";
}) {
  return (
    <div className="rounded-md border border-border bg-background/30 px-2 py-2 text-right">
      <div className="mono text-[8px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </div>
      <div
        className={[
          "num mt-1 text-sm font-semibold",
          tone === "alert" ? "text-alert" : "text-foreground",
        ].join(" ")}
      >
        {value}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: "pass" | "warn" | "fail" }) {
  return (
    <span
      className={[
        "mono mt-1 inline-flex rounded-full border px-2 py-0.5 text-[8px] uppercase tracking-[0.12em]",
        statusClass(status),
      ].join(" ")}
    >
      {status}
    </span>
  );
}

function StatusDot({ status }: { status: "pass" | "warn" | "fail" }) {
  const color = status === "pass" ? "bg-ok" : status === "fail" ? "bg-alert" : "bg-amber-300";
  return <span className={["h-2 w-2 rounded-full", color].join(" ")} title={status} />;
}

function DecisionBadge({ decision }: { decision: InteractionOutcome["decisionType"] }) {
  const className =
    decision === "correct_action"
      ? "border-ok/40 bg-ok/10 text-ok"
      : decision === "safe_recovery"
        ? "border-amber-400/40 bg-amber-400/10 text-amber-200"
        : decision === "dangerous_error"
          ? "border-alert/50 bg-alert/10 text-alert"
          : "border-border bg-muted/20 text-muted-foreground";

  return (
    <span
      className={["mono rounded-full border px-2 py-1 text-[9px] uppercase", className].join(" ")}
    >
      {humanize(decision)}
    </span>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="px-4 py-6 text-xs text-muted-foreground">{text}</div>;
}

function pct(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "n/a";
  return `${Math.round(value * 100)}%`;
}

function signedPct(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "n/a";
  return `+${Math.round(value * 100)} pts`;
}

function pctWidth(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "0%";
  return `${Math.max(0, Math.min(100, Math.round(value * 100)))}%`;
}

function count(value: number | null | undefined) {
  return value == null ? "n/a" : String(value);
}

function humanize(value: string) {
  return value.replace(/[_-]+/g, " ");
}

function toneClass(tone: "primary" | "ok" | "warn" | "alert") {
  if (tone === "primary") return "border-primary/45 bg-primary/10";
  if (tone === "ok") return "border-ok/40 bg-ok/10";
  if (tone === "warn") return "border-amber-400/40 bg-amber-400/10";
  return "border-alert/45 bg-alert/10";
}

function statusClass(status: "pass" | "warn" | "fail") {
  if (status === "pass") return "border-ok/40 bg-ok/10 text-ok";
  if (status === "fail") return "border-alert/50 bg-alert/10 text-alert";
  return "border-amber-400/40 bg-amber-400/10 text-amber-200";
}
