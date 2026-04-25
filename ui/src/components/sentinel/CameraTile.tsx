import { useEffect, useState } from "react";
import { Smartphone, Video, Battery, Signal } from "lucide-react";
import type { Camera } from "@/lib/sentinel-data";

type Props = {
  camera: Camera;
  isAlert?: boolean;
  isAnalyzing?: boolean;
  isSelected?: boolean;
  onClick?: () => void;
};

export function CameraTile({
  camera,
  isAlert,
  isAnalyzing,
  isSelected,
  onClick,
}: Props) {
  const [hovered, setHovered] = useState(false);
  const [microConf, setMicroConf] = useState(() => 0.55 + Math.random() * 0.3);

  // Slowly drift the per-tile micro-confidence bar so the agent feels alive.
  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    const id = setInterval(() => {
      setMicroConf((c) => {
        const target = isAlert
          ? 0.78 + Math.random() * 0.18
          : 0.55 + Math.random() * 0.3;
        return c + (target - c) * 0.25;
      });
    }, 1100 + Math.random() * 600);
    return () => clearInterval(id);
  }, [isAlert]);

  const isPhone = camera.device === "live-phone";
  const confPct = Math.round(microConf * 100);

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={[
        "group relative aspect-video w-full cursor-pointer overflow-hidden rounded-md border bg-panel text-left transition-all",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isAlert
          ? "border-alert animate-alert-pulse"
          : isSelected
            ? "border-primary/60"
            : "border-border hover:border-primary/40",
      ].join(" ")}
    >
      {/* Feed background */}
      <div className="absolute inset-0 overflow-hidden">
        <div
          className="absolute inset-0 opacity-60"
          style={{
            background:
              "repeating-linear-gradient(0deg, oklch(0.24 0.018 240) 0px, oklch(0.20 0.018 240) 2px, oklch(0.22 0.018 240) 4px)",
          }}
        />
        <div className="pointer-events-none absolute inset-x-0 h-12 bg-gradient-to-b from-transparent via-white/[0.04] to-transparent animate-scan" />

        {/* Analyzing scan-line — subtle teal sweep when agent is processing */}
        {isAnalyzing && !isAlert && (
          <div className="pointer-events-none absolute inset-x-0 h-8 bg-gradient-to-b from-transparent via-[var(--ok)]/15 to-transparent animate-scan" />
        )}

        {isAlert && <div className="absolute inset-0 bg-[var(--alert)]/10" />}

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

      {/* Device chip — phone vs cctv */}
      <div className="absolute left-1.5 bottom-7 flex items-center gap-1">
        <span
          className={[
            "mono inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[9px] uppercase tracking-wider backdrop-blur-sm",
            isPhone
              ? "border border-primary/40 bg-primary/10 text-primary"
              : "bg-background/60 text-muted-foreground",
          ].join(" ")}
        >
          {isPhone ? (
            <Smartphone className="h-2.5 w-2.5" />
          ) : (
            <Video className="h-2.5 w-2.5" />
          )}
          {isPhone ? "phone" : "cctv"}
        </span>
        {isPhone && camera.battery !== undefined && (
          <span className="mono inline-flex items-center gap-0.5 rounded-sm bg-background/60 px-1 py-0.5 text-[9px] text-muted-foreground backdrop-blur-sm">
            <Battery className="h-2.5 w-2.5" />
            {camera.battery}%
          </span>
        )}
        {isPhone && camera.signal && (
          <span className="mono inline-flex items-center gap-0.5 rounded-sm bg-background/60 px-1 py-0.5 text-[9px] uppercase text-muted-foreground backdrop-blur-sm">
            <Signal className="h-2.5 w-2.5" />
            {camera.signal}
          </span>
        )}
      </div>

      {/* Hover info */}
      {hovered && (
        <div className="absolute inset-x-0 bottom-2 bg-background/70 px-2 py-1 text-[10px] backdrop-blur-sm animate-fade-in">
          <span className="mono text-muted-foreground">last motion: </span>
          <span className="mono text-foreground">{camera.lastMotion}</span>
        </div>
      )}

      {isAlert && (
        <div className="absolute right-1.5 top-7 mono rounded-sm bg-alert px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-alert-foreground">
          review
        </div>
      )}

      {/* Per-tile micro confidence bar — sells "always analyzing" */}
      <div className="absolute inset-x-0 bottom-0 h-1 bg-background/40">
        <div
          className={[
            "h-full transition-all duration-700",
            isAlert ? "bg-alert" : "bg-ok/70",
          ].join(" ")}
          style={{ width: `${confPct}%` }}
        />
      </div>
    </button>
  );
}
