import { Link, createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LocalVideoTrack, RemoteTrack, RemoteVideoTrack, Room } from "livekit-client";
import { issueLivekitToken } from "@/lib/livekit-token";
import { LivePageSkeleton } from "@/lib/live-page-skeleton";
import { useLivekitStats } from "@/lib/use-livekit-stats";
import { LiveStatsPanel } from "@/lib/live-stats-panel";

export const Route = createFileRoute("/video")({
  component: VideoPage,
  head: () => ({
    meta: [
      { title: "Sentinel - Live camera publisher" },
      {
        name: "description",
        content:
          "Direct-link camera publisher for Sentinel. Streams the device camera into a LiveKit room.",
      },
      // Direct-link page only - keep it out of search indexes.
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

const DEFAULT_ROOM = "sentinel-live";

const CAM_WIDTH = 1280;
const CAM_HEIGHT = 720;
const CAM_FPS = 30;
// Target bitrate sent to LiveKit (bits per second).
const CAM_MAX_BITRATE = 2_500_000; // 2.5 Mbps — standard for 720p30

async function openCamera(deviceId?: string): Promise<MediaStream> {
  const base: MediaTrackConstraints = {
    width: { ideal: CAM_WIDTH },
    height: { ideal: CAM_HEIGHT },
    frameRate: { ideal: CAM_FPS, max: CAM_FPS },
  };
  const video: MediaTrackConstraints = deviceId
    ? { ...base, deviceId: { exact: deviceId } }
    : { ...base, facingMode: { ideal: "environment" } };
  return navigator.mediaDevices.getUserMedia({ video, audio: false });
}

// After permission is granted, enumerate video inputs and return them with labels.
async function listVideoDevices(): Promise<MediaDeviceInfo[]> {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter((d) => d.kind === "videoinput" && d.deviceId);
}

function friendlyLabel(d: MediaDeviceInfo, idx: number): string {
  const raw = d.label?.trim();
  return raw || `Camera ${idx + 1}`;
}

type Status =
  | { state: "idle" }
  | { state: "media-error"; message: string }
  | { state: "local-only"; reason: string }
  | { state: "connecting" }
  | { state: "connected" }
  | { state: "disconnected" }
  | { state: "error"; message: string };

type RemoteFeed = {
  sid: string;
  identity: string;
  track: RemoteVideoTrack;
};

function pickPlatformLabel() {
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return "phone-ios";
  if (/android/.test(ua)) return "phone-android";
  if (/macintosh|mac os/.test(ua)) return "mac";
  if (/windows/.test(ua)) return "win";
  if (/linux/.test(ua)) return "linux";
  return "device";
}

function makeIdentity() {
  return `${pickPlatformLabel()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Outer component: gates the interactive page behind a mount-time flag so
// SSR renders a stable skeleton (no `navigator`, no `Math.random`) and the
// real page boots only after hydration.
function VideoPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <LivePageSkeleton title="Sentinel · live camera publisher" />;
  return <VideoPageInner />;
}

function VideoPageInner() {
  const identity = useMemo(makeIdentity, []);
  const room = useMemo(() => {
    const fromQuery = new URLSearchParams(window.location.search).get("room");
    return fromQuery?.trim() || DEFAULT_ROOM;
  }, []);

  const [status, setStatus] = useState<Status>({ state: "idle" });
  const [cameraOn, setCameraOn] = useState(true);
  const [remotes, setRemotes] = useState<RemoteFeed[]>([]);
  const [copyHint, setCopyHint] = useState<string | null>(null);
  // Mirrored as state so the stats hook re-runs when LiveKit connects/disconnects.
  const [lkRoom, setLkRoom] = useState<Room | null>(null);
  // Camera picker state
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [activeDeviceId, setActiveDeviceId] = useState<string | undefined>(undefined);
  const [switching, setSwitching] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const roomRef = useRef<Room | null>(null);
  const localTrackRef = useRef<LocalVideoTrack | null>(null);
  const remoteRefs = useRef<Map<string, HTMLVideoElement | null>>(new Map());

  const flows = useLivekitStats(lkRoom);

  // Switch to a different camera while the page is running.
  const onSwitchCamera = useCallback(
    async (deviceId: string) => {
      if (switching || deviceId === activeDeviceId) return;
      setSwitching(true);
      try {
        const newStream = await openCamera(deviceId);
        const newVideoTrack = newStream.getVideoTracks()[0];
        if (!newVideoTrack) return;

        // Swap in the local preview
        const oldStream = localStreamRef.current;
        oldStream?.getTracks().forEach((t) => t.stop());
        localStreamRef.current = newStream;
        if (localVideoRef.current) localVideoRef.current.srcObject = newStream;

        // Replace the track in the LiveKit publication if connected
        const lkTrack = localTrackRef.current;
        if (lkTrack) {
          try {
            await lkTrack.replaceTrack(newVideoTrack);
          } catch {
            // replaceTrack not available in older SDK versions - no-op
          }
        }

        setActiveDeviceId(deviceId);
        setCameraOn(true);
      } catch {
        // Camera switch failed - leave the current stream running
      } finally {
        setSwitching(false);
      }
    },
    [switching, activeDeviceId],
  );

  useEffect(() => {
    let cancelled = false;
    let cleanup = () => {};

    (async () => {
      // 1. Local preview first - usable even if LiveKit isn't configured.
      let stream: MediaStream;
      try {
        stream = await openCamera();
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        setStatus({ state: "media-error", message });
        return;
      }
      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Track which deviceId is active and enumerate all cameras now that
      // permission was granted (labels are empty strings before permission).
      const activeTrack = stream.getVideoTracks()[0];
      const currentDeviceId = activeTrack?.getSettings().deviceId;
      setActiveDeviceId(currentDeviceId);
      listVideoDevices()
        .then((devs) => setVideoDevices(devs))
        .catch(() => {});

      // 2. Token + LiveKit connect (skip gracefully if not configured).
      const tokenResult = await issueLivekitToken({ data: { room, identity } });
      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      if (!tokenResult.ok) {
        setStatus({ state: "local-only", reason: tokenResult.message });
        cleanup = () => {
          stream.getTracks().forEach((t) => t.stop());
        };
        return;
      }

      setStatus({ state: "connecting" });

      const livekit = await import("livekit-client");
      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      const lkRoom = new livekit.Room({
        adaptiveStream: true,
        dynacast: true,
      });
      roomRef.current = lkRoom;
      setLkRoom(lkRoom);

      lkRoom
        .on(livekit.RoomEvent.TrackSubscribed, (track, _pub, participant) => {
          if (track.kind !== livekit.Track.Kind.Video) return;
          const sid = track.sid ?? `${participant.sid}-${track.source}`;
          const feed: RemoteFeed = {
            sid,
            identity: participant.identity,
            track: track as RemoteVideoTrack,
          };
          setRemotes((prev) => [...prev.filter((r) => r.sid !== sid), feed]);
        })
        .on(livekit.RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
          const sid = track.sid;
          if (!sid) return;
          setRemotes((prev) => prev.filter((r) => r.sid !== sid));
        })
        .on(livekit.RoomEvent.ParticipantDisconnected, (participant) => {
          setRemotes((prev) => prev.filter((r) => r.identity !== participant.identity));
        })
        .on(livekit.RoomEvent.Disconnected, () => {
          setStatus({ state: "disconnected" });
          setLkRoom(null);
        });

      try {
        await lkRoom.connect(tokenResult.url, tokenResult.token);

        // Reuse the camera we already opened - wrap its MediaStreamTrack as a
        // LiveKit local track instead of re-acquiring (which would briefly
        // re-prompt on some platforms and double-open the camera).
        const videoTrack = stream.getVideoTracks()[0];
        if (!videoTrack) throw new Error("camera has no video track");
        const localTrack = new livekit.LocalVideoTrack(videoTrack);
        localTrackRef.current = localTrack;
        await lkRoom.localParticipant.publishTrack(localTrack, {
          source: livekit.Track.Source.Camera,
          name: "camera",
          // Single-layer encoding: no simulcast overhead on a constrained
          // mobile-hotspot uplink. Cap matches CAM_MAX_BITRATE above.
          simulcast: false,
          videoEncoding: {
            maxBitrate: CAM_MAX_BITRATE,
            maxFramerate: CAM_FPS,
          },
        });

        if (cancelled) {
          await lkRoom.disconnect();
          return;
        }
        setStatus({ state: "connected" });
        setCameraOn(!videoTrack.muted && videoTrack.enabled !== false);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setStatus({ state: "error", message });
        try {
          await lkRoom.disconnect();
        } catch {
          // Disconnect can race with LiveKit's own cleanup.
        }
      }

      cleanup = () => {
        try {
          localTrackRef.current?.stop();
        } catch {
          // The browser may have already ended the track.
        }
        try {
          lkRoom.disconnect();
        } catch {
          // Disconnect can race with LiveKit's own cleanup.
        }
        setLkRoom(null);
        // LocalVideoTrack.stop() releases the underlying MediaStreamTrack, but
        // if we never wrapped it (local-only mode), stop the raw stream too.
        stream.getTracks().forEach((t) => {
          try {
            t.stop();
          } catch {
            // Some tracks may already be stopped during page teardown.
          }
        });
      };
    })();

    return () => {
      cancelled = true;
      cleanup();
    };
    // identity + room are stable for the lifetime of the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-attach remote tracks when the list changes.
  useEffect(() => {
    for (const r of remotes) {
      const el = remoteRefs.current.get(r.sid);
      if (el) r.track.attach(el);
    }
  }, [remotes]);

  const onToggleCamera = async () => {
    const lkTrack = localTrackRef.current;
    const stream = localStreamRef.current;

    if (cameraOn) {
      // Mute: prefer LiveKit's mute() so remote subscribers see "muted",
      // otherwise fall back to disabling the raw track for local preview.
      if (lkTrack) {
        try {
          await lkTrack.mute();
        } catch {
          // Keep the local UI responsive even if LiveKit is already gone.
        }
      } else if (stream) {
        for (const t of stream.getVideoTracks()) t.enabled = false;
      } else {
        return;
      }
      setCameraOn(false);
    } else {
      if (lkTrack) {
        try {
          await lkTrack.unmute();
        } catch {
          // The user can retry by toggling the camera again.
        }
      } else if (stream) {
        for (const t of stream.getVideoTracks()) t.enabled = true;
      } else {
        return;
      }
      setCameraOn(true);
    }
  };

  const onCopyLink = async () => {
    if (typeof window === "undefined") return;
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopyHint("link copied");
    } catch {
      setCopyHint("copy failed - long-press the address bar");
    }
    setTimeout(() => setCopyHint(null), 1800);
  };

  return (
    <main className="min-h-screen px-6 py-5">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <h1 className="mono text-sm uppercase tracking-[0.2em] text-foreground">
            Sentinel · live camera publisher
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Direct-link page · publishes this device's camera to a shared LiveKit room.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusPill status={status} />
          <Link
            to="/"
            className="mono rounded-md border border-border px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground transition hover:border-primary/50 hover:text-foreground"
          >
            ← dashboard
          </Link>
        </div>
      </header>

      <section className="mt-5 grid gap-5 lg:grid-cols-[2fr_1fr]">
        <div className="overflow-hidden rounded-lg border border-border bg-panel">
          <div className="relative aspect-video w-full bg-background">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="h-full w-full object-cover"
            />
            <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between p-3 text-xs">
              <span className="mono rounded-sm bg-background/70 px-2 py-1 text-foreground/90 backdrop-blur-sm">
                local · {identity}
              </span>
              <span className="mono rounded-sm bg-background/70 px-2 py-1 text-muted-foreground backdrop-blur-sm">
                room: {room}
              </span>
            </div>
            {!cameraOn && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/80">
                <span className="mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  camera muted
                </span>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2 border-t border-border bg-panel-elevated px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onToggleCamera}
                disabled={
                  status.state === "idle" ||
                  status.state === "media-error" ||
                  status.state === "connecting"
                }
                className="mono rounded-md border border-border bg-background/60 px-3 py-1.5 text-xs text-foreground transition hover:border-primary/50 hover:bg-background disabled:cursor-not-allowed disabled:opacity-40"
              >
                {cameraOn ? "■ stop camera" : "▶ resume camera"}
              </button>
              <button
                type="button"
                onClick={onCopyLink}
                className="mono rounded-md border border-border bg-background/60 px-3 py-1.5 text-xs text-foreground transition hover:border-primary/50 hover:bg-background"
              >
                ⧉ copy phone link
              </button>
              {copyHint && (
                <span className="mono text-[10px] uppercase tracking-[0.18em] text-primary">
                  {copyHint}
                </span>
              )}
            </div>

            {/* Camera picker — shown only when the browser exposes multiple cameras */}
            {videoDevices.length > 1 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
                  camera:
                </span>
                {videoDevices.map((d, i) => {
                  const isActive = d.deviceId === activeDeviceId;
                  return (
                    <button
                      key={d.deviceId}
                      type="button"
                      disabled={switching || isActive}
                      onClick={() => onSwitchCamera(d.deviceId)}
                      className={[
                        "mono rounded border px-2 py-0.5 text-[10px] transition",
                        isActive
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-background/60 text-muted-foreground hover:border-primary/50 hover:text-foreground",
                        switching ? "cursor-wait opacity-50" : "",
                      ].join(" ")}
                    >
                      {friendlyLabel(d, i)}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <aside className="flex min-h-[280px] flex-col rounded-lg border border-border bg-panel/60">
          <div className="border-b border-border px-4 py-3">
            <h2 className="mono text-[11px] uppercase tracking-[0.2em] text-foreground">
              other publishers in {room}
            </h2>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Open this same URL on another device to see its camera here.
            </p>
          </div>
          <div className="flex-1 px-4 py-3">
            {remotes.length === 0 ? (
              <div className="flex h-full min-h-[160px] items-center justify-center text-center">
                <div className="mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">
                  waiting for another publisher…
                </div>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {remotes.map((r) => (
                  <RemoteTile
                    key={r.sid}
                    feed={r}
                    setRef={(el) => remoteRefs.current.set(r.sid, el)}
                  />
                ))}
              </div>
            )}
          </div>
        </aside>
      </section>

      <LiveStatsPanel
        flows={flows}
        hint={
          status.state === "local-only"
            ? "LiveKit isn't configured, so there's no peer connection - the camera you see is just a local preview."
            : status.state === "connected"
              ? "Outbound > 0 kbps means your camera is reaching LiveKit. Inbound rows appear when another device joins this room."
              : undefined
        }
      />

      <DiagnosticsPanel
        status={status}
        room={room}
        identity={identity}
        remoteCount={remotes.length}
      />
    </main>
  );
}

function RemoteTile({
  feed,
  setRef,
}: {
  feed: RemoteFeed;
  setRef: (el: HTMLVideoElement | null) => void;
}) {
  return (
    <div className="overflow-hidden rounded-md border border-border bg-background">
      <div className="relative aspect-video w-full">
        <video ref={setRef} autoPlay playsInline className="h-full w-full object-cover" />
        <span className="mono absolute left-1.5 top-1.5 rounded-sm bg-background/70 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-foreground/90 backdrop-blur-sm">
          {feed.identity}
        </span>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: Status }) {
  const { tone, label } = useMemo(() => statusToTone(status), [status]);
  const dotClass =
    tone === "ok"
      ? "bg-ok animate-soft-pulse"
      : tone === "warn"
        ? "bg-amber-400"
        : tone === "alert"
          ? "bg-alert"
          : "bg-muted-foreground";
  return (
    <span className="mono inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1 text-[10px] uppercase tracking-[0.18em]">
      <span className={["h-1.5 w-1.5 rounded-full", dotClass].join(" ")} />
      {label}
    </span>
  );
}

function statusToTone(status: Status): {
  tone: "ok" | "warn" | "alert" | "muted";
  label: string;
} {
  switch (status.state) {
    case "idle":
      return { tone: "muted", label: "starting…" };
    case "media-error":
      return { tone: "alert", label: "camera blocked" };
    case "local-only":
      return { tone: "warn", label: "local preview only" };
    case "connecting":
      return { tone: "warn", label: "connecting…" };
    case "connected":
      return { tone: "ok", label: "live · publishing" };
    case "disconnected":
      return { tone: "muted", label: "disconnected" };
    case "error":
      return { tone: "alert", label: "error" };
  }
}

function DiagnosticsPanel({
  status,
  room,
  identity,
  remoteCount,
}: {
  status: Status;
  room: string;
  identity: string;
  remoteCount: number;
}) {
  return (
    <details className="mt-5 rounded-lg border border-border bg-panel/40 px-4 py-3 text-[11px] open:bg-panel/60">
      <summary className="mono cursor-pointer select-none uppercase tracking-[0.2em] text-muted-foreground">
        diagnostics
      </summary>
      <dl className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Row k="state" v={status.state} />
        <Row k="room" v={room} />
        <Row k="identity" v={identity} />
        <Row k="remote feeds" v={String(remoteCount)} />
        {(status.state === "media-error" ||
          status.state === "error" ||
          status.state === "local-only") && (
          <Row
            k="message"
            v={"message" in status ? status.message : "reason" in status ? status.reason : "—"}
            wide
          />
        )}
      </dl>
    </details>
  );
}

function Row({ k, v, wide }: { k: string; v: string; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">{k}</dt>
      <dd className="mono mt-0.5 break-all text-foreground/90">{v}</dd>
    </div>
  );
}
