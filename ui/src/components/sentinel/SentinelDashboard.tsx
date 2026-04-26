import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshCcw } from "lucide-react";
import { CAMERA_CLIPS, CAMERA_WALL_ORDER, DASHBOARD_CAMERAS } from "@/lib/camera-config";
import { analyzeCameraFrame } from "@/lib/gemini-camera-analysis";
import type { AlertEvent, AlertStatus, Camera, Phase } from "@/lib/sentinel-data";
import { useSentinelRoom } from "@/lib/use-sentinel-room";
import { AlertVideoPanel } from "./AlertVideoPanel";
import { AudioMetricPill } from "./AudioMetricBadge";
import { CameraTile } from "./CameraTile";
import { DashboardEvidencePanel } from "./DashboardEvidencePanel";
import { PoweredByFooter } from "./PoweredByFooter";
import { ReviewLogPanel } from "./ReviewLogPanel";

type TickerEntry = { id: number; at: string; text: string };
type Cam3SourceKind = "camera" | "display";

const CAM3_ANALYSIS_PROMPT =
  "Watch CAM-03 for a person taking any object from a shelf, table, or display and holding it in their hand. The trigger is the moment a hand visibly grips an item that was just picked up. Ignore people walking by empty-handed, pointing, or only touching items without lifting them.";
const CAM3_ANALYSIS_INTERVAL_MS = 2_000;
// 5 fps × 1 s burst → Gemini sees actual motion, not a single still.
const CAM3_FRAMES_PER_ANALYSIS = 5;
const CAM3_FRAME_INTERVAL_MS = 200;
// One alert per page-load. Refresh the dashboard to re-arm.
const CAM3_SESSION_ID =
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

async function listVideoInputs() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter((device) => device.kind === "videoinput" && device.deviceId);
}

function cameraLabel(device: MediaDeviceInfo, index: number) {
  return device.label?.trim() || `Camera ${index + 1}`;
}

export function SentinelDashboard() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [status, setStatus] = useState<AlertStatus>("Awaiting human review");
  const [selected, setSelected] = useState<string | null>(null);
  const [latestEvent, setLatestEvent] = useState<TickerEntry | null>(null);
  const [liveAlert, setLiveAlert] = useState<AlertEvent | null>(null);
  const [cam3Stream, setCam3Stream] = useState<MediaStream | null>(null);
  const [cam3Status, setCam3Status] = useState<"starting" | "ready" | "error">("starting");
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [cam3DeviceId, setCam3DeviceId] = useState<string | undefined>(undefined);
  const [cam3SourceKind, setCam3SourceKind] = useState<Cam3SourceKind>("camera");
  const [cam3TrackLabel, setCam3TrackLabel] = useState<string | null>(null);
  const [cameraListVersion, setCameraListVersion] = useState(0);

  const tickerIdRef = useRef(0);
  const cam3VideoRef = useRef<HTMLVideoElement | null>(null);
  const cam3CanvasRef = useRef<HTMLCanvasElement | null>(null);
  const cam3BusyRef = useRef(false);
  const lastCam3AlertAtRef = useRef(0);

  const sentinel = useSentinelRoom({ withMic: false });
  const alert: AlertEvent | null = liveAlert;
  const displayedRevealUpTo = alert?.conversation.length ?? 0;
  const isAlerting = phase !== "idle" && phase !== "resolved";

  const cameras = useMemo(() => {
    const base =
      !alert || DASHBOARD_CAMERAS.some((camera) => camera.id === alert.cameraId)
        ? DASHBOARD_CAMERAS
        : [
            {
              id: alert.cameraId,
              zone: alert.zone,
            } satisfies Camera,
            ...DASHBOARD_CAMERAS.slice(1),
          ];

    return [...base].sort((a, b) => {
      const ai = CAMERA_WALL_ORDER.indexOf(a.id);
      const bi = CAMERA_WALL_ORDER.indexOf(b.id);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
  }, [alert]);

  const cameraById = useMemo(() => {
    const map = new Map<string, Camera>();
    for (const camera of cameras) map.set(camera.id, camera);
    return map;
  }, [cameras]);

  const selectedCamera: Camera | null = selected
    ? (cameraById.get(selected) ??
      (alert?.cameraId === selected
        ? {
            id: alert.cameraId,
            zone: alert.zone,
          }
        : null))
    : null;

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
      ? "live analysis"
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

  const captureCam3SmallFrame = useCallback(() => {
    const video = cam3VideoRef.current;
    const canvas = cam3CanvasRef.current;
    if (!video || !canvas || video.videoWidth === 0 || video.videoHeight === 0) return null;
    const width = Math.min(360, video.videoWidth);
    const height = Math.round((width / video.videoWidth) * video.videoHeight);
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(video, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", 0.55);
  }, []);

  const publishCam3Alert = useCallback(
    async (summary: string) => {
      // Stable per-page-load id — the agent's spoken_visual_event_ids set
      // dedupes this so the alert speaks once per session no matter how many
      // HOLD frames Gemini emits. Refresh the dashboard to re-arm.
      const eventId = `event-cam-03-hold-${CAM3_SESSION_ID}`;
      const alertEvent: AlertEvent = {
        cameraId: "CAM-03",
        zone: "Moving camera",
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
        sceneSummary: summary,
        visualConfidence: 0.82,
        assistantMessage: `Moving camera requires review. ${summary}`,
        conversation: [],
        actionTaken: "Awaiting human review",
      };

      setLiveAlert(alertEvent);
      setSelected("CAM-03");
      setStatus("Awaiting human review");
      setPhase("flagged");
      pushTicker(`CAM-03 · visual alert · ${summary}`);

      const frameDataUrl = captureCam3SmallFrame();

      const published = await sentinel.publishVisualAlert({
        eventId,
        cameraId: "CAM-03",
        zone: "Moving camera",
        summary,
        confidence: alertEvent.visualConfidence,
        frameBase64: frameDataUrl ?? undefined,
        frameMimeType: "image/jpeg",
      });

      if (!published.ok) {
        pushTicker(`CAM-03 · walkie-talkie alert failed · ${published.message}`);
      }
    },
    [captureCam3SmallFrame, pushTicker, sentinel],
  );

  const captureCam3Frame = useCallback(() => {
    const video = cam3VideoRef.current;
    const canvas = cam3CanvasRef.current;
    if (!video || !canvas || video.videoWidth === 0 || video.videoHeight === 0) return null;

    // 5-frame bursts: shrink each frame so the total JSON payload stays under
    // the dev server's ~80 KB body parse ceiling. ~320 wide × q 0.4 ≈ 8–12 KB
    // each → 5 frames ≈ 40–60 KB.
    const width = Math.min(320, video.videoWidth);
    const height = Math.round((width / video.videoWidth) * video.videoHeight);
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(video, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", 0.4);
  }, []);

  const captureCam3Sequence = useCallback(async () => {
    const frames: string[] = [];
    for (let i = 0; i < CAM3_FRAMES_PER_ANALYSIS; i++) {
      const frame = captureCam3Frame();
      if (frame) frames.push(frame);
      if (i < CAM3_FRAMES_PER_ANALYSIS - 1) {
        await new Promise((resolve) => window.setTimeout(resolve, CAM3_FRAME_INTERVAL_MS));
      }
    }
    return frames;
  }, [captureCam3Frame]);

  const analyzeCam3 = useCallback(async () => {
    if (cam3BusyRef.current || cam3Status !== "ready") return;
    cam3BusyRef.current = true;

    try {
      const frames = await captureCam3Sequence();
      if (frames.length === 0) return;

      const result = await analyzeCameraFrame({
        data: {
          imageBase64: frames[0],
          imageFramesBase64: frames,
          prompt: CAM3_ANALYSIS_PROMPT,
          mode: "object-hold",
        },
      }).catch((err: unknown) => ({
        ok: false as const,
        message: err instanceof Error ? err.message : "CAM-03 analysis failed before Gemini ran.",
      }));

      if (!result.ok) {
        pushTicker(`CAM-03 · analysis unavailable · ${result.message}`);
        return;
      }

      if (!/^\s*HOLD\b/i.test(result.text)) return;

      // One alert per page-load. Refresh to re-arm.
      if (lastCam3AlertAtRef.current > 0) return;
      lastCam3AlertAtRef.current = Date.now();

      // Placeholder framing: the visible trigger is still a palm gesture, but
      // the alert is presented to the guard as a shelf-pickup event so the
      // demo flow reads as "item taken → walkie-talkie alert → human review".
      await publishCam3Alert("item appears taken from shelf");
    } finally {
      cam3BusyRef.current = false;
    }
  }, [cam3Status, captureCam3Sequence, publishCam3Alert, pushTicker]);

  useEffect(() => {
    let cancelled = false;
    let openedStream: MediaStream | null = null;
    setCam3Status("starting");

    const openStream =
      cam3SourceKind === "display"
        ? navigator.mediaDevices.getDisplayMedia({
            video: {
              frameRate: { ideal: 24, max: 30 },
            },
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

  useEffect(() => {
    if (cam3Status !== "ready") return;
    void analyzeCam3();
    const id = window.setInterval(() => {
      void analyzeCam3();
    }, CAM3_ANALYSIS_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [analyzeCam3, cam3Status]);

  useEffect(() => {
    if (!sentinel.latestAlert) return;
    setLiveAlert(sentinel.latestAlert);
    setSelected(sentinel.latestAlert.cameraId);
    setStatus(sentinel.latestAlert.actionTaken);
    setPhase(resolveLivePhase(sentinel.latestAlert));
    pushTicker(sentinel.latestTicker ?? "live voice · interaction received");
  }, [sentinel.latestAlert, sentinel.latestTicker, pushTicker]);

  const handleCameraClick = (cameraId: string) => {
    setSelected(cameraId);
    pushTicker(`feed · ${cameraId} · selected`);
  };

  const renderCameraTile = (camera: Camera) => (
    <CameraTile
      key={camera.id}
      camera={camera}
      isAlert={alert?.cameraId === camera.id}
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
            <span className="mono uppercase tracking-[0.18em] text-[10px]">
              {isAlerting && alert ? `flagged ${alert.cameraId} · review` : "sentinel ops"}
            </span>
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
                8 feeds · CAM-03 enlarged · Gemini analysis active
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
      <canvas ref={cam3CanvasRef} className="hidden" />
    </main>
  );
}

function resolveLivePhase(alert: AlertEvent): Phase {
  if (alert.actionTaken !== "Awaiting human review") return "resolved";
  if (alert.conversation.some((message) => message.speaker === "guard")) return "interpreted";
  return "flagged";
}
