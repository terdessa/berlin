import { useEffect, useRef } from "react";
import type { Camera } from "@/lib/sentinel-data";

type Props = {
  camera: Camera;
  isAlert?: boolean;
  isSelected?: boolean;
  stream?: MediaStream | null;
  videoSrc?: string;
  className?: string;
  onClick?: () => void;
};

export function CameraTile({
  camera,
  isAlert,
  isSelected,
  stream,
  videoSrc,
  className,
  onClick,
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hasVideo = !!stream || !!videoSrc;

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;
    video.srcObject = stream;
    void video.play().catch(() => {});
    return () => {
      if (video.srcObject === stream) video.srcObject = null;
    };
  }, [stream]);

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
        className,
      ].join(" ")}
    >
      {hasVideo ? (
        <video
          ref={videoRef}
          src={stream ? undefined : videoSrc}
          autoPlay
          muted
          loop
          playsInline
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <>
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_28%_24%,rgba(18,194,180,0.18),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.07),rgba(255,255,255,0.01)_42%,rgba(18,194,180,0.08))]" />
          <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-primary/25 shadow-[0_0_18px_rgba(18,194,180,0.45)]" />
          <div className="pointer-events-none absolute inset-0 opacity-35 [background-image:linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:28px_28px]" />
        </>
      )}
      {hasVideo && (
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background/45 via-transparent to-background/55" />
      )}
      {isAlert && <div className="pointer-events-none absolute inset-0 bg-[var(--alert)]/12" />}

      <div className="relative z-10 flex items-center justify-between gap-1 px-1.5 py-1 text-[10px]">
        <span className="mono truncate rounded-sm bg-background/70 px-1.5 py-0.5 text-foreground/90 backdrop-blur-sm">
          {camera.id} · {camera.zone}
        </span>
      </div>

      <div className="relative z-10 flex-1" />

      <div className="relative z-10 h-1" />
    </button>
  );
}
