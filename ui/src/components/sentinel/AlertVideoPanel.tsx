import type { AlertEvent, Camera } from "@/lib/sentinel-data";

type Props = {
  alert: AlertEvent | null;
  selectedCamera: Camera | null;
};

export function AlertVideoPanel({ alert, selectedCamera }: Props) {
  if (!alert) {
    return (
      <section className="flex h-full flex-col overflow-hidden rounded-lg border border-dashed border-border bg-panel/40">
        <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
          <span className="mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            active review
          </span>
          <span className="mono text-[10px] text-muted-foreground/70">
            {selectedCamera ? selectedCamera.id : "idle"}
          </span>
        </div>
        <div className="flex flex-1 items-center justify-center px-4 text-center">
          <div>
            <div className="mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              no active review
            </div>
            {selectedCamera && (
              <div className="mt-1 text-[12px] text-muted-foreground/80">
                {selectedCamera.id} · {selectedCamera.zone}
              </div>
            )}
          </div>
        </div>
      </section>
    );
  }

  const confidencePct = Math.round(alert.visualConfidence * 100);

  return (
    <section
      role="alert"
      aria-live="polite"
      className="flex h-full flex-col overflow-hidden rounded-lg border border-alert/60 bg-panel animate-fade-in"
    >
      <div className="flex items-center justify-between border-b border-alert/30 bg-panel-elevated px-3 py-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="mono rounded-sm bg-alert px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-alert-foreground">
            review
          </span>
          <span className="mono truncate text-xs text-foreground">
            {alert.cameraId} · {alert.zone}
          </span>
        </div>
        <span className="mono shrink-0 text-[10px] text-muted-foreground">{alert.timestamp}</span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col justify-between gap-4 p-3">
        <div>
          <div className="mono text-[10px] uppercase tracking-[0.18em] text-alert">scene</div>
          <p className="mt-1 text-[13px] leading-snug text-foreground">{alert.sceneSummary}</p>
        </div>

        {alert.assistantMessage && (
          <div className="rounded-md border border-primary/25 bg-primary/5 p-2.5">
            <div className="mono text-[10px] uppercase tracking-[0.18em] text-primary">
              sentinel message
            </div>
            <p className="mt-1 text-[12px] leading-snug text-foreground/90">
              {alert.assistantMessage}
            </p>
          </div>
        )}

        <div className="flex items-center gap-2 border-t border-border pt-2">
          <span className="mono text-[9px] uppercase tracking-wider text-muted-foreground">
            visual confidence
          </span>
          <div className="relative h-1 flex-1 overflow-hidden rounded-full bg-muted">
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
