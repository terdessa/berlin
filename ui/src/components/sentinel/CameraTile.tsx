import { useEffect, useRef } from "react";
import { Smartphone, Video } from "lucide-react";
import type { RemoteVideoTrack } from "livekit-client";
import type { Camera } from "@/lib/sentinel-data";

type Props = {
  camera: Camera;
  isAlert?: boolean;
  isSelected?: boolean;
  liveTrack: RemoteVideoTrack;
  liveIdentity?: string;
  onClick?: () => void;
};

export function CameraTile({
  camera,
  isAlert,
  isSelected,
  liveTrack,
  liveIdentity,
  onClick,
}: Props) {
  const liveVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const el = liveVideoRef.current;
    if (!el) return;
    liveTrack.attach(el);
    return () => {
      liveTrack.detach(el);
    };
  }, [liveTrack]);

  const isPhone = camera.device === "live-phone";

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
      <video
        ref={liveVideoRef}
        autoPlay
        muted
        playsInline
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
      />
      {isAlert && <div className="pointer-events-none absolute inset-0 bg-[var(--alert)]/10" />}

      <div className="relative z-10 flex items-center justify-between gap-1 px-1.5 py-1 text-[10px]">
        <span className="mono truncate rounded-sm bg-background/70 px-1.5 py-0.5 text-foreground/90 backdrop-blur-sm">
          {camera.id} · {camera.zone}
        </span>
        <span
          className={[
            "mono shrink-0 rounded-sm px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider backdrop-blur-sm",
            isAlert
              ? "bg-alert text-alert-foreground"
              : "border border-primary/40 bg-primary/15 text-primary",
          ].join(" ")}
        >
          {isAlert ? "review" : "streaming"}
        </span>
      </div>

      <div className="relative z-10 flex-1" />

      <div className="relative z-10 flex items-center justify-between gap-1 bg-background/55 px-1.5 py-1 backdrop-blur-sm">
        <span className="flex min-w-0 items-center gap-1">
          <span className="mono inline-flex items-center gap-0.5 rounded-sm border border-primary/40 bg-primary/10 px-1 py-0.5 text-[9px] uppercase tracking-wider text-primary">
            {isPhone ? <Smartphone className="h-2.5 w-2.5" /> : <Video className="h-2.5 w-2.5" />}
            {isPhone ? "phone" : "video"}
          </span>
          {liveIdentity && (
            <span className="mono truncate text-[9px] text-muted-foreground">{liveIdentity}</span>
          )}
        </span>
        <span className="mono shrink-0 text-[9px] text-muted-foreground/80">connected</span>
      </div>
    </button>
  );
}
