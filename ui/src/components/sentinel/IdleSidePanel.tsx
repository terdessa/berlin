import { StoreMiniMap } from "./StoreMiniMap";

/** What sits in the right column when no alert is active. Replaces the
 * collapsed-log placeholder with something useful: a store coverage map plus
 * a hint at what'll happen next. */
export function IdleSidePanel() {
  return (
    <div className="flex h-full flex-col gap-3 overflow-hidden rounded-lg border border-border bg-panel/40 p-3">
      <div className="flex items-center justify-between">
        <div className="mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          review log · collapsed
        </div>
        <span className="mono text-[10px] text-muted-foreground/70">
          opens on alert
        </span>
      </div>

      <div className="min-h-0 flex-1">
        <StoreMiniMap alertCameraId={null} />
      </div>

      <div className="rounded-md border border-dashed border-border bg-background/30 p-2.5">
        <div className="mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          shortcuts
        </div>
        <div className="mt-1 mono text-[11px] text-foreground/80">
          <span className="text-primary">D</span> success scenario ·{" "}
          <span className="text-alert">F</span> voice failure ·{" "}
          <span className="text-foreground">R</span> reset
        </div>
      </div>
    </div>
  );
}
