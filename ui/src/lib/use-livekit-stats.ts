import { useEffect, useRef, useState } from "react";
import type { Room, Track } from "livekit-client";

// One row per direction+kind+sid. The page renders these directly, so the
// shape here is intentionally close to "what should appear in a row".
export type TrackFlow = {
  direction: "out" | "in";
  kind: "audio" | "video";
  source: string; // "camera" | "microphone" | "screen_share" | unknown ...
  identity?: string; // remotes only
  sid: string;
  kbps: number;
  fps?: number;
  width?: number;
  height?: number;
  codec?: string; // e.g. "VP8", "opus"
  packetsLost?: number;
  // WebRTC's `qualityLimitationReason` for outbound video: "none" | "cpu"
  // | "bandwidth" | "other". Tells you why the encoder is throttling.
  limitedBy?: string;
  bytesTotal: number;
};

type Sample = { bytes: number; ts: number };

// Polls each LiveKit track's underlying RTCPeerConnection for outbound-rtp /
// inbound-rtp stats and converts byte deltas into kbps. Returns a fresh array
// every `intervalMs` (default 1s).
//
// `room` should be the live `Room` instance (or null when there isn't one);
// because we read it from React state the effect re-runs whenever a new room
// is constructed or torn down.
export function useLivekitStats(room: Room | null, intervalMs = 1000): TrackFlow[] {
  const [flows, setFlows] = useState<TrackFlow[]>([]);
  const prev = useRef<Map<string, Sample>>(new Map());

  useEffect(() => {
    if (!room) {
      setFlows([]);
      prev.current.clear();
      return;
    }

    let cancelled = false;

    const sample = async () => {
      const now = performance.now();
      const next: TrackFlow[] = [];

      // Local publications -> outbound-rtp.
      for (const pub of room.localParticipant.trackPublications.values()) {
        const t = pub.track;
        if (!t) continue;
        const row = await readFlow(t, "out", now, prev.current);
        if (!row) continue;
        row.source = String(pub.source ?? "unknown");
        row.sid = pub.trackSid ?? `local-${pub.source}`;
        next.push(row);
      }

      // Remote (subscribed) publications -> inbound-rtp.
      for (const participant of room.remoteParticipants.values()) {
        for (const pub of participant.trackPublications.values()) {
          const t = pub.track;
          if (!t || !pub.isSubscribed) continue;
          const row = await readFlow(t, "in", now, prev.current);
          if (!row) continue;
          row.source = String(pub.source ?? "unknown");
          row.sid = pub.trackSid ?? `${participant.sid}-${pub.source}`;
          row.identity = participant.identity;
          next.push(row);
        }
      }

      if (!cancelled) setFlows(next);
    };

    void sample();
    const id = window.setInterval(() => void sample(), intervalMs);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [room, intervalMs]);

  return flows;
}

async function readFlow(
  track: Track,
  direction: "out" | "in",
  now: number,
  samples: Map<string, Sample>,
): Promise<TrackFlow | null> {
  let report: RTCStatsReport | undefined;
  try {
    // LiveKit exposes the underlying RTCPeerConnection stats per-track.
    report = await track.getRTCStatsReport();
  } catch {
    return null;
  }
  if (!report) return null;

  const wantedType = direction === "out" ? "outbound-rtp" : "inbound-rtp";
  const rtp = pickRtpStat(report, wantedType);
  if (!rtp) return null;

  const codec = pickCodec(report, rtp.codecId);
  const sid = (rtp as { trackIdentifier?: string }).trackIdentifier ?? rtp.id ?? "unknown";
  const key = `${direction}-${sid}`;
  const prevSample = samples.get(key);
  const dtSec = prevSample ? (now - prevSample.ts) / 1000 : 0;
  const kbps =
    prevSample && dtSec > 0 ? Math.max(0, ((rtp.bytes - prevSample.bytes) * 8) / 1000 / dtSec) : 0;
  samples.set(key, { bytes: rtp.bytes, ts: now });

  return {
    direction,
    kind: track.kind === "audio" ? "audio" : "video",
    source: "unknown", // overwritten by caller from the publication
    sid,
    kbps,
    fps: rtp.fps,
    width: rtp.width,
    height: rtp.height,
    codec,
    packetsLost: rtp.packetsLost,
    limitedBy: rtp.limitedBy,
    bytesTotal: rtp.bytes,
  };
}

type RtpRow = {
  id: string;
  bytes: number;
  fps?: number;
  width?: number;
  height?: number;
  codecId?: string;
  packetsLost?: number;
  limitedBy?: string;
};

function pickRtpStat(report: RTCStatsReport, type: "outbound-rtp" | "inbound-rtp"): RtpRow | null {
  // A peer connection can have multiple inbound/outbound entries (e.g. simulcast
  // layers); we sum the bytes for an honest aggregate kbps and take fps from
  // the highest-fps row.
  let bytes = 0;
  let fps: number | undefined;
  let width: number | undefined;
  let height: number | undefined;
  let codecId: string | undefined;
  let packetsLost: number | undefined;
  let limitedBy: string | undefined;
  let lastId: string | undefined;
  let any = false;

  report.forEach((stat) => {
    if (stat.type !== type) return;
    any = true;
    const s = stat as Record<string, unknown>;
    const b = (type === "outbound-rtp" ? s.bytesSent : s.bytesReceived) as number | undefined;
    if (typeof b === "number") bytes += b;
    const f = s.framesPerSecond as number | undefined;
    if (typeof f === "number" && (fps === undefined || f > fps)) fps = f;
    // For simulcast we have multiple outbound rows; take the largest layer's
    // dimensions since that's the visible "publishing at" resolution.
    const w = s.frameWidth as number | undefined;
    const h = s.frameHeight as number | undefined;
    if (typeof w === "number" && typeof h === "number") {
      if (width === undefined || w > width) {
        width = w;
        height = h;
      }
    }
    if (typeof s.codecId === "string" && !codecId) codecId = s.codecId as string;
    if (typeof s.packetsLost === "number") {
      packetsLost = (packetsLost ?? 0) + (s.packetsLost as number);
    }
    // qualityLimitationReason exists only on outbound-rtp; "none" means the
    // encoder is happy, otherwise it tells us why frames are being dropped.
    if (typeof s.qualityLimitationReason === "string") {
      const reason = s.qualityLimitationReason as string;
      if (reason !== "none" || limitedBy === undefined) limitedBy = reason;
    }
    if (typeof stat.id === "string") lastId = stat.id;
  });

  if (!any) return null;
  return { id: lastId ?? "rtp", bytes, fps, width, height, codecId, packetsLost, limitedBy };
}

function pickCodec(report: RTCStatsReport, codecId: string | undefined): string | undefined {
  if (!codecId) return undefined;
  const c = report.get(codecId) as { mimeType?: string } | undefined;
  const mime = c?.mimeType;
  if (!mime) return undefined;
  // "video/VP8" -> "VP8", "audio/opus" -> "opus"
  return mime.replace(/^audio\//i, "").replace(/^video\//i, "");
}
