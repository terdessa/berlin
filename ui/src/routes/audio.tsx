import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  LocalAudioTrack,
  RemoteAudioTrack,
  RemoteParticipant,
  Room,
} from "livekit-client";
import { issueLivekitToken } from "@/lib/livekit-token";
import { LivePageSkeleton } from "@/lib/live-page-skeleton";
import { useLivekitStats } from "@/lib/use-livekit-stats";
import { LiveStatsPanel } from "@/lib/live-stats-panel";

export const Route = createFileRoute("/audio")({
  component: AudioPage,
  head: () => ({
    meta: [
      { title: "Sentinel - Live mic publisher" },
      {
        name: "description",
        content:
          "Direct-link mic publisher for Sentinel. Streams the device microphone into a LiveKit room.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

const DEFAULT_ROOM = "sentinel-live";

type Status =
  | { state: "idle" }
  | { state: "media-error"; message: string }
  | { state: "local-only"; reason: string }
  | { state: "connecting" }
  | { state: "connected" }
  | { state: "disconnected" }
  | { state: "error"; message: string };

type RemoteVoice = {
  sid: string;
  identity: string;
  track: RemoteAudioTrack;
  participant: RemoteParticipant;
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

function AudioPage() {
  // Same hydration-safe pattern as /video: render a stable SSR skeleton until
  // we mount on the client, then swap in the interactive page.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <LivePageSkeleton title="Sentinel · live mic publisher" />;
  return <AudioPageInner />;
}

function AudioPageInner() {
  const identity = useMemo(makeIdentity, []);
  const room = useMemo(() => {
    const fromQuery = new URLSearchParams(window.location.search).get("room");
    return fromQuery?.trim() || DEFAULT_ROOM;
  }, []);

  const [status, setStatus] = useState<Status>({ state: "idle" });
  const [micOn, setMicOn] = useState(true);
  const [remotes, setRemotes] = useState<RemoteVoice[]>([]);
  const [needsTapToHear, setNeedsTapToHear] = useState(false);
  const [localLevel, setLocalLevel] = useState({ rms: 0, peak: 0 });
  const [remoteLevels, setRemoteLevels] = useState<Record<string, number>>({});
  // Mirrored as state so the stats hook re-runs when LiveKit connects/disconnects.
  const [lkRoomState, setLkRoomState] = useState<Room | null>(null);

  const roomRef = useRef<Room | null>(null);
  const localTrackRef = useRef<LocalAudioTrack | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioRefs = useRef<Map<string, HTMLAudioElement | null>>(new Map());

  const flows = useLivekitStats(lkRoomState);

  // Open mic + (optionally) join LiveKit.
  useEffect(() => {
    let cancelled = false;
    let cleanup = () => {};

    (async () => {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: false,
        });
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

      // Local-stream-backed analyser for the level meter; replaced once we
      // hand the stream over to LiveKit.
      let analyserCleanup = startAnalyser(stream, (rms, peak) => {
        if (!cancelled) setLocalLevel({ rms, peak });
      });

      // Try LiveKit; otherwise stay in local-only mode.
      const tokenResult = await issueLivekitToken({ data: { room, identity } });
      if (cancelled) {
        analyserCleanup();
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      if (!tokenResult.ok) {
        setStatus({ state: "local-only", reason: tokenResult.message });
        cleanup = () => {
          analyserCleanup();
          stream.getTracks().forEach((t) => t.stop());
        };
        return;
      }

      setStatus({ state: "connecting" });

      const livekit = await import("livekit-client");
      if (cancelled) {
        analyserCleanup();
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      const lkRoom = new livekit.Room({ adaptiveStream: true, dynacast: true });
      roomRef.current = lkRoom;
      setLkRoomState(lkRoom);

      lkRoom
        .on(livekit.RoomEvent.TrackSubscribed, (track, _pub, participant) => {
          if (track.kind !== livekit.Track.Kind.Audio) return;
          const sid = track.sid ?? `${participant.sid}-${track.source}`;
          const voice: RemoteVoice = {
            sid,
            identity: participant.identity,
            track: track as RemoteAudioTrack,
            participant,
          };
          setRemotes((prev) => [...prev.filter((r) => r.sid !== sid), voice]);
        })
        .on(livekit.RoomEvent.TrackUnsubscribed, (track) => {
          const sid = track.sid;
          if (!sid) return;
          setRemotes((prev) => prev.filter((r) => r.sid !== sid));
        })
        .on(livekit.RoomEvent.ParticipantDisconnected, (participant) => {
          setRemotes((prev) => prev.filter((r) => r.identity !== participant.identity));
        })
        .on(livekit.RoomEvent.AudioPlaybackStatusChanged, () => {
          setNeedsTapToHear(!lkRoom.canPlaybackAudio);
        })
        .on(livekit.RoomEvent.Disconnected, () => {
          setStatus({ state: "disconnected" });
          setLkRoomState(null);
        });

      try {
        await lkRoom.connect(tokenResult.url, tokenResult.token);

        // Reuse our existing mic stream by wrapping its track.
        const micTrack = stream.getAudioTracks()[0];
        const localAudio = new livekit.LocalAudioTrack(micTrack);
        localTrackRef.current = localAudio;
        await lkRoom.localParticipant.publishTrack(localAudio, {
          source: livekit.Track.Source.Microphone,
          name: "microphone",
        });

        if (cancelled) {
          await lkRoom.disconnect();
          return;
        }
        setStatus({ state: "connected" });
        setMicOn(true);
        setNeedsTapToHear(!lkRoom.canPlaybackAudio);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setStatus({ state: "error", message });
        try {
          await lkRoom.disconnect();
        } catch {}
      }

      cleanup = () => {
        analyserCleanup();
        try {
          localTrackRef.current?.stop();
        } catch {}
        try {
          lkRoom.disconnect();
        } catch {}
        setLkRoomState(null);
        stream.getTracks().forEach((t) => t.stop());
      };
    })();

    return () => {
      cancelled = true;
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Attach remote audio tracks to <audio> elements so they play.
  useEffect(() => {
    for (const r of remotes) {
      const el = audioRefs.current.get(r.sid);
      if (el) r.track.attach(el);
    }
  }, [remotes]);

  // Poll per-participant audioLevel for visual meters.
  useEffect(() => {
    if (remotes.length === 0) {
      setRemoteLevels({});
      return;
    }
    const id = window.setInterval(() => {
      const next: Record<string, number> = {};
      for (const r of remotes) {
        next[r.sid] = r.participant.audioLevel ?? 0;
      }
      setRemoteLevels(next);
    }, 120);
    return () => window.clearInterval(id);
  }, [remotes]);

  const onToggleMic = async () => {
    const lkTrack = localTrackRef.current;
    const stream = localStreamRef.current;

    if (micOn) {
      if (lkTrack) {
        try {
          await lkTrack.mute();
        } catch {}
      } else if (stream) {
        for (const t of stream.getAudioTracks()) t.enabled = false;
      } else {
        return;
      }
      setMicOn(false);
    } else {
      if (lkTrack) {
        try {
          await lkTrack.unmute();
        } catch {}
      } else if (stream) {
        for (const t of stream.getAudioTracks()) t.enabled = true;
      } else {
        return;
      }
      setMicOn(true);
    }
  };

  const onEnableAudio = async () => {
    try {
      await roomRef.current?.startAudio();
      setNeedsTapToHear(false);
    } catch {
      setNeedsTapToHear(true);
    }
  };

  return (
    <main className="min-h-screen px-6 py-5">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <h1 className="mono text-sm uppercase tracking-[0.2em] text-foreground">
            Sentinel · live mic publisher
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Direct-link page · publishes this device's microphone to a shared LiveKit room.
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

      {needsTapToHear && (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-md border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-xs">
          <span className="mono uppercase tracking-[0.18em] text-amber-200">
            tap to enable remote audio playback
          </span>
          <button
            type="button"
            onClick={onEnableAudio}
            className="mono rounded-md border border-amber-400/60 bg-amber-500/20 px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-amber-100 hover:bg-amber-500/30"
          >
            enable
          </button>
        </div>
      )}

      <section className="mt-5 grid gap-5 lg:grid-cols-[2fr_1fr]">
        <div className="overflow-hidden rounded-lg border border-border bg-panel">
          <div className="px-5 py-5">
            <div className="flex items-center justify-between">
              <span className="mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                local mic · {identity}
              </span>
              <span className="mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                room: {room}
              </span>
            </div>

            <div className="mt-4">
              <Meter rms={localLevel.rms} peak={localLevel.peak} muted={!micOn} />
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3 text-[11px]">
              <div>
                <div className="mono uppercase tracking-[0.2em] text-muted-foreground">rms</div>
                <div className="mono mt-0.5 text-foreground">
                  {(localLevel.rms * 100).toFixed(1)}%
                </div>
              </div>
              <div>
                <div className="mono uppercase tracking-[0.2em] text-muted-foreground">peak</div>
                <div className="mono mt-0.5 text-foreground">
                  {(localLevel.peak * 100).toFixed(1)}%
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-panel-elevated px-4 py-3">
            <button
              type="button"
              onClick={onToggleMic}
              disabled={
                status.state === "idle" ||
                status.state === "media-error" ||
                status.state === "connecting"
              }
              className="mono rounded-md border border-border bg-background/60 px-3 py-1.5 text-xs text-foreground transition hover:border-primary/50 hover:bg-background disabled:cursor-not-allowed disabled:opacity-40"
            >
              {micOn ? "■ mute mic" : "▶ unmute mic"}
            </button>
            <span className="mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              identity · {identity}
            </span>
          </div>
        </div>

        <aside className="flex min-h-[280px] flex-col rounded-lg border border-border bg-panel/60">
          <div className="border-b border-border px-4 py-3">
            <h2 className="mono text-[11px] uppercase tracking-[0.2em] text-foreground">
              other voices in {room}
            </h2>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Open this same URL on another device to hear and see its mic level here.
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
              <div className="space-y-3">
                {remotes.map((r) => (
                  <RemoteVoiceRow
                    key={r.sid}
                    voice={r}
                    level={remoteLevels[r.sid] ?? 0}
                    setRef={(el) => audioRefs.current.set(r.sid, el)}
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
            ? "LiveKit isn't configured, so there's no peer connection - the level meter above is just a local readout."
            : status.state === "connected"
              ? "Outbound > 0 kbps means your mic is reaching LiveKit. Inbound rows appear when another device joins this room."
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

function RemoteVoiceRow({
  voice,
  level,
  setRef,
}: {
  voice: RemoteVoice;
  level: number;
  setRef: (el: HTMLAudioElement | null) => void;
}) {
  return (
    <div className="rounded-md border border-border bg-background/40 px-3 py-2">
      <div className="flex items-center justify-between">
        <span className="mono text-[10px] uppercase tracking-wider text-foreground/90">
          {voice.identity}
        </span>
        <span className="mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
          {(level * 100).toFixed(0)}%
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-primary transition-[width] duration-100"
          style={{ width: `${Math.min(100, Math.max(2, level * 140))}%` }}
        />
      </div>
      <audio ref={setRef} autoPlay playsInline className="hidden" />
    </div>
  );
}

function Meter({ rms, peak, muted }: { rms: number; peak: number; muted: boolean }) {
  const rmsPct = Math.min(100, rms * 140);
  const peakPct = Math.min(100, peak * 140);
  return (
    <div className="space-y-1.5">
      <div className="relative h-3 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={[
            "absolute inset-y-0 left-0 transition-[width] duration-75",
            muted ? "bg-muted-foreground/40" : "bg-primary",
          ].join(" ")}
          style={{ width: `${rmsPct}%` }}
        />
        <div
          className="absolute top-0 h-full w-[2px] bg-foreground/80"
          style={{ left: `calc(${peakPct}% - 1px)` }}
        />
      </div>
      {muted && (
        <div className="mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
          mic muted
        </div>
      )}
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
      return { tone: "alert", label: "mic blocked" };
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
        <Row k="remote voices" v={String(remoteCount)} />
        {(status.state === "media-error" ||
          status.state === "error" ||
          status.state === "local-only") && (
          <Row
            k="message"
            v={
              "message" in status
                ? status.message
                : "reason" in status
                  ? status.reason
                  : "—"
            }
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

// Local mic level meter via Web Audio API. Returns a cleanup function.
function startAnalyser(
  stream: MediaStream,
  onLevel: (rms: number, peak: number) => void,
): () => void {
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return () => {};

  const ctx = new Ctor();
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  analyser.smoothingTimeConstant = 0.7;
  source.connect(analyser);

  const buf = new Float32Array(analyser.fftSize);
  let raf = 0;
  const tick = () => {
    analyser.getFloatTimeDomainData(buf);
    let sumSq = 0;
    let peak = 0;
    for (let i = 0; i < buf.length; i++) {
      const v = buf[i];
      sumSq += v * v;
      const a = Math.abs(v);
      if (a > peak) peak = a;
    }
    const rms = Math.sqrt(sumSq / buf.length);
    onLevel(rms, peak);
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  return () => {
    cancelAnimationFrame(raf);
    try {
      source.disconnect();
    } catch {}
    try {
      ctx.close();
    } catch {}
  };
}
