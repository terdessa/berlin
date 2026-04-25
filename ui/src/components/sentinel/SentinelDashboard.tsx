import { useCallback, useEffect, useRef, useState } from "react";
import {
  cameras,
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
import { IdleSidePanel } from "./IdleSidePanel";
import { SystemPillsStrip } from "./SystemPillsStrip";
import { InferenceCounter } from "./InferenceCounter";
import { AudioMetricPill } from "./AudioMetricBadge";
import { PoweredByFooter } from "./PoweredByFooter";

type RunState = {
  scenario: Scenario;
  stepIndex: number;
};

type TickerEntry = { id: number; at: string; text: string };

export function SentinelDashboard() {
  const [run, setRun] = useState<RunState | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [revealUpTo, setRevealUpTo] = useState(0);
  const [status, setStatus] = useState<AlertStatus>("Awaiting human review");
  const [selected, setSelected] = useState<string | null>(null);
  const [latestEvent, setLatestEvent] = useState<TickerEntry | null>(null);
  const [voiceLatency, setVoiceLatency] = useState(180);

  const tickerIdRef = useRef(0);
  const timerRef = useRef<number | null>(null);

  const alert: AlertEvent | null = run ? run.scenario.alert : null;
  const isAlerting = phase !== "idle" && phase !== "resolved";

  const pushTicker = useCallback((text: string) => {
    const at = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    setLatestEvent({ id: tickerIdRef.current++, at, text });
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
      timerRef.current = window.setTimeout(tick, 200);
    } else {
      const prev = run.scenario.steps[run.stepIndex];
      timerRef.current = window.setTimeout(tick, prev.durationMs);
    }
    return stopTimer;
  }, [run, pushTicker]);

  useEffect(() => {
    const id = setInterval(() => {
      setVoiceLatency((v) => {
        const target = isAlerting ? 220 : 175;
        return Math.round(v + (target - v) * 0.4 + (Math.random() - 0.5) * 12);
      });
    }, 1500);
    return () => clearInterval(id);
  }, [isAlerting]);

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

  const analyzingId = alert?.cameraId ?? null;

  return (
    <main className="flex h-screen w-full flex-col overflow-hidden px-4 py-2">
      {/* TOP — fixed height */}
      <header className="flex flex-shrink-0 flex-wrap items-center justify-between gap-2 py-1">
        <div className="flex items-center gap-2">
          <div
            aria-live="polite"
            className={[
              "inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs backdrop-blur-sm transition-colors",
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
                ? `flagged ${alert.cameraId} — review`
                : "Sentinel is watching"}
            </span>
          </div>
          <SystemPillsStrip
            voiceLatencyMs={voiceLatency}
            earpieceBattery={76}
            alerting={isAlerting}
          />
          <AudioMetricPill />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {scenarios.map((s) => {
            const active = run?.scenario.id === s.id;
            const isFailure = s.id === "failure";
            return (
              <button
                key={s.id}
                onClick={() => startScenario(s)}
                className={[
                  "mono cursor-pointer inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] backdrop-blur-sm transition",
                  active
                    ? isFailure
                      ? "border-alert/60 bg-alert/15 text-alert"
                      : "border-primary/60 bg-primary/15 text-primary"
                    : "border-border bg-background/40 text-muted-foreground hover:text-foreground",
                ].join(" ")}
                aria-pressed={active}
                title={s.description}
              >
                <span
                  className={[
                    "h-1.5 w-1.5 rounded-full",
                    active
                      ? isFailure
                        ? "bg-alert animate-soft-pulse"
                        : "bg-primary animate-soft-pulse"
                      : "bg-muted-foreground",
                  ].join(" ")}
                />
                {isFailure ? "F · failure" : "D · success"}
              </button>
            );
          })}
          <button
            onClick={resetAll}
            className="mono cursor-pointer inline-flex items-center rounded-full border border-border bg-background/40 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-muted-foreground transition hover:text-foreground"
          >
            R · reset
          </button>
        </div>
      </header>

      {/* CAMERA GRID — flexible band */}
      <section
        aria-label="Camera grid"
        className="mt-2 grid min-h-0 flex-[0_0_auto] grid-cols-5 gap-2"
        style={{ height: "calc((100vh - 130px) * 0.42)" }}
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

      {/* LOWER BAND — alert video + log/idle */}
      <section className="mt-2 grid min-h-0 flex-1 grid-cols-2 gap-3">
        <div className="min-h-0">
          <AlertVideoPanel alert={alert} />
        </div>
        <div className="min-h-0">
          {alert ? (
            <ReviewLogPanel
              alert={alert}
              phase={phase}
              revealUpTo={revealUpTo}
              status={status}
              onAction={handleAction}
            />
          ) : (
            <IdleSidePanel />
          )}
        </div>
      </section>

      {/* FOOTER — fixed height */}
      <footer className="mt-2 flex flex-shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-2">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <InferenceCounter />
          {latestEvent && (
            <span className="mono truncate text-[10px] text-muted-foreground/80">
              <span className="text-muted-foreground/60">{latestEvent.at}</span>{" "}
              · {latestEvent.text}
            </span>
          )}
        </div>
        <PoweredByFooter />
      </footer>
    </main>
  );
}
