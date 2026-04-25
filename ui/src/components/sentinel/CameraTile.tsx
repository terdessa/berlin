import { useState } from "react";
import type { Camera } from "@/lib/sentinel-data";

type Props = {
  camera: Camera;
  isAlert?: boolean;
  isSelected?: boolean;
  onClick?: () => void;
};

export function CameraTile({ camera, isAlert, isSelected, onClick }: Props) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={[
        "group relative aspect-video w-full overflow-hidden rounded-md border bg-panel text-left transition-all",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isAlert
          ? "border-alert animate-alert-pulse"
          : isSelected
            ? "border-primary/60"
            : "border-border hover:border-primary/40",
      ].join(" ")}
    >
      {/* Animated noise/scanline placeholder */}
      <div className="absolute inset-0 overflow-hidden">
        <div
          className="absolute inset-0 opacity-60"
          style={{
            background:
              "repeating-linear-gradient(0deg, oklch(0.24 0.018 240) 0px, oklch(0.20 0.018 240) 2px, oklch(0.22 0.018 240) 4px)",
          }}
        />
        <div
          className="pointer-events-none absolute inset-x-0 h-12 bg-gradient-to-b from-transparent via-white/[0.04] to-transparent animate-scan"
        />
        {isAlert && (
          <div className="absolute inset-0 bg-[var(--alert)]/10" />
        )}
        <div
          className={[
            "absolute inset-0 transition-transform duration-500",
            hovered ? "scale-[1.04]" : "scale-100",
          ].join(" ")}
        />
      </div>

      {/* Top row */}
      <div className="absolute inset-x-0 top-0 flex items-center justify-between px-2 py-1.5 text-[10px]">
        <span className="mono rounded-sm bg-background/60 px-1.5 py-0.5 text-foreground/90 backdrop-blur-sm">
          {camera.id} · {camera.zone}
        </span>
        <span className="flex items-center gap-1 rounded-sm bg-background/60 px-1.5 py-0.5 backdrop-blur-sm">
          <span
            className={[
              "h-1.5 w-1.5 rounded-full",
              isAlert ? "bg-alert" : "bg-ok animate-soft-pulse",
            ].join(" ")}
          />
          <span className="mono uppercase tracking-wider text-[9px] text-muted-foreground">
            video
          </span>
        </span>
      </div>

      {/* Hover info */}
      {hovered && (
        <div className="absolute inset-x-0 bottom-0 bg-background/70 px-2 py-1 text-[10px] backdrop-blur-sm animate-fade-in">
          <span className="mono text-muted-foreground">last motion: </span>
          <span className="mono text-foreground">{camera.lastMotion}</span>
        </div>
      )}

      {isAlert && (
        <div className="absolute bottom-1.5 right-1.5 mono rounded-sm bg-alert px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-alert-foreground">
          review
        </div>
      )}
    </button>
  );
}
