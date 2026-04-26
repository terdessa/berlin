import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Database,
  Download,
  Gauge,
  GitCompareArrows,
  ListChecks,
  Loader2,
  Mic2,
  Play,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  SlidersHorizontal,
  Square,
  Timer,
} from "lucide-react";
import {
  audioMetricsDashboard,
  type AudioMetricsDashboard,
  type CommandPerformance,
  type ComparisonRow,
  type FailureBreakdown,
  type InteractionOutcome,
  type PipelineStage,
  type QualitySignal,
} from "@/lib/audio-metrics-data";
import {
  benchTotal,
  buildAggregate,
  clearRun,
  downloadRun,
  formatRelativeTime,
  loadRun,
  runBench,
  saveRun,
  type BenchAggregate,
  type BenchRun,
  type ClipMetric,
} from "@/lib/audio-bench";

export const Route = createFileRoute("/metrics")({
  component: MetricsPage,
  head: () => ({
    meta: [
      { title: "Sentinel — Audio Intelligence Bench" },
      {
        name: "description",
        content:
          "Live ai-coustics enhancement bench plus the Sentinel Audio Intelligence Score dashboard.",
      },
    ],
  }),
});

type RunState =
  | { status: "idle" }
  | { status: "running"; done: number; total: number; current?: string; clips: ClipMetric[] }
  | { status: "complete"; run: BenchRun }
  | { status: "error"; message: string; partial: ClipMetric[] };

function MetricsPage() {
  const dashboard = audioMetricsDashboard;
  const model = useMemo(() => buildSubmissionModel(dashboard), [dashboard]);

  const [runState, setRunState] = useState<RunState>({ status: "idle" });
  const [, setTick] = useState(0);
  const cancelRef = useRef(false);

  useEffect(() => {
    const saved = loadRun();
    if (saved) setRunState({ status: "complete", run: saved });
  }, []);

  useEffect(() => {
    if (runState.status !== "complete") return;
    const id = window.setInterval(() => setTick((t) => t + 1), 30000);
    return () => window.clearInterval(id);
  }, [runState.status]);

  const liveRun: BenchRun | null = runState.status === "complete" ? runState.run : null;
  const liveClips = useMemo<ClipMetric[]>(() => {
    if (runState.status === "running") return runState.clips;
    if (runState.status === "complete") return runState.run.clips;
    if (runState.status === "error") return runState.partial;
    return [];
  }, [runState]);
  const liveAggregate: BenchRun["aggregate"] | null = useMemo(() => {
    if (liveRun) return liveRun.aggregate;
    if (liveClips.length === 0) return null;
    return buildAggregate(liveClips);
  }, [liveRun, liveClips]);

  async function startRun() {
    cancelRef.current = false;
    setRunState({ status: "running", done: 0, total: benchTotal, clips: [] });
    try {
      const collected: ClipMetric[] = [];
      const run = await runBench(
        (p) => {
          if (cancelRef.current) throw new Error("__cancelled__");
          setRunState({
            status: "running",
            done: p.done,
            total: p.total,
            current: p.current?.id,
            clips: [...collected],
          });
        },
        (m) => collected.push(m),
      );
      setRunState({ status: "complete", run });
      saveRun(run);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === "__cancelled__") {
        setRunState({ status: "idle" });
      } else {
        setRunState({
          status: "error",
          message: msg,
          partial: runState.status === "running" ? runState.clips : [],
        });
      }
    }
  }

  function cancelRun() {
    cancelRef.current = true;
  }

  function rerun() {
    clearRun();
    startRun();
  }

  function handleDownload() {
    if (liveRun) downloadRun(liveRun);
  }

  return (
    <main
      id="main"
      className="relative min-h-screen overflow-x-clip bg-background px-4 py-5 text-foreground sm:px-6"
    >
      <PageGlow />
      <div className="relative mx-auto flex max-w-7xl flex-col gap-5">
        <RunControlBar
          state={runState}
          liveRun={liveRun}
          onRun={startRun}
          onCancel={cancelRun}
          onRerun={rerun}
          onDownload={handleDownload}
        />

        <header className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to="/"
                className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-border bg-background/60 text-muted-foreground transition-colors duration-200 hover:border-primary/50 hover:text-foreground"
                aria-label="Back to dashboard"
                title="Back to dashboard"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <span className="mono rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-primary">
                ai-coustics submission
              </span>
              <SourceBadge source={dashboard.source} />
            </div>
            <h1 className="mt-3 max-w-4xl text-[2rem] font-semibold leading-[1.15] tracking-tight text-foreground">
              Sentinel Audio Intelligence Bench
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              48 retail guard commands. ai-coustics enhancement measured live in-browser, joined to
              the offline SAIS benchmark.
            </p>
          </div>

          <div className="lg:min-w-[260px]">
            <SubmissionStatus model={model} />
          </div>
        </header>

        {dashboard.warnings.length > 0 ? (
          <section className="rounded-md border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-xs text-amber-100">
            {dashboard.warnings.join(" ")}
          </section>
        ) : null}

        <SystemLiftHero
          rows={dashboard.systemComparison}
          model={model}
          liveOverall={liveAggregate?.overall ?? null}
        />

        <LivePipelinePanel
          state={runState}
          aggregate={liveAggregate?.overall ?? null}
          clean={liveAggregate?.clean ?? null}
          noisy={liveAggregate?.noisy ?? null}
          totalLatencyMs={liveRun?.totalLatencyMs ?? null}
        />

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.62fr)]">
          <ConditionPanel rows={dashboard.conditionComparison} />
          <RequirementChecklist
            rows={dashboard.qualitySignals}
            model={model}
            liveOverall={liveAggregate?.overall ?? null}
          />
        </section>

        {liveClips.length > 0 ? <LiveClipTable clips={liveClips} /> : null}

        <DrilldownSection>
          <section className="grid gap-4 xl:grid-cols-[minmax(300px,0.72fr)_minmax(0,1.28fr)]">
            <div className="grid gap-4">
              <CoveragePanel items={dashboard.stressCoverage} />
              <FailurePanel items={dashboard.failureBreakdown} />
            </div>
            <CommandMatrix rows={dashboard.commandPerformance} />
          </section>
          <PipelinePanel rows={dashboard.pipelineStages} />
          <CorpusPanel rows={dashboard.outcomes} />
        </DrilldownSection>
      </div>
    </main>
  );
}

function PageGlow() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-[520px] [mask-image:linear-gradient(to_bottom,black,transparent)]"
      style={{
        background:
          "radial-gradient(60% 80% at 50% 0%, color-mix(in oklab, var(--primary) 14%, transparent), transparent 70%)",
      }}
    />
  );
}

function DrilldownSection({ children }: { children: ReactNode }) {
  return (
    <details className="group rounded-xl border border-border/70 bg-panel/40 [&>summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-panel/60">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-primary" />
          <span className="mono text-[11px] uppercase tracking-[0.2em] text-foreground">
            drill-down evidence
          </span>
        </div>
        <ChevronDown
          className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <div className="flex flex-col gap-4 border-t border-border/60 px-4 pb-5 pt-4">{children}</div>
    </details>
  );
}

function RunControlBar({
  state,
  liveRun,
  onRun,
  onCancel,
  onRerun,
  onDownload,
}: {
  state: RunState;
  liveRun: BenchRun | null;
  onRun: () => void;
  onCancel: () => void;
  onRerun: () => void;
  onDownload: () => void;
}) {
  const running = state.status === "running";
  const done = running ? state.done : liveRun ? liveRun.clips.length : 0;
  const total = running ? state.total : benchTotal;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const lastRun = liveRun != null ? formatRelativeTime(liveRun.completedAt) : null;

  return (
    <section
      className={[
        "sticky top-2 z-30 rounded-xl px-4 py-3 backdrop-blur transition-shadow duration-300",
        "border bg-panel/95 supports-[backdrop-filter]:bg-panel/75",
        running
          ? "border-primary/60 shadow-[0_0_0_1px_color-mix(in_oklab,var(--primary)_25%,transparent),0_18px_60px_-30px_color-mix(in_oklab,var(--primary)_60%,transparent)]"
          : liveRun
            ? "border-primary/30"
            : "border-border/80",
      ].join(" ")}
    >
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            live bench
          </span>
          <StatusPill state={state} lastRun={lastRun} />
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {running ? (
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-alert/40 bg-alert/10 px-3 py-1.5 text-xs text-alert transition hover:bg-alert/20"
            >
              <Square className="h-3.5 w-3.5" />
              Cancel
            </button>
          ) : null}

          {!running && liveRun ? (
            <button
              type="button"
              onClick={onDownload}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-background/40 px-3 py-1.5 text-xs text-foreground transition hover:border-primary/40"
            >
              <Download className="h-3.5 w-3.5" />
              Download JSON
            </button>
          ) : null}

          {!running && liveRun ? (
            <button
              type="button"
              onClick={onRerun}
              className="inline-flex cursor-sentinel-play items-center gap-1.5 rounded-md border border-primary/45 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition hover:bg-primary/20"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Rerun
            </button>
          ) : null}

          {!running && !liveRun ? (
            <button
              type="button"
              onClick={onRun}
              className="inline-flex cursor-sentinel-play items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
            >
              <Play className="h-4 w-4" />
              Run all 48 clips
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-2.5 flex items-center gap-3">
        <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={[
              "absolute inset-y-0 left-0 transition-[width] duration-500 ease-out",
              running ? "bg-primary" : liveRun ? "bg-ok" : "bg-muted-foreground/30",
            ].join(" ")}
            style={{ width: `${pct}%` }}
          />
          {running ? <div className="shimmer-strip" aria-hidden /> : null}
        </div>
        <span className="mono shrink-0 text-[10px] tabular-nums text-muted-foreground">
          {done}/{total}
        </span>
      </div>

      {state.status === "error" ? (
        <div className="mt-2 flex items-start gap-2 rounded-md border border-alert/40 bg-alert/10 px-3 py-2 text-xs text-alert">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="break-words">{state.message}</span>
        </div>
      ) : null}
    </section>
  );
}

function StatusPill({ state, lastRun }: { state: RunState; lastRun: string | null }) {
  if (state.status === "running") {
    return (
      <span className="mono inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-primary">
        <Loader2 className="h-3 w-3 animate-spin" />
        running{state.current ? ` · ${shortId(state.current)}` : ""}
      </span>
    );
  }
  if (state.status === "complete") {
    return (
      <span className="mono inline-flex items-center gap-1.5 rounded-full border border-ok/40 bg-ok/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-ok">
        <CheckCircle2 className="h-3 w-3" />
        complete · {lastRun ?? "just now"}
      </span>
    );
  }
  if (state.status === "error") {
    return (
      <span className="mono inline-flex items-center gap-1.5 rounded-full border border-alert/45 bg-alert/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-alert">
        <AlertTriangle className="h-3 w-3" />
        error
      </span>
    );
  }
  return (
    <span className="mono inline-flex items-center gap-1.5 rounded-full border border-border bg-background/40 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
      idle
    </span>
  );
}

function shortId(id: string): string {
  return id.length > 24 ? `${id.slice(0, 22)}…` : id;
}

function LivePipelinePanel({
  state,
  aggregate,
  clean,
  noisy,
  totalLatencyMs,
}: {
  state: RunState;
  aggregate: BenchAggregate | null;
  clean: BenchAggregate | null;
  noisy: BenchAggregate | null;
  totalLatencyMs: number | null;
}) {
  if (!aggregate || aggregate.clips === 0) {
    return (
      <section className="rounded-lg border border-dashed border-border bg-panel/40 px-5 py-5">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h2 className="mono text-[11px] uppercase tracking-[0.2em] text-foreground">
            audio pipeline · live
          </h2>
        </div>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">
          Press <strong className="text-foreground">Run all 48 clips</strong> to measure MOS proxy,
          input level, VAD miss-rate, and latency in-browser.
        </p>
      </section>
    );
  }

  const liveRunning = state.status === "running";

  return (
    <section className="rounded-lg border border-primary/35 bg-panel/85">
      <SectionHeader
        icon={<Sparkles className="h-4 w-4 text-primary" />}
        title="audio pipeline · live"
        detail="In-browser ai-coustics measurement. Updates per clip."
      />
      <div className="grid gap-3 px-4 py-4 md:grid-cols-2 xl:grid-cols-5">
        <LiveStat
          index={0}
          icon={<Gauge className="h-3.5 w-3.5" />}
          label="MOS proxy"
          value={aggregate.avgQuality.toFixed(2)}
          hint="target ≥ 3.0 (1–5)"
          tone={aggregate.avgQuality >= 3 ? "ok" : aggregate.avgQuality >= 2 ? "warn" : "alert"}
        />
        <LiveStat
          index={1}
          icon={<SlidersHorizontal className="h-3.5 w-3.5" />}
          label="input level"
          value={`${aggregate.avgEnhancedRmsDb.toFixed(1)} dB`}
          hint={`raw ${aggregate.avgRawRmsDb.toFixed(1)} · lift ${signedDb(aggregate.rmsLiftDb)}`}
          tone={aggregate.inLevelPassRate >= 0.7 ? "ok" : "warn"}
        />
        <LiveStat
          index={2}
          icon={<Activity className="h-3.5 w-3.5" />}
          label="VAD miss"
          value={pct(aggregate.vadMissRate)}
          hint={`target ≤ 5% · ${aggregate.vadDetected}/${aggregate.clips}`}
          tone={
            aggregate.vadMissRate <= 0.05 ? "ok" : aggregate.vadMissRate <= 0.1 ? "warn" : "alert"
          }
        />
        <LiveStat
          index={3}
          icon={<Timer className="h-3.5 w-3.5" />}
          label="latency"
          value={`${aggregate.avgLatencyMs.toFixed(0)} ms`}
          hint={`${(aggregate.avgRtFactor * 100).toFixed(0)}% real-time`}
          tone={aggregate.avgRtFactor < 0.5 ? "ok" : aggregate.avgRtFactor < 1 ? "warn" : "alert"}
        />
        <LiveStat
          index={4}
          icon={<CheckCircle2 className="h-3.5 w-3.5" />}
          label="in-target level"
          value={pct(aggregate.inLevelPassRate)}
          hint="−27 to −16 dBFS"
          tone={aggregate.inLevelPassRate >= 0.7 ? "ok" : "warn"}
        />
      </div>

      <div className="grid gap-0 border-t border-border md:grid-cols-2">
        <ConditionAggregate label="clean" data={clean} />
        <ConditionAggregate label="noisy" data={noisy} />
      </div>

      {totalLatencyMs != null && !liveRunning ? (
        <div className="flex items-center gap-2 border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
          <Timer className="h-3 w-3" />
          {(totalLatencyMs / 1000).toFixed(2)}s total · {aggregate.avgLatencyMs.toFixed(0)} ms avg
          across {aggregate.clips} clips.
        </div>
      ) : null}
    </section>
  );
}

function ConditionAggregate({ label, data }: { label: string; data: BenchAggregate | null }) {
  if (!data || data.clips === 0) {
    return (
      <div className="border-b border-border px-4 py-3 last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0">
        <div className="mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          {label}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">no clips yet</div>
      </div>
    );
  }
  return (
    <div className="border-b border-border px-4 py-3 last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0">
      <div className="flex items-center justify-between">
        <span className="mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          {label}
        </span>
        <span className="mono text-[10px] tabular-nums text-muted-foreground">
          {data.clips} clips
        </span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <MiniMetric label="MOS" value={data.avgQuality.toFixed(2)} />
        <MiniMetric label="VAD miss" value={pct(data.vadMissRate)} />
        <MiniMetric label="level" value={`${data.avgEnhancedRmsDb.toFixed(1)}`} />
        <MiniMetric label="rt" value={`${(data.avgRtFactor * 100).toFixed(0)}%`} />
      </div>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background/30 px-2 py-1.5">
      <div className="mono text-[8px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </div>
      <div className="num mt-0.5 text-sm font-semibold tabular-nums text-foreground">{value}</div>
    </div>
  );
}

function LiveStat({
  icon,
  label,
  value,
  hint,
  tone,
  index = 0,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint: string;
  tone: "ok" | "warn" | "alert";
  index?: number;
}) {
  const ring =
    tone === "ok"
      ? "border-ok/40 bg-ok/5"
      : tone === "warn"
        ? "border-amber-400/40 bg-amber-400/5"
        : "border-alert/45 bg-alert/5";
  return (
    <div
      className={[
        "animate-fade-up rounded-lg border px-3 py-3 transition-colors duration-200",
        ring,
      ].join(" ")}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="mono text-[10px] uppercase tracking-[0.16em]">{label}</span>
      </div>
      <div className="num mt-1.5 text-[1.75rem] font-semibold leading-none tabular-nums text-foreground">
        {value}
      </div>
      <div className="mt-1.5 text-[11px] leading-tight text-muted-foreground">{hint}</div>
    </div>
  );
}

function LiveClipTable({ clips }: { clips: ClipMetric[] }) {
  const [filter, setFilter] = useState<"all" | "clean" | "noisy">("all");
  const visible = useMemo(
    () => (filter === "all" ? clips : clips.filter((c) => c.condition === filter)),
    [clips, filter],
  );

  return (
    <section className="tier-primary overflow-hidden rounded-xl">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
        <div>
          <div className="flex items-center gap-2">
            <Mic2 className="h-4 w-4 text-primary" />
            <h2 className="mono text-[11px] uppercase tracking-[0.2em] text-foreground">
              per-clip A/B
            </h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Raw vs enhanced, per clip.</p>
        </div>
        <div className="flex items-center gap-1 rounded-md border border-border bg-background/40 p-0.5">
          {(["all", "clean", "noisy"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={[
                "mono cursor-pointer rounded px-2 py-1 text-[10px] uppercase tracking-[0.14em] transition",
                filter === f
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              {f}
            </button>
          ))}
        </div>
      </div>
      <div className="max-h-[640px] overflow-auto">
        <table className="w-full min-w-[920px] text-left text-xs">
          <thead className="sticky top-0 z-10 border-b border-border bg-panel-elevated/95 backdrop-blur">
            <tr className="mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              <th className="px-4 py-3 font-medium">clip</th>
              <th className="px-3 py-3 font-medium">cond.</th>
              <th className="px-3 py-3 font-medium">raw</th>
              <th className="px-3 py-3 font-medium">enhanced</th>
              <th className="px-3 py-3 text-right font-medium">in dB</th>
              <th className="px-3 py-3 text-right font-medium">out dB</th>
              <th className="px-3 py-3 text-right font-medium">VAD</th>
              <th className="px-3 py-3 text-right font-medium">MOS</th>
              <th className="px-3 py-3 text-right font-medium">rt</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((c) => (
              <tr
                key={c.id}
                className="border-b border-border/70 transition-colors duration-150 last:border-0 hover:bg-primary/5"
              >
                <td className="px-4 py-2.5">
                  <div className="font-medium text-foreground">{humanize(c.command)}</div>
                  <div className="mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
                    {c.take}
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <ConditionBadge condition={c.condition} />
                </td>
                <td className="px-3 py-2.5">
                  <audio
                    controls
                    preload="none"
                    src={c.rawUrl}
                    aria-label={`Raw audio for ${c.command} ${c.take}`}
                    className="h-7 w-44 cursor-sentinel-listen"
                  />
                </td>
                <td className="px-3 py-2.5">
                  {c.enhancedUrl ? (
                    <audio
                      controls
                      preload="none"
                      src={c.enhancedUrl}
                      aria-label={`Enhanced audio for ${c.command} ${c.take}`}
                      className="h-7 w-44 cursor-sentinel-listen"
                    />
                  ) : (
                    <span className="mono text-[10px] text-muted-foreground">cached run</span>
                  )}
                </td>
                <td className="num px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                  {c.rmsInDb.toFixed(1)}
                </td>
                <td
                  className={[
                    "num px-3 py-2.5 text-right tabular-nums",
                    c.levelStatus === "pass"
                      ? "text-ok"
                      : c.levelStatus === "warn"
                        ? "text-amber-200"
                        : "text-alert",
                  ].join(" ")}
                >
                  {c.rmsOutDb.toFixed(1)}
                </td>
                <td className="num px-3 py-2.5 text-right tabular-nums">
                  {c.vadAnyDetected ? (
                    <span className="text-ok">{Math.round(c.vadSpeechRatio * 100)}%</span>
                  ) : (
                    <span className="text-alert">miss</span>
                  )}
                </td>
                <td className="num px-3 py-2.5 text-right tabular-nums text-foreground">
                  {c.qualityProxy.toFixed(2)}
                </td>
                <td className="num px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                  {(c.rtFactor * 100).toFixed(0)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ConditionBadge({ condition }: { condition: "clean" | "noisy" }) {
  const cls =
    condition === "clean"
      ? "border-ok/40 bg-ok/10 text-ok"
      : "border-amber-400/40 bg-amber-400/10 text-amber-200";
  return (
    <span
      className={[
        "mono inline-flex rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-[0.14em]",
        cls,
      ].join(" ")}
    >
      {condition}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Existing application-benchmark panels (bundled JSON)
// ---------------------------------------------------------------------------

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

function SourceBadge({ source }: { source: string }) {
  return (
    <span
      className="mono rounded-full border border-border bg-panel/70 px-2.5 py-1 text-[9px] uppercase tracking-[0.14em] text-muted-foreground"
      title={source}
    >
      bundled JSON
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

function SystemLiftHero({
  rows,
  model,
  liveOverall: _live,
}: {
  rows: ComparisonRow[];
  model: ReturnType<typeof buildSubmissionModel>;
  liveOverall: BenchAggregate | null;
}) {
  return (
    <section className="tier-hero animate-rise overflow-hidden rounded-2xl">
      <div className="grid gap-5 px-5 py-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-center lg:gap-8">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <span className="mono text-[10px] uppercase tracking-[0.2em] text-primary">
              SAIS · final score
            </span>
          </div>
          <div className="mt-3 flex flex-wrap items-end gap-x-4 gap-y-1">
            <CountUp
              value={(model.sais ?? 0) * 100}
              suffix="%"
              className="num text-[5.5rem] font-semibold leading-none tabular-nums text-foreground"
            />
            <div className="pb-2">
              <div className="text-sm text-muted-foreground">
                (correct + safe recovery) / scored
              </div>
              <div className="mono mt-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                target ≥ 90%
              </div>
            </div>
          </div>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-ok/40 bg-ok/10 px-3 py-1 text-[11px] text-ok">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span className="font-medium">{pct(model.danger)} dangerous</span>
            <span className="text-ok/70">·</span>
            <span>
              {count(model.transcribed)}/{count(model.clips)} scored
            </span>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 max-w-md">
            <SmallFact label="WER" value={pct(model.wer)} />
            <SmallFact label="conf." value={pct(model.confidence)} />
            <SmallFact label="recover" value={pct(model.recovery)} />
          </div>
        </div>

        <LiftProgression rows={rows} model={model} />
      </div>
    </section>
  );
}

function LiftProgression({
  rows,
  model,
}: {
  rows: ComparisonRow[];
  model: ReturnType<typeof buildSubmissionModel>;
}) {
  if (rows.length === 0) {
    return <EmptyState text="No system comparison rows were found in this result file." />;
  }
  const ordered = ["raw_noisy", "aicoustics_only", "aicoustics_plus_sentinel"]
    .map((id) => rows.find((row) => row.id === id))
    .filter((row): row is ComparisonRow => Boolean(row));
  const stages = ordered.length ? ordered : rows;
  const max = Math.max(...stages.map((s) => s.sais ?? 0), 0.01);

  return (
    <div className="rounded-xl border border-border/70 bg-background/30 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <GitCompareArrows className="h-4 w-4 text-primary" />
          <span className="mono text-[10px] uppercase tracking-[0.2em] text-foreground">
            system lift
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Pill tone="primary" label="SAIS" value={signedPct(model.saisLift)} />
          <Pill tone="ok" label="danger" value={signedPct(model.dangerReduction)} />
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {stages.map((row, index) => (
          <LiftStage
            key={row.id}
            row={row}
            index={index}
            heightPct={(row.sais ?? 0) / max}
            delta={index > 0 ? (row.sais ?? 0) - (stages[index - 1].sais ?? 0) : null}
          />
        ))}
      </div>
    </div>
  );
}

function LiftStage({
  row,
  index,
  heightPct,
  delta,
}: {
  row: ComparisonRow;
  index: number;
  heightPct: number;
  delta: number | null;
}) {
  const passing = row.dangerousErrorRate === 0;
  return (
    <div
      className="animate-fade-up rounded-lg border border-border/60 bg-panel/60 p-3"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
          stage {index + 1}
        </span>
        {delta != null ? (
          <span className="mono inline-flex items-center gap-0.5 text-[10px] tabular-nums text-primary">
            +{Math.round(delta * 100)} pts
          </span>
        ) : null}
      </div>
      <div className="mt-1 truncate text-[13px] font-medium text-foreground" title={row.version}>
        {row.version}
      </div>
      <div className="mt-2 flex items-end gap-2">
        <div className="num text-2xl font-semibold tabular-nums text-foreground">
          {pct(row.sais)}
        </div>
        <div className="mono pb-1 text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
          SAIS
        </div>
      </div>
      <div className="relative mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="absolute inset-y-0 left-0 bg-primary transition-[width] duration-500 ease-out"
          style={{ width: `${Math.max(0, Math.min(1, heightPct)) * 100}%` }}
        />
      </div>
      <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
        <span className="mono uppercase tracking-[0.12em]">
          danger {pct(row.dangerousErrorRate)}
        </span>
        <span
          className={[
            "mono inline-flex rounded-full border px-1.5 py-0.5 text-[8px] uppercase tracking-[0.14em]",
            passing
              ? "border-ok/40 bg-ok/10 text-ok"
              : "border-amber-400/40 bg-amber-400/10 text-amber-200",
          ].join(" ")}
        >
          {passing ? "safe" : "review"}
        </span>
      </div>
    </div>
  );
}

function Pill({ tone, label, value }: { tone: "primary" | "ok"; label: string; value: string }) {
  const cls =
    tone === "primary"
      ? "border-primary/40 bg-primary/10 text-primary"
      : "border-ok/40 bg-ok/10 text-ok";
  return (
    <span
      className={[
        "mono inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.14em]",
        cls,
      ].join(" ")}
    >
      <span className="text-muted-foreground/80">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </span>
  );
}

function CountUp({
  value,
  suffix = "",
  className,
  duration = 700,
}: {
  value: number;
  suffix?: string;
  className?: string;
  duration?: number;
}) {
  const [display, setDisplay] = useState(0);
  const stateRef = useRef({ from: 0, to: value, start: 0 });
  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setDisplay(value);
      return;
    }
    let raf = 0;
    const local = stateRef.current;
    local.from = display;
    local.to = value;
    local.start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - local.start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(local.from + (local.to - local.from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);
  return (
    <span className={className}>
      {Math.round(display)}
      {suffix}
    </span>
  );
}

function SmallFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background/25 px-3 py-2">
      <div className="mono text-[8px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </div>
      <div className="num mt-1 text-sm font-semibold tabular-nums text-foreground">{value}</div>
    </div>
  );
}

function RequirementChecklist({
  rows,
  model,
  liveOverall,
}: {
  rows: QualitySignal[];
  model: ReturnType<typeof buildSubmissionModel>;
  liveOverall: BenchAggregate | null;
}) {
  const requirements = [
    {
      label: "audio quality",
      detail: rows.find((row) => row.signal === "Non-intrusive MOS"),
      icon: <Gauge className="h-4 w-4" />,
      live: liveOverall ? `${liveOverall.avgQuality.toFixed(2)} live` : null,
    },
    {
      label: "WER under noise",
      detail: rows.find((row) => row.signal === "WER under noise"),
      icon: <Mic2 className="h-4 w-4" />,
      live: null,
    },
    {
      label: "VAD miss-rate",
      detail: rows.find((row) => row.signal === "VAD miss-rate"),
      icon: <Activity className="h-4 w-4" />,
      live: liveOverall ? `${pct(liveOverall.vadMissRate)} live` : null,
    },
    {
      label: "input level",
      detail: rows.find((row) => row.signal === "Input level"),
      icon: <SlidersHorizontal className="h-4 w-4" />,
      live: liveOverall ? `${liveOverall.avgEnhancedRmsDb.toFixed(1)} dB live` : null,
    },
    {
      label: "task completion",
      detail: rows.find((row) => row.signal === "Task completion"),
      icon: <ShieldCheck className="h-4 w-4" />,
      live: null,
    },
  ];

  return (
    <section className="tier-primary overflow-hidden rounded-xl">
      <SectionHeader
        icon={<ListChecks className="h-4 w-4 text-primary" />}
        title="submission checklist"
        detail="Required signals plus the Sentinel app score."
      />
      <div className="divide-y divide-border">
        {requirements.map(({ label, detail, icon, live }) => (
          <div key={label} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3">
            <span className="text-primary">{icon}</span>
            <div className="min-w-0">
              <div className="text-sm font-medium text-foreground">{label}</div>
              <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                {detail?.threshold ?? "tracked"}
              </div>
              {live ? (
                <div className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-primary">
                  <Sparkles className="h-2.5 w-2.5" />
                  {live}
                </div>
              ) : null}
            </div>
            <div className="text-right">
              <div className="num text-sm font-semibold tabular-nums text-foreground">
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

function ConditionPanel({ rows }: { rows: ComparisonRow[] }) {
  return (
    <section className="tier-primary overflow-hidden rounded-xl">
      <SectionHeader
        icon={<Mic2 className="h-4 w-4 text-primary" />}
        title="clean vs noisy"
        detail="Same policy, two recording conditions."
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
    <section className="tier-primary overflow-hidden rounded-xl">
      <SectionHeader
        icon={<Database className="h-4 w-4 text-primary" />}
        title="evidence pack"
        detail="The corpus behind the score."
      />
      <div className="grid gap-0 sm:grid-cols-2 xl:grid-cols-1">
        {items.map((item) => (
          <div key={item.label} className="border-b border-border/70 px-4 py-3 last:border-b-0">
            <div className="mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
              {item.label}
            </div>
            <div className="num mt-1 text-2xl font-semibold tabular-nums text-foreground">
              {item.value}
            </div>
            <div className="mt-1 text-[11px] leading-snug text-muted-foreground">{item.detail}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function FailurePanel({ items }: { items: FailureBreakdown[] }) {
  return (
    <section className="tier-primary overflow-hidden rounded-xl">
      <SectionHeader
        icon={<AlertTriangle className="h-4 w-4 text-alert" />}
        title="recoveries"
        detail="Uncertain commands are held, not executed."
      />
      {items.length > 0 ? (
        <div className="space-y-3 px-4 py-4">
          {items.map((item) => (
            <div key={item.label}>
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="text-foreground">{humanize(item.label)}</span>
                <span className="mono tabular-nums text-muted-foreground">
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
    <section className="tier-primary overflow-hidden rounded-xl">
      <SectionHeader
        icon={<Activity className="h-4 w-4 text-primary" />}
        title="command matrix"
        detail="By expected guard command."
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
                  <td className="num px-3 py-3 text-right tabular-nums text-muted-foreground">
                    {row.transcribed}/{row.clips}
                  </td>
                  <td className="num px-3 py-3 text-right tabular-nums text-primary">
                    {pct(row.sais)}
                  </td>
                  <td className="num px-3 py-3 text-right tabular-nums text-foreground">
                    {pct(row.correctActionRate)}
                  </td>
                  <td className="num px-3 py-3 text-right tabular-nums text-amber-200">
                    {pct(row.safeRecoveryRate)}
                  </td>
                  <td className="num px-3 py-3 text-right tabular-nums text-alert">
                    {pct(row.dangerousErrorRate)}
                  </td>
                  <td className="num px-3 py-3 text-right tabular-nums text-muted-foreground">
                    {pct(row.wer)}
                  </td>
                  <td className="num px-4 py-3 text-right tabular-nums text-muted-foreground">
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
    <section className="tier-primary overflow-hidden rounded-xl">
      <SectionHeader
        icon={<Gauge className="h-4 w-4 text-primary" />}
        title="pipeline audit"
        detail="Capture → quality → VAD → STT → decision."
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
            <div className="num mt-2 text-lg font-semibold tabular-nums text-foreground">
              {row.value}
            </div>
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
    <section className="tier-primary overflow-hidden rounded-xl">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <div className="mono text-[11px] uppercase tracking-[0.2em] text-foreground">
            scored records
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Latest 10 shown · full corpus below.
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
      <td className="num px-3 py-3 text-right tabular-nums text-muted-foreground">
        {pct(row.confidence)}
      </td>
      <td className="num px-3 py-3 text-right tabular-nums text-muted-foreground">
        {pct(row.wer)}
      </td>
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
        <span className="num text-[10px] tabular-nums text-muted-foreground">{pct(value)}</span>
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
          "num mt-1 text-sm font-semibold tabular-nums",
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

function signedDb(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "n/a";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(1)} dB`;
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
