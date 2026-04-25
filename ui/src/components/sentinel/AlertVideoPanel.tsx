import { useEffect, useState } from "react";
import type { AlertEvent, Camera } from "@/lib/sentinel-data";

type Props = {
  alert: AlertEvent | null;
  selectedCamera: Camera | null;
};

export function AlertVideoPanel({ alert, selectedCamera }: Props) {
  const [progress, setProgress] = useState(62);

  useEffect(() => {
    if (!alert) return;
    const id = setInterval(() => {
      setProgress((p) => (p >= 100 ? 0 : p + 0.4));
    }, 120);
    return () => clearInterval(id);
  }, [alert]);

  // Empty state — no alert, no camera selected
  if (!alert && !selectedCamera) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-lg border border-dashed border-border bg-panel/40 px-4 text-center">
        <div className="mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          no active review
        </div>
        <div className="mt-1 max-w-sm text-[12px] leading-snug text-muted-foreground/80">
          Click a camera to inspect its feed, or run a scenario to see a flagged review.
        </div>
      </div>
    );
  }

  // Feed-preview state — camera selected but no alert
  if (!alert && selectedCamera) {
    return (
      <section className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-panel">
        <div className="relative min-h-0 flex-1 overflow-hidden bg-background">
          <div
            className="absolute inset-0"
            style={{
              background:
                "repeating-linear-gradient(0deg, oklch(0.20 0.018 240) 0px, oklch(0.17 0.018 240) 2px, oklch(0.19 0.018 240) 4px)",
            }}
          />
          <div className="pointer-events-none absolute inset-x-0 h-20 bg-gradient-to-b from-transparent via-white/[0.04] to-transparent animate-scan" />

          <div className="absolute inset-x-0 top-0 flex items-center justify-between p-2 text-xs">
            <span className="mono rounded-sm bg-background/70 px-1.5 py-0.5 text-foreground/90 backdrop-blur-sm">
              {selectedCamera.id} · {selectedCamera.zone}
            </span>
            <span className="mono rounded-sm bg-background/70 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground backdrop-blur-sm">
              feed preview
            </span>
          </div>

          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/90 to-transparent p-2.5">
            <div className="mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              status
            </div>
            <div className="mt-0.5 text-[12px] leading-snug text-foreground/90">
              Nominal. Sentinel is analyzing this feed; no review-worthy event right now.
            </div>
          </div>
        </div>
      </section>
    );
  }

  // Active alert
  if (!alert) return null;
  const confidencePct = Math.round(alert.visualConfidence * 100);

  return (
    <section
      role="alert"
      aria-live="polite"
      className="flex h-full flex-col overflow-hidden rounded-lg border border-alert/60 bg-panel animate-fade-in"
    >
      <div className="relative min-h-0 flex-1 overflow-hidden bg-background">
        <div
          className="absolute inset-0"
          style={{
            background:
              "repeating-linear-gradient(0deg, oklch(0.20 0.018 240) 0px, oklch(0.17 0.018 240) 2px, oklch(0.19 0.018 240) 4px)",
          }}
        />
        <div className="pointer-events-none absolute inset-x-0 h-20 bg-gradient-to-b from-transparent via-white/[0.05] to-transparent animate-scan" />
        <div className="absolute inset-0 bg-[var(--alert)]/8" />

        <div className="absolute inset-x-0 top-0 flex items-center justify-between p-2 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="mono rounded-sm bg-alert px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-alert-foreground">
              ● review
            </span>
            <span className="mono rounded-sm bg-background/70 px-1.5 py-0.5 text-foreground/90 backdrop-blur-sm">
              {alert.cameraId} · {alert.zone}
            </span>
          </div>
          <span className="mono rounded-sm bg-background/70 px-1.5 py-0.5 text-[10px] text-muted-foreground backdrop-blur-sm">
            {alert.timestamp}
          </span>
        </div>

        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/95 via-background/70 to-transparent p-2.5">
          <div className="mono text-[10px] uppercase tracking-[0.18em] text-alert">scene</div>
          <div className="mt-0.5 text-[12px] leading-snug text-foreground">
            {alert.sceneSummary}
          </div>
        </div>
      </div>

      {/* Compact controls */}
      <div className="flex items-center justify-between gap-2 border-t border-border bg-panel-elevated px-2.5 py-1.5">
        <div className="flex flex-1 items-center gap-2">
          <span className="mono text-[10px] text-muted-foreground">00:18</span>
          <div className="relative h-1 flex-1 overflow-hidden rounded-full bg-muted">
            <div className="absolute inset-y-0 left-0 bg-alert" style={{ width: `${progress}%` }} />
          </div>
          <span className="mono text-[10px] text-muted-foreground">00:30</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button className="mono cursor-pointer rounded-md border border-border bg-background/60 px-2 py-0.5 text-[10px] text-foreground transition hover:border-primary/50">
            ↺ 10s
          </button>
          <button className="mono cursor-pointer rounded-md border border-border bg-background/60 px-2 py-0.5 text-[10px] text-foreground transition hover:border-primary/50">
            ▶ live
          </button>
        </div>
        <div className="flex items-center gap-1">
          <span className="mono text-[9px] uppercase tracking-wider text-muted-foreground">
            visual
          </span>
          <div className="relative h-1 w-14 overflow-hidden rounded-full bg-muted">
            <div
              className="absolute inset-y-0 left-0 bg-alert/80"
              style={{ width: `${confidencePct}%` }}
            />
          </div>
          <span className="mono text-[10px] text-foreground">{confidencePct}%</span>
        </div>
      </div>
    </section>
  );
}
