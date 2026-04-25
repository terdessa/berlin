import { useEffect, useRef, useState } from "react";
import { Smartphone, Video, Battery, Signal } from "lucide-react";
import type { RemoteVideoTrack } from "livekit-client";
import type { Camera } from "@/lib/sentinel-data";

type Props = {
  camera: Camera;
  isAlert?: boolean;
  isAnalyzing?: boolean;
  isSelected?: boolean;
  hasDemo?: boolean;
  /** When provided, the tile shows this live video instead of the placeholder. */
  liveTrack?: RemoteVideoTrack;
  /** Participant identity label shown on the tile when liveTrack is present. */
  liveIdentity?: string;
  onClick?: () => void;
};

export function CameraTile({
  camera,
  isAlert,
  isAnalyzing,
  isSelected,
  hasDemo,
  liveTrack,
  liveIdentity,
  onClick,
}: Props) {
  // Start at a fixed value so server and client render the same HTML.
  // A useEffect immediately randomises it client-side before the first paint.
  const [microConf, setMicroConf] = useState(0.65);
  const liveVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Seed with a random value on mount, then keep drifting.
    setMicroConf(isAlert ? 0.78 + Math.random() * 0.18 : 0.55 + Math.random() * 0.3);
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

  // Attach / detach the LiveKit track whenever it changes.
  useEffect(() => {
    const el = liveVideoRef.current;
    if (!el || !liveTrack) return;
    liveTrack.attach(el);
    return () => {
      liveTrack.detach(el);
    };
  }, [liveTrack]);

  const isLive = Boolean(liveTrack);
  const isPhone = isLive || camera.device === "live-phone";
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
      {/* Feed background — real video or placeholder gradient */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {isLive ? (
          // Live feed from a connected device
          <video
            ref={liveVideoRef}
            autoPlay
            muted
            playsInline
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          // Placeholder — fake scan-line effect
          <>
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
          </>
        )}
        {isAlert && <div className="absolute inset-0 bg-[var(--alert)]/10" />}
      </div>

      {/* TOP ROW — id+zone on the left, status pill on the right */}
      <div className="relative z-10 flex items-center justify-between gap-1 px-1.5 py-1 text-[10px]">
        <span className="mono truncate rounded-sm bg-background/70 px-1.5 py-0.5 text-foreground/90 backdrop-blur-sm">
          {camera.id} · {camera.zone}
        </span>
        {isAlert ? (
          <span className="mono shrink-0 rounded-sm bg-alert px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-alert-foreground">
            review
          </span>
        ) : hasDemo ? (
          <span className="mono shrink-0 rounded-sm border border-primary/50 bg-primary/15 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-primary backdrop-blur-sm">
            ▶ demo
          </span>
        ) : (
          <span className="flex shrink-0 items-center gap-1 rounded-sm bg-background/70 px-1.5 py-0.5 backdrop-blur-sm">
            <span
              className={[
                "h-1.5 w-1.5 rounded-full animate-soft-pulse",
                isLive ? "bg-primary" : "bg-ok",
              ].join(" ")}
            />
            <span className="mono uppercase tracking-wider text-[9px] text-muted-foreground">
              {isLive ? "streaming" : "live"}
            </span>
          </span>
        )}
      </div>

      {/* Spacer */}
      <div className="relative z-10 flex-1" />

      {/* BOTTOM STRIP */}
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
          {isLive && liveIdentity && (
            <span className="mono truncate text-[9px] text-muted-foreground">
              {liveIdentity}
            </span>
          )}
          {!isLive && isPhone && camera.battery !== undefined && (
            <span className="mono inline-flex items-center gap-0.5 text-[9px] text-muted-foreground">
              <Battery className="h-2.5 w-2.5" />
              {camera.battery}
            </span>
          )}
          {!isLive && isPhone && camera.signal && (
            <span className="mono inline-flex items-center gap-0.5 text-[9px] uppercase text-muted-foreground">
              <Signal className="h-2.5 w-2.5" />
              {camera.signal}
            </span>
          )}
        </span>
        <span className="mono shrink-0 truncate text-[9px] text-muted-foreground/80">
          {isLive ? "connected" : camera.lastMotion}
        </span>
      </div>

      {/* Confidence bar */}
      <div className="relative z-10 h-[3px] bg-background/40">
        <div
          className={[
            "h-full transition-all duration-700",
            isAlert ? "bg-alert" : isLive ? "bg-primary/80" : "bg-ok/70",
          ].join(" ")}
          style={{ width: `${confPct}%` }}
        />
      </div>
    </button>
  );
}
