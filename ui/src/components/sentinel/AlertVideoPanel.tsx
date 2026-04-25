import { useEffect, useState } from "react";
import type { AlertEvent } from "@/lib/sentinel-data";

type Props = {
  alert: AlertEvent | null;
};

export function AlertVideoPanel({ alert }: Props) {
  const [progress, setProgress] = useState(62);

  useEffect(() => {
    if (!alert) return;
    const id = setInterval(() => {
      setProgress((p) => (p >= 100 ? 0 : p + 0.4));
    }, 120);
    return () => clearInterval(id);
  }, [alert]);

  if (!alert) {
    return (
      <div className="flex h-full min-h-[340px] flex-col items-center justify-center rounded-lg border border-border bg-panel/60 text-center">
        <div className="mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          no active review
        </div>
        <div className="mt-2 max-w-sm px-6 text-sm text-muted-foreground/80">
          Sentinel surfaces flagged moments here. The console stays calm until something needs a human.
        </div>
      </div>
    );
  }

  const confidencePct = Math.round(alert.visualConfidence * 100);

  return (
    <section
      role="alert"
      aria-live="polite"
      className="flex h-full flex-col overflow-hidden rounded-lg border border-alert/60 bg-panel animate-fade-in"
    >
      {/* Video area */}
      <div className="relative aspect-video w-full overflow-hidden bg-background">
        <div
          className="absolute inset-0"
          style={{
            background:
              "repeating-linear-gradient(0deg, oklch(0.20 0.018 240) 0px, oklch(0.17 0.018 240) 2px, oklch(0.19 0.018 240) 4px)",
          }}
        />
        <div className="pointer-events-none absolute inset-x-0 h-24 bg-gradient-to-b from-transparent via-white/[0.05] to-transparent animate-scan" />
        <div className="absolute inset-0 bg-[var(--alert)]/8" />

        {/* Top overlay */}
        <div className="absolute inset-x-0 top-0 flex items-center justify-between p-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="mono rounded-sm bg-alert px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-alert-foreground">
              ● requires review
            </span>
            <span className="mono rounded-sm bg-background/70 px-2 py-1 text-foreground/90 backdrop-blur-sm">
              {alert.cameraId} · {alert.zone}
            </span>
          </div>
          <span className="mono rounded-sm bg-background/70 px-2 py-1 text-muted-foreground backdrop-blur-sm">
            {alert.timestamp}
          </span>
        </div>

        {/* Scene summary */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/95 via-background/70 to-transparent p-4">
          <div className="mono text-[10px] uppercase tracking-[0.2em] text-alert">
            scene summary
          </div>
          <div className="mt-1 text-base text-foreground">
            {alert.sceneSummary}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="border-t border-border bg-panel-elevated px-4 py-3">
        {/* Scrubber */}
        <div className="flex items-center gap-3">
          <span className="mono text-[10px] text-muted-foreground">00:18</span>
          <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="absolute inset-y-0 left-0 bg-alert"
              style={{ width: `${progress}%` }}
            />
            <div
              className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-alert shadow-[0_0_0_3px_oklch(0.18_0.015_240)]"
              style={{ left: `calc(${progress}% - 6px)` }}
            />
          </div>
          <span className="mono text-[10px] text-muted-foreground">00:30</span>
        </div>

        {/* Buttons + confidence */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            <button className="mono rounded-md border border-border bg-background/60 px-3 py-1.5 text-xs text-foreground transition hover:border-primary/50 hover:bg-background">
              ↺ Replay last 10s
            </button>
            <button className="mono rounded-md border border-border bg-background/60 px-3 py-1.5 text-xs text-foreground transition hover:border-primary/50 hover:bg-background">
              ▶ Watch live
            </button>
          </div>
          <div className="flex min-w-[220px] items-center gap-2">
            <span className="mono text-[10px] uppercase tracking-wider text-muted-foreground">
              visual model
            </span>
            <div className="relative h-1.5 w-32 overflow-hidden rounded-full bg-muted">
              <div
                className="absolute inset-y-0 left-0 bg-alert/80"
                style={{ width: `${confidencePct}%` }}
              />
            </div>
            <span className="mono text-xs text-foreground">{confidencePct}%</span>
          </div>
        </div>
      </div>
    </section>
  );
}
