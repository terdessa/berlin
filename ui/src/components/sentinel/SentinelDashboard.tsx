import { useEffect, useMemo, useRef, useState } from "react";
import { RefreshCcw, Video } from "lucide-react";
import { CAMERA_CLIPS, CAMERA_WALL_ORDER, DASHBOARD_CAMERAS } from "@/lib/camera-config";
import type { Camera } from "@/lib/sentinel-data";
import { CameraTile } from "./CameraTile";
import { ChatPanel } from "./ChatPanel";
import { MetricsPanel } from "./MetricsPanel";
import DotField from "@/components/DotField";

// NOTE: the voice/LiveKit/Gemini backend has been removed pending a clean
// rewrite. This dashboard is intentionally UI-only — cameras render, the
// review log sits in its idle state, and the metrics evidence panel still
// reads its bundled JSON. There is no live alert source, no microphone
// publish, and no CV analysis loop wired up here.

type Cam3SourceKind = "camera" | "display";

async function listVideoInputs() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter((device) => device.kind === "videoinput" && device.deviceId);
}

function cameraLabel(device: MediaDeviceInfo, index: number) {
  return device.label?.trim() || `Camera ${index + 1}`;
}

export function SentinelDashboard() {
  const [selected, setSelected] = useState<string | null>(null);
  const [cam3Stream, setCam3Stream] = useState<MediaStream | null>(null);
  const [cam3Status, setCam3Status] = useState<"starting" | "ready" | "error">("starting");
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [cam3DeviceId, setCam3DeviceId] = useState<string | undefined>(undefined);
  const [cam3SourceKind, setCam3SourceKind] = useState<Cam3SourceKind>("camera");
  const [cam3TrackLabel, setCam3TrackLabel] = useState<string | null>(null);
  const [cameraListVersion, setCameraListVersion] = useState(0);

  const cam3VideoRef = useRef<HTMLVideoElement | null>(null);

  const cameras = useMemo(() => {
    return [...DASHBOARD_CAMERAS].sort((a, b) => {
      const ai = CAMERA_WALL_ORDER.indexOf(a.id);
      const bi = CAMERA_WALL_ORDER.indexOf(b.id);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
  }, []);

  // CAM-03 passive webcam preview. No frame capture, no analysis — the
  // upstream CV pipeline is gone. We keep the device picker so the demo
  // still has a "moving camera" tile that shows the laptop webcam or an
  // attached/Continuity camera.
  useEffect(() => {
    let cancelled = false;
    let openedStream: MediaStream | null = null;
    setCam3Status("starting");

    const openStream =
      cam3SourceKind === "display"
        ? navigator.mediaDevices.getDisplayMedia({
            video: { frameRate: { ideal: 24, max: 30 } },
            audio: false,
          })
        : navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              frameRate: { ideal: 24, max: 30 },
              ...(cam3DeviceId ? { deviceId: { exact: cam3DeviceId } } : {}),
            },
            audio: false,
          });

    openStream
      .then((stream) => {
        openedStream = stream;
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        setCam3Stream(stream);
        setCam3TrackLabel(stream.getVideoTracks()[0]?.label?.trim() || null);
        setCam3Status("ready");
        stream.getVideoTracks()[0]?.addEventListener("ended", () => {
          setCam3Status("error");
          setCam3Stream(null);
          setCam3TrackLabel(null);
        });
        listVideoInputs()
          .then((devices) => setVideoDevices(devices))
          .catch(() => {});
      })
      .catch(() => {
        if (!cancelled) {
          setCam3Status("error");
          setCam3TrackLabel(null);
        }
      });

    return () => {
      cancelled = true;
      openedStream?.getTracks().forEach((track) => track.stop());
      setCam3Stream((stream) => {
        if (stream === openedStream) return null;
        return stream;
      });
    };
  }, [cam3DeviceId, cam3SourceKind, cameraListVersion]);

  useEffect(() => {
    let cancelled = false;
    const refreshDevices = () => {
      listVideoInputs()
        .then((devices) => {
          if (!cancelled) setVideoDevices(devices);
        })
        .catch(() => {});
    };

    refreshDevices();
    navigator.mediaDevices.addEventListener?.("devicechange", refreshDevices);
    return () => {
      cancelled = true;
      navigator.mediaDevices.removeEventListener?.("devicechange", refreshDevices);
    };
  }, []);

  useEffect(() => {
    const video = cam3VideoRef.current;
    if (!video || !cam3Stream) return;
    video.srcObject = cam3Stream;
    void video.play().catch(() => {});
    return () => {
      if (video.srcObject === cam3Stream) video.srcObject = null;
    };
  }, [cam3Stream]);

  const handleCameraClick = (cameraId: string) => {
    const apply = () => setSelected((prev) => (prev === cameraId ? null : cameraId));
    const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
    if (typeof doc.startViewTransition === "function") {
      doc.startViewTransition(apply);
    } else {
      apply();
    }
  };

  const selectedCamera = useMemo(
    () => (selected ? (cameras.find((c) => c.id === selected) ?? null) : null),
    [cameras, selected],
  );

  const vtName = (id: string) => `cam-${id.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;

  const renderCameraTile = (camera: Camera, opts?: { large?: boolean }) => {
    const isSelected = selected === camera.id;
    return (
      <CameraTile
        key={camera.id}
        camera={camera}
        isAlert={false}
        isSelected={isSelected}
        compact={false}
        stream={camera.id === "CAM-03" ? cam3Stream : null}
        videoSrc={CAMERA_CLIPS[camera.id]}
        className={opts?.large ? "h-full w-full" : undefined}
        style={{ viewTransitionName: vtName(camera.id) }}
        onClick={() => handleCameraClick(camera.id)}
      />
    );
  };

  return (
    <main
      id="main"
      className="relative flex h-screen w-full flex-col overflow-hidden bg-background px-4 py-3 text-foreground"
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 z-0">
        <DotField />
      </div>
      <header className="relative z-10 grid h-12 flex-shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div />

        <span className="mono text-[1.4rem] font-bold uppercase leading-none tracking-[0.32em] text-foreground">
          SENTINEL
        </span>

        <div className="flex min-w-0 items-center justify-end gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <select
              value={
                cam3SourceKind === "display"
                  ? "__display__"
                  : cam3DeviceId
                    ? `device:${cam3DeviceId}`
                    : "__default__"
              }
              onChange={(event) => {
                const value = event.target.value;
                if (value === "__display__") {
                  setCam3SourceKind("display");
                  setCam3DeviceId(undefined);
                  return;
                }
                setCam3SourceKind("camera");
                setCam3DeviceId(
                  value.startsWith("device:") ? value.replace(/^device:/, "") : undefined,
                );
              }}
              className="mono h-9 min-h-9 max-w-[260px] cursor-pointer rounded-md border border-border bg-panel/80 px-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground transition-colors duration-200 hover:border-primary/40"
              aria-label="CAM-03 camera input"
              title="CAM-03 camera input"
            >
              <option value="__default__">CAM-03 · System default</option>
              <option value="__display__">CAM-03 · Screen/window source</option>
              {videoDevices.map((device, index) => (
                <option key={device.deviceId} value={`device:${device.deviceId}`}>
                  CAM-03 · {cameraLabel(device, index)}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={async () => {
                try {
                  const tempStream = await navigator.mediaDevices.getUserMedia({
                    video: true,
                    audio: false,
                  });
                  tempStream.getTracks().forEach((track) => track.stop());
                  const devices = await listVideoInputs();
                  setVideoDevices(devices);
                } catch {
                  // ignore — user denied or no device available
                }
                setCameraListVersion((value) => value + 1);
              }}
              className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md border border-border bg-panel/80 text-muted-foreground transition-colors duration-200 hover:border-primary/50 hover:text-foreground"
              aria-label="Refresh camera inputs (grants permission so iPhone / Continuity Camera shows up)"
              title="Refresh camera inputs (grants permission so iPhone / Continuity Camera shows up)"
            >
              <RefreshCcw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </header>

      <section className="relative z-10 mt-3 grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-hidden xl:grid-cols-[auto_minmax(360px,1fr)_260px] 2xl:grid-cols-[auto_minmax(400px,1fr)_300px]">
        <div
          className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-border/60 bg-panel/30"
          style={{ ["--col-w" as string]: "calc((100dvh - 180px) * 8 / 9 + 12px)" }}
        >
          <header className="flex items-center justify-between gap-2 border-b border-border/60 bg-panel-elevated/35 px-3 py-2">
            <div className="flex items-center gap-2">
              <Video className="h-4 w-4 text-primary" />
              <div className="mono text-[14px] uppercase tracking-[0.2em] text-primary">
                camera wall
              </div>
            </div>
            <span className="mono inline-flex items-center gap-1 rounded-full border border-border bg-background/40 px-2 py-0.5 text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-ok animate-soft-pulse" />
              {cameras.length} feeds
            </span>
          </header>

          <div className="flex min-h-0 flex-col items-start gap-3 overflow-hidden p-3">
            {selectedCamera ? (
              <div
                className="flex aspect-video items-stretch overflow-hidden"
                style={{ width: "var(--col-w)" }}
              >
                {renderCameraTile(selectedCamera, { large: true })}
              </div>
            ) : (
              <div
                className="mono flex aspect-video items-center justify-center overflow-hidden rounded-md border border-dashed border-border/50 bg-panel/30 px-6 text-[13px] uppercase tracking-[0.2em] text-muted-foreground/70"
                style={{ width: "var(--col-w)" }}
              >
                Select camera to preview
              </div>
            )}

            <div
              aria-label="Camera grid"
              className="grid grid-cols-3 grid-rows-3 gap-3 overflow-hidden"
              style={{
                width: "var(--col-w)",
                height: "calc((var(--col-w) - 24px) * 9 / 16 + 24px)",
              }}
            >
              {cameras.map((camera) => {
                if (selected === camera.id) {
                  const num = camera.id.match(/\d+/)?.[0] ?? camera.id;
                  return (
                    <div
                      key={camera.id}
                      aria-label={`${camera.id} previewing`}
                      className="mono flex aspect-video w-full items-center justify-center rounded-md border border-dashed border-border/50 bg-panel/30 text-2xl tracking-[0.2em] text-muted-foreground/60"
                    >
                      {num}
                    </div>
                  );
                }
                return renderCameraTile(camera);
              })}
            </div>
          </div>
        </div>

        <div className="flex min-h-0 min-w-0 flex-col overflow-hidden">
          <ChatPanel />
        </div>

        <div className="flex min-h-0 min-w-0 flex-col overflow-hidden">
          <MetricsPanel />
        </div>
      </section>

      <video
        ref={cam3VideoRef}
        autoPlay
        muted
        playsInline
        aria-hidden="true"
        className="pointer-events-none fixed -left-[9999px] top-0 h-px w-px opacity-0"
      />
    </main>
  );
}
