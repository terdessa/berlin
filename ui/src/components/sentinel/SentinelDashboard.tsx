import { useCallback, useEffect, useRef, useState } from "react";
import {
  cameras,
  pastReviews,
  scenarios,
  successScenario,
  failureScenario,
  type AlertEvent,
  type AlertStatus,
  type Phase,
  type Scenario,
} from "@/lib/sentinel-data";
import { CameraTile } from "./CameraTile";
import { AlertVideoPanel } from "./AlertVideoPanel";
import { ReviewLogPanel } from "./ReviewLogPanel";
import { SystemPillsStrip } from "./SystemPillsStrip";
import { EventTicker, type TickerEntry } from "./EventTicker";
import { InferenceCounter } from "./InferenceCounter";
import { ReviewHistoryStrip } from "./ReviewHistoryStrip";
import { StoreMiniMap } from "./StoreMiniMap";
import { AudioMetricBadge } from "./AudioMetricBadge";
import { PoweredByFooter } from "./PoweredByFooter";

type RunState = {
  scenario: Scenario;
  stepIndex: number;
};

export function SentinelDashboard() {
  const [run, setRun] = useState<RunState | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [revealUpTo, setRevealUpTo] = useState(0);
  const [status, setStatus] = useState<AlertStatus>("Awaiting human review");
  const [selected, setSelected] = useState<string | null>(null);
  const [tickerEntries, setTickerEntries] = useState<TickerEntry[]>([
    { id: 0, at: "13:47", text: "CAM-02 · review · marked false alarm" },
    { id: 1, at: "13:18", text: "CAM-07 · review · floor associate dispatched" },
    { id: 2, at: "12:54", text: "CAM-10 · door propped · floor associate dispatched" },
  ]);
  const [voiceLatency, setVoiceLatency] = useState(180);

  const tickerIdRef = useRef(3);
  const timerRef = useRef<number | null>(null);

  const alert: AlertEvent | null = run ? run.scenario.alert : null;
  const isAlerting = phase !== "idle" && phase !== "resolved";

  const pushTicker = useCallback((text: string) => {
    setTickerEntries((prev) => {
      const at = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      const entry: TickerEntry = { id: tickerIdRef.current++, at, text };
      return [entry, ...prev].slice(0, 12);
    });
  }, []);

  const stopTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const startScenario = useCallback(
    (scenario: Scenario) => {
      stopTimer();
      setRun({ scenario, stepIndex: -1 });
      setPhase("idle");
      setRevealUpTo(0);
      setStatus(scenario.alert.actionTaken);
      setSelected(scenario.alert.cameraId);
      pushTicker(`scenario · ${scenario.id} · started`);
    },
    [pushTicker],
  );

  const resetAll = useCallback(() => {
    stopTimer();
    setRun(null);
    setPhase("idle");
    setRevealUpTo(0);
    setStatus("Awaiting human review");
    setSelected(null);
    pushTicker("scenario · reset");
  }, [pushTicker]);

  // Step driver: when a run is active, schedule the next step.
  useEffect(() => {
    if (!run) return;
    const nextIdx = run.stepIndex + 1;
    if (nextIdx >= run.scenario.steps.length) return;
    const step = run.scenario.steps[nextIdx];

    const tick = () => {
      setPhase(step.phase);
      setRevealUpTo(step.revealUpTo);
      if (step.status) setStatus(step.status);
      if (step.ticker) pushTicker(step.ticker);
      setRun((prev) => (prev ? { ...prev, stepIndex: nextIdx } : prev));
    };

    if (run.stepIndex === -1) {
      // Kick off immediately for the first step.
      timerRef.current = window.setTimeout(tick, 200);
    } else {
      const prev = run.scenario.steps[run.stepIndex];
      timerRef.current = window.setTimeout(tick, prev.durationMs);
    }
    return stopTimer;
  }, [run, pushTicker]);

  // Drift voice latency for ambient feel.
  useEffect(() => {
    const id = setInterval(() => {
      setVoiceLatency((v) => {
        const target = isAlerting ? 220 : 175;
        return Math.round(v + (target - v) * 0.4 + (Math.random() - 0.5) * 12);
      });
    }, 1500);
    return () => clearInterval(id);
  }, [isAlerting]);

  // Keyboard shortcut: D = run scripted demo; R = reset; F = failure scenario.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "d" || e.key === "D") {
        e.preventDefault();
        startScenario(successScenario);
      } else if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        startScenario(failureScenario);
      } else if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        resetAll();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [startScenario, resetAll]);

  const handleAction = (next: AlertStatus) => {
    setStatus(next);
    pushTicker(`action · ${alert?.cameraId ?? "—"} · ${next.toLowerCase()}`);
  };

  // Cameras are "analyzing" continuously when no alert is active and the
  // tile is not the alert tile during a run.
  const analyzingId = alert?.cameraId ?? null;

  return (
    <main className="relative min-h-screen w-full px-6 py-4">
      {/* Top bar: ambient status + scenario controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            aria-live="polite"
            className={[
              "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs backdrop-blur-sm transition-colors",
              isAlerting
                ? "bg-alert/10 text-alert"
                : "bg-background/40 text-foreground/90",
            ].join(" ")}
          >
            <span
              className={[
                "h-2 w-2 rounded-full",
                isAlerting ? "bg-alert animate-alert-pulse" : "bg-ok animate-soft-pulse",
              ].join(" ")}
            />
            <span className="mono uppercase tracking-[0.18em] text-[10px]">
              {isAlerting && alert
                ? `Sentinel flagged ${alert.cameraId} — requires review`
                : "Sentinel is watching"}
            </span>
          </div>
          <span className="mono text-[10px] text-muted-foreground/70 hidden sm:inline">
            store 042 · kreuzberg · live
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {scenarios.map((s) => {
            const active = run?.scenario.id === s.id;
            return (
              <button
                key={s.id}
                onClick={() => startScenario(s)}
                className={[
                  "mono cursor-pointer inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] backdrop-blur-sm transition",
                  active
                    ? "border-primary/60 bg-primary/15 text-primary"
                    : "border-border bg-background/40 text-muted-foreground hover:text-foreground",
                ].join(" ")}
                aria-pressed={active}
              >
                <span
                  className={[
                    "h-1.5 w-1.5 rounded-full",
                    active ? "bg-primary animate-soft-pulse" : "bg-muted-foreground",
                  ].join(" ")}
                />
                {s.label}
              </button>
            );
          })}
          <button
            onClick={resetAll}
            className="mono cursor-pointer inline-flex items-center gap-2 rounded-full border border-border bg-background/40 px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground transition hover:text-foreground"
          >
            reset
          </button>
          <span className="mono hidden lg:inline text-[10px] text-muted-foreground/70">
            shortcuts · D success · F failure · R reset
          </span>
        </div>
      </div>

      {/* System pills + counters */}
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <SystemPillsStrip
          voiceLatencyMs={voiceLatency}
          earpieceBattery={76}
          alerting={isAlerting}
        />
        <InferenceCounter />
      </div>

      {/* Camera grid */}
      <section
        aria-label="Camera grid"
        className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
      >
        {cameras.map((cam) => (
          <CameraTile
            key={cam.id}
            camera={cam}
            isAlert={alert?.cameraId === cam.id}
            isAnalyzing={analyzingId !== cam.id}
            isSelected={selected === cam.id}
            onClick={() => setSelected(cam.id)}
          />
        ))}
      </section>

      {/* Lower band: alert video + log */}
      <section className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="min-h-[360px]">
          <AlertVideoPanel alert={alert} />
        </div>

        <div className="min-h-[360px]">
          {alert ? (
            <ReviewLogPanel
              alert={alert}
              phase={phase}
              revealUpTo={revealUpTo}
              status={status}
              onAction={handleAction}
            />
          ) : (
            <div className="flex h-full min-h-[360px] flex-col items-center justify-center rounded-lg border border-dashed border-border bg-panel/30 text-center">
              <div className="mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                review log · collapsed
              </div>
              <div className="mt-2 max-w-xs px-6 text-xs text-muted-foreground/70">
                Opens here when Sentinel flags a camera. Press{" "}
                <span className="mono text-foreground">D</span> for a scripted demo
                or <span className="mono text-foreground">F</span> for the failure
                path.
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Telemetry row */}
      <section className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
        <StoreMiniMap alertCameraId={alert?.cameraId ?? null} />
        <EventTicker entries={tickerEntries} />
        <AudioMetricBadge />
      </section>

      {/* History strip */}
      <section className="mt-3">
        <ReviewHistoryStrip reviews={pastReviews} />
      </section>

      <footer className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3">
        <span className="mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/80">
          sentinel · retail security ops · cameras video-only · audio via earpiece phone
        </span>
        <PoweredByFooter />
      </footer>
    </main>
  );
}
