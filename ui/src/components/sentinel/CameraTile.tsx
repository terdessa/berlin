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
  const [microConf, setMicroConf] = useState(() => 0.55 + Math.random() * 0.3);

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
      className={[
        "group relative flex aspect-video w-full cursor-pointer flex-col overflow-hidden rounded-md border bg-panel text-left transition-colors",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isAlert
          ? "border-alert animate-alert-pulse"
          : isSelected
            ? "border-primary/60"
            : "border-border hover:border-primary/40",
      ].join(" ")}
    >
      {/* Feed background — sits behind everything */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute inset-0 opacity-60"
          style={{
            background:
              "repeating-linear-gradient(0deg, oklch(0.24 0.018 240) 0px, oklch(0.20 0.018 240) 2px, oklch(0.22 0.018 240) 4px)",
          }}
        />
        <div className="absolute inset-x-0 h-12 bg-gradient-to-b from-transparent via-white/[0.04] to-transparent animate-scan" />
        {isAnalyzing && !isAlert && (
          <div className="absolute inset-x-0 h-8 bg-gradient-to-b from-transparent via-[var(--ok)]/15 to-transparent animate-scan" />
        )}
        {isAlert && <div className="absolute inset-0 bg-[var(--alert)]/10" />}
      </div>

      {/* TOP ROW — id+zone on the left, status pill on the right (review or live) */}
      <div className="relative z-10 flex items-center justify-between gap-1 px-1.5 py-1 text-[10px]">
        <span className="mono truncate rounded-sm bg-background/70 px-1.5 py-0.5 text-foreground/90 backdrop-blur-sm">
          {camera.id} · {camera.zone}
        </span>
        {isAlert ? (
          <span className="mono shrink-0 rounded-sm bg-alert px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-alert-foreground">
            review
          </span>
        ) : (
          <span className="flex shrink-0 items-center gap-1 rounded-sm bg-background/70 px-1.5 py-0.5 backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-ok animate-soft-pulse" />
            <span className="mono uppercase tracking-wider text-[9px] text-muted-foreground">
              live
            </span>
          </span>
        )}
      </div>

      {/* Spacer — feed area, no content here so nothing can collide */}
      <div className="relative z-10 flex-1" />

      {/* BOTTOM STRIP — device chip + last motion, single row, always visible */}
      <div className="relative z-10 flex items-center justify-between gap-1 bg-background/55 px-1.5 py-1 backdrop-blur-sm">
        <span className="flex min-w-0 items-center gap-1">
          <span
            className={[
              "mono inline-flex items-center gap-0.5 rounded-sm px-1 py-0.5 text-[9px] uppercase tracking-wider",
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
            <span className="mono inline-flex items-center gap-0.5 text-[9px] text-muted-foreground">
              <Battery className="h-2.5 w-2.5" />
              {camera.battery}
            </span>
          )}
          {isPhone && camera.signal && (
            <span className="mono inline-flex items-center gap-0.5 text-[9px] uppercase text-muted-foreground">
              <Signal className="h-2.5 w-2.5" />
              {camera.signal}
            </span>
          )}
        </span>
        <span className="mono shrink-0 truncate text-[9px] text-muted-foreground/80">
          {camera.lastMotion}
        </span>
      </div>

      {/* Confidence bar — sits below the bottom strip, never overlaps content */}
      <div className="relative z-10 h-[3px] bg-background/40">
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
