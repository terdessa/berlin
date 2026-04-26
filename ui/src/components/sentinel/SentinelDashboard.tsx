import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshCcw } from "lucide-react";
import { CAMERA_CLIPS, CAMERA_WALL_ORDER, DASHBOARD_CAMERAS } from "@/lib/camera-config";
import type { AlertEvent, AlertStatus, Camera, Phase } from "@/lib/sentinel-data";
import { AlertVideoPanel } from "./AlertVideoPanel";
import { AudioMetricPill } from "./AudioMetricBadge";
import { CameraTile } from "./CameraTile";
import { DashboardEvidencePanel } from "./DashboardEvidencePanel";
import { PoweredByFooter } from "./PoweredByFooter";
import { ReviewLogPanel } from "./ReviewLogPanel";

// NOTE: the voice/LiveKit/Gemini backend has been removed pending a clean
// rewrite. This dashboard is intentionally UI-only — cameras render, the
// review log sits in its idle state, and the metrics evidence panel still
// reads its bundled JSON. There is no live alert source, no microphone
// publish, and no CV analysis loop wired up here.

type TickerEntry = { id: number; at: string; text: string };
type Cam3SourceKind = "camera" | "display";

async function listVideoInputs() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter((device) => device.kind === "videoinput" && device.deviceId);
}

function cameraLabel(device: MediaDeviceInfo, index: number) {
  return device.label?.trim() || `Camera ${index + 1}`;
}

export function SentinelDashboard() {
  const [phase] = useState<Phase>("idle");
  const [status] = useState<AlertStatus>("Awaiting human review");
  const [selected, setSelected] = useState<string | null>(null);
  const [latestEvent, setLatestEvent] = useState<TickerEntry | null>(null);
  const [cam3Stream, setCam3Stream] = useState<MediaStream | null>(null);
  const [cam3Status, setCam3Status] = useState<"starting" | "ready" | "error">("starting");
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [cam3DeviceId, setCam3DeviceId] = useState<string | undefined>(undefined);
  const [cam3SourceKind, setCam3SourceKind] = useState<Cam3SourceKind>("camera");
  const [cam3TrackLabel, setCam3TrackLabel] = useState<string | null>(null);
  const [cameraListVersion, setCameraListVersion] = useState(0);

  const tickerIdRef = useRef(0);
  const cam3VideoRef = useRef<HTMLVideoElement | null>(null);

  // No live alert source — review log will render its idle state.
  const alert: AlertEvent | null = null;
  const displayedRevealUpTo = 0;
  const isAlerting = false;

  const cameras = useMemo(() => {
    return [...DASHBOARD_CAMERAS].sort((a, b) => {
      const ai = CAMERA_WALL_ORDER.indexOf(a.id);
      const bi = CAMERA_WALL_ORDER.indexOf(b.id);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
  }, []);

  const cameraById = useMemo(() => {
    const map = new Map<string, Camera>();
    for (const camera of cameras) map.set(camera.id, camera);
    return map;
  }, [cameras]);

  const selectedCamera: Camera | null = selected ? (cameraById.get(selected) ?? null) : null;

  const activeDeviceLabel = useMemo(() => {
    if (cam3Status === "error") return "camera blocked";
    if (cam3Status === "starting") return "opening input";
    if (cam3SourceKind === "display") return "screen or window";
    if (cam3TrackLabel) return cam3TrackLabel;
    const device = videoDevices.find((item) => item.deviceId === cam3DeviceId);
    return device ? cameraLabel(device, videoDevices.indexOf(device)) : "system default";
  }, [cam3DeviceId, cam3SourceKind, cam3Status, cam3TrackLabel, videoDevices]);

  const cam3StatusLabel =
    cam3Status === "ready"
      ? "live preview"
      : cam3Status === "starting"
        ? "connecting"
        : "camera blocked";

  const pushTicker = useCallback((text: string) => {
    const at = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    setLatestEvent({ id: tickerIdRef.current++, at, text });
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
    setSelected(cameraId);
    pushTicker(`feed · ${cameraId} · selected`);
  };

  const renderCameraTile = (camera: Camera) => (
    <CameraTile
      key={camera.id}
      camera={camera}
      isAlert={false}
      isSelected={selected === camera.id}
      stream={camera.id === "CAM-03" ? cam3Stream : null}
      videoSrc={CAMERA_CLIPS[camera.id]}
      className={
        camera.id === "CAM-03" ? "lg:col-span-2 lg:row-span-2 lg:aspect-auto lg:h-full" : undefined
      }
      onClick={() => handleCameraClick(camera.id)}
    />
  );

  return (
    <main className="flex h-screen w-full flex-col overflow-hidden bg-background px-3 py-2 text-foreground">
      <header className="flex h-11 flex-shrink-0 items-center justify-between gap-3 border-b border-border/70 pb-2">
        <div className="flex min-w-0 items-center gap-2">
          <div
            aria-live="polite"
            className={[
              "inline-flex shrink-0 items-center gap-2 rounded-md border px-2.5 py-1 text-xs backdrop-blur-sm transition-colors",
              isAlerting
                ? "border-alert/50 bg-alert/10 text-alert"
                : "border-border bg-panel/70 text-foreground/90",
            ].join(" ")}
          >
            <span
              className={[
                "h-2 w-2 rounded-full",
                isAlerting ? "bg-alert animate-alert-pulse" : "bg-ok animate-soft-pulse",
              ].join(" ")}
            />
            <span className="mono uppercase tracking-[0.18em] text-[10px]">sentinel ops</span>
          </div>
          <AudioMetricPill />
        </div>

        <div className="flex min-w-0 items-center justify-end gap-2">
          <span className="mono hidden truncate text-[10px] uppercase tracking-[0.16em] text-muted-foreground md:inline">
            CAM-03 · {cam3StatusLabel} · {activeDeviceLabel}
          </span>
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
              className="mono h-8 max-w-[280px] rounded-md border border-border bg-panel/80 px-2 text-[10px] uppercase tracking-[0.12em] text-muted-foreground outline-none transition focus:border-primary/60"
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
              onClick={() => setCameraListVersion((value) => value + 1)}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-panel/80 text-muted-foreground transition hover:border-primary/50 hover:text-foreground"
              aria-label="Refresh camera inputs"
              title="Refresh camera inputs"
            >
              <RefreshCcw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </header>

      <section className="mt-2 grid min-h-0 flex-1 grid-cols-1 gap-2 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.34fr)] 2xl:grid-cols-[minmax(0,1fr)_minmax(390px,0.32fr)]">
        <div className="flex min-h-0 flex-col gap-2">
          <div className="flex flex-shrink-0 items-center justify-between gap-3 rounded-md border border-border/70 bg-panel/70 px-3 py-1.5">
            <div>
              <div className="mono text-[10px] uppercase tracking-[0.2em] text-primary">
                camera wall
              </div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">
                8 feeds · CAM-03 enlarged · backend pending rewrite
              </div>
            </div>
            <div className="mono text-right text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              <div suppressHydrationWarning>
                {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </div>
              <div className="mt-0.5 text-primary">recording</div>
            </div>
          </div>

          <div
            aria-label="Camera grid"
            className="grid min-h-0 flex-[5.5] auto-rows-fr grid-cols-2 gap-2 lg:grid-cols-3 xl:grid-cols-4"
          >
            {cameras.map(renderCameraTile)}
          </div>

          <div className="grid min-h-[138px] flex-[1.15] grid-cols-1 gap-2 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
            <div className="min-h-0">
              <AlertVideoPanel alert={alert} selectedCamera={selectedCamera} />
            </div>
            <div className="min-h-0">
              <DashboardEvidencePanel />
            </div>
          </div>
        </div>

        <div className="min-h-0">
          <ReviewLogPanel
            alert={alert}
            phase={phase}
            revealUpTo={displayedRevealUpTo}
            status={status}
            selectedCameraId={selected}
          />
        </div>
      </section>

      <footer className="mt-2 flex h-7 flex-shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-1.5">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {latestEvent && (
            <span className="mono truncate text-[10px] text-muted-foreground/80">
              <span className="text-muted-foreground/60">{latestEvent.at}</span> ·{" "}
              {latestEvent.text}
            </span>
          )}
        </div>
        <PoweredByFooter />
      </footer>

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
