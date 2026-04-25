import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AlertEvent, AlertStatus, Camera, Phase } from "@/lib/sentinel-data";
import { useLivekitFeeds } from "@/lib/use-livekit-feeds";
import { useSentinelVoiceEvents } from "@/lib/use-sentinel-voice-events";
import { AlertVideoPanel } from "./AlertVideoPanel";
import { AudioMetricPill } from "./AudioMetricBadge";
import { CameraTile } from "./CameraTile";
import { DashboardEvidencePanel } from "./DashboardEvidencePanel";
import { PoweredByFooter } from "./PoweredByFooter";
import { ReviewLogPanel } from "./ReviewLogPanel";

type TickerEntry = { id: number; at: string; text: string };

export function SentinelDashboard() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [status, setStatus] = useState<AlertStatus>("Awaiting human review");
  const [selected, setSelected] = useState<string | null>(null);
  const [latestEvent, setLatestEvent] = useState<TickerEntry | null>(null);
  const [liveAlert, setLiveAlert] = useState<AlertEvent | null>(null);
  const tickerIdRef = useRef(0);

  const voiceEvents = useSentinelVoiceEvents();
  const liveFeeds = useLivekitFeeds("sentinel-live");
  const alert: AlertEvent | null = liveAlert;
  const displayedRevealUpTo = alert?.conversation.length ?? 0;
  const isAlerting = phase !== "idle" && phase !== "resolved";

  const liveCameras = useMemo(
    () =>
      liveFeeds.map((feed, index) => {
        const inferredId = cameraIdFromIdentity(feed.identity);
        const id =
          inferredId ?? (liveFeeds.length === 1 && alert ? alert.cameraId : `LIVE-${index + 1}`);
        const zone = alert?.cameraId === id ? alert.zone : readableIdentity(feed.identity);

        return {
          feed,
          camera: {
            id,
            zone,
            lastMotion: "connected",
            device: "live-phone",
          } satisfies Camera,
        };
      }),
    [alert, liveFeeds],
  );

  const selectedCamera: Camera | null = selected
    ? (liveCameras.find(({ camera }) => camera.id === selected)?.camera ??
      (alert?.cameraId === selected
        ? {
            id: alert.cameraId,
            zone: alert.zone,
            lastMotion: "event received",
            device: "live-phone",
          }
        : null))
    : null;

  const pushTicker = useCallback((text: string) => {
    const at = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    setLatestEvent({ id: tickerIdRef.current++, at, text });
  }, []);

  useEffect(() => {
    if (!voiceEvents.latestAlert) return;
    setLiveAlert(voiceEvents.latestAlert);
    setSelected(voiceEvents.latestAlert.cameraId);
    setStatus(voiceEvents.latestAlert.actionTaken);
    setPhase(resolveLivePhase(voiceEvents.latestAlert));
    pushTicker(voiceEvents.latestTicker ?? "live voice · interaction received");
  }, [voiceEvents.latestAlert, voiceEvents.latestTicker, pushTicker]);

  const handleCameraClick = (cameraId: string) => {
    setSelected(cameraId);
    pushTicker(`feed · ${cameraId} · selected`);
  };

  return (
    <main className="flex h-screen w-full flex-col overflow-hidden px-4 py-2">
      <header className="flex flex-shrink-0 items-center justify-between gap-2 py-1">
        <div className="flex min-w-0 items-center gap-2">
          <div
            aria-live="polite"
            className={[
              "inline-flex shrink-0 items-center gap-2 rounded-full px-2.5 py-1 text-xs backdrop-blur-sm transition-colors",
              isAlerting ? "bg-alert/10 text-alert" : "bg-background/40 text-foreground/90",
            ].join(" ")}
          >
            <span
              className={[
                "h-2 w-2 rounded-full",
                isAlerting ? "bg-alert animate-alert-pulse" : "bg-ok animate-soft-pulse",
              ].join(" ")}
            />
            <span className="mono uppercase tracking-[0.18em] text-[10px]">
              {isAlerting && alert ? `flagged ${alert.cameraId} · review` : "live dashboard"}
            </span>
          </div>
          <AudioMetricPill />
        </div>
      </header>

      <section className="mt-2 grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.38fr)_minmax(380px,0.82fr)]">
        <div className="flex min-h-0 flex-col gap-3">
          <div aria-label="Camera grid" className="grid min-h-0 flex-[3] grid-cols-3 gap-2">
            {liveCameras.length > 0 ? (
              liveCameras.map(({ camera, feed }) => (
                <CameraTile
                  key={feed.sid}
                  camera={camera}
                  isAlert={alert?.cameraId === camera.id}
                  isSelected={selected === camera.id}
                  liveTrack={feed.track}
                  liveIdentity={feed.identity}
                  onClick={() => handleCameraClick(camera.id)}
                />
              ))
            ) : (
              <div className="col-span-3 flex min-h-[220px] items-center justify-center rounded-lg border border-dashed border-border bg-panel/40 px-4 text-center">
                <div>
                  <div className="mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    no camera publishers connected
                  </div>
                  <div className="mt-1 text-[12px] text-muted-foreground/80">
                    Live feeds appear here when a device publishes video to the Sentinel room.
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="grid min-h-0 flex-[2.15] grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.08fr)_minmax(340px,0.92fr)]">
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

      <footer className="mt-2 flex flex-shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-2">
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
    </main>
  );
}

function resolveLivePhase(alert: AlertEvent): Phase {
  if (alert.actionTaken !== "Awaiting human review") return "resolved";
  if (alert.conversation.some((message) => message.speaker === "guard")) return "interpreted";
  return "flagged";
}

function cameraIdFromIdentity(identity: string) {
  const match = identity.match(/cam[-_\s]?(\d{1,2})/i);
  if (!match) return null;
  return `CAM-${match[1].padStart(2, "0")}`;
}

function readableIdentity(identity: string) {
  return identity.replace(/[-_]+/g, " ");
}
