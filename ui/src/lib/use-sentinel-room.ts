import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LocalAudioTrack, RemoteAudioTrack, RemoteParticipant, Room } from "livekit-client";
import { issueLivekitToken } from "@/lib/livekit-token";
import type { AlertEvent, ConversationMessage } from "@/lib/sentinel-data";

// Single dashboard ↔ Sentinel agent LiveKit connection.
//
// Owns:
//   • mic publish (push-to-talk gated)
//   • remote audio playback (the agent's TTS)
//   • data subscribe (sentinel.voice — guard/assistant turns + interaction records)
//   • data publish (sentinel.visual-alert — palm-watch / item-taken events)
//
// Designed so SentinelDashboard.tsx never has to touch livekit-client directly.

const ROOM_NAME = "sentinel-live";

// Stable identity for the dashboard. The Python voice agent listens for the
// guard mic on this identity (LIVEKIT_MIC_IDENTITY in apps/voice/src/agent.py).
const GUARD_IDENTITY = "sentinel-guard-mic";

type ConnState = "idle" | "media-error" | "connecting" | "connected" | "error";

type Status =
  | { state: "idle" }
  | { state: "media-error"; message: string }
  | { state: "connecting" }
  | { state: "connected" }
  | { state: "error"; message: string };

export type VisualAlertInput = {
  eventId: string;
  cameraId: string;
  zone: string;
  summary: string;
  confidence: number;
  frameBase64?: string;
  frameMimeType?: string;
};

type VoiceEnvelope = {
  source?: string;
  kind?: string;
  payload?: unknown;
};

type GuardTurnPayload = {
  rawTranscript?: string;
  enhancedTranscript?: string;
  asrConfidence?: number;
  nisqaRawMos?: number;
  nisqaEnhancedMos?: number;
  nisqaDeltaMos?: number;
  transcriptsDiffer?: boolean;
};

type AssistantTurnPayload = { text?: string };

type VisualEventPayload = {
  id?: string;
  cameraId?: string;
  zone?: string;
  summary?: string;
  confidence?: number;
};

type InteractionRecord = {
  id: string;
  timestamp: string;
  outcome: "success" | "error";
  visualEvent: {
    cameraId: string;
    zone: string;
    summary: string;
    confidence: number;
  };
  audio: {
    nisqa: {
      raw: { mos: number };
      enhanced: { mos: number };
      delta: { mos: number };
    };
  };
  conversation: Array<{
    speaker: "assistant" | "guard";
    text?: string;
    rawTranscript?: string;
    enhancedTranscript?: string;
    asrConfidence?: number;
  }>;
  interpretation: {
    interpretedCommand: string;
    commandConfidence: number;
  };
  actionTaken: string;
  failure?: { reason: string; failureMode: string; explanation: string } | null;
};

export type SentinelRoom = {
  status: Status;
  micOn: boolean;
  needsPlaybackUnlock: boolean;
  latestAlert: AlertEvent | null;
  latestTicker: string | null;
  startTalking: () => void;
  stopTalking: () => void;
  unlockPlayback: () => Promise<void>;
  publishVisualAlert: (
    input: VisualAlertInput,
  ) => Promise<{ ok: true } | { ok: false; message: string }>;
};

export function useSentinelRoom(): SentinelRoom {
  const [status, setStatus] = useState<Status>({ state: "idle" });
  const [micOn, setMicOn] = useState(false);
  const [needsPlaybackUnlock, setNeedsPlaybackUnlock] = useState(false);
  const [latestAlert, setLatestAlert] = useState<AlertEvent | null>(null);
  const [latestTicker, setLatestTicker] = useState<string | null>(null);

  const roomRef = useRef<Room | null>(null);
  const localTrackRef = useRef<LocalAudioTrack | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  // Hidden audio element pool for remote (agent TTS) tracks.
  const remoteAudioElsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  // Conversation rebuild state (see makeLiveAlert / recordToAlert below).
  const conversationRef = useRef<ConversationMessage[]>([]);
  const visualRef = useRef<VisualEventPayload | null>(null);
  const visualEventIdRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let cleanup = () => {};

    (async () => {
      // 1. Mic permission. Caller (PTT button) won't actually unmute the
      //    LiveKit track until they press, but we still need an open
      //    MediaStream to hand to LocalAudioTrack on connect.
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
      for (const track of stream.getAudioTracks()) track.enabled = false;

      setStatus({ state: "connecting" });

      const tokenResult = await issueLivekitToken({
        data: { room: ROOM_NAME, identity: GUARD_IDENTITY },
      });
      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      if (!tokenResult.ok) {
        setStatus({ state: "error", message: tokenResult.message });
        return;
      }

      const livekit = await import("livekit-client");
      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      const lkRoom = new livekit.Room({ adaptiveStream: true, dynacast: true });
      roomRef.current = lkRoom;

      lkRoom
        .on(livekit.RoomEvent.TrackSubscribed, (track, _pub, participant) => {
          if (track.kind !== livekit.Track.Kind.Audio) return;
          const sid = track.sid ?? `${participant.sid}-${track.source}`;
          const el = document.createElement("audio");
          el.autoplay = true;
          el.playsInline = true;
          // Hide; we don't need a UI for remote audio.
          el.style.display = "none";
          document.body.appendChild(el);
          (track as RemoteAudioTrack).attach(el);
          remoteAudioElsRef.current.set(sid, el);
          console.debug("[sentinel] subscribed agent audio", {
            identity: (participant as RemoteParticipant).identity,
            sid,
          });
        })
        .on(livekit.RoomEvent.TrackUnsubscribed, (track) => {
          const sid = track.sid;
          if (!sid) return;
          const el = remoteAudioElsRef.current.get(sid);
          if (el) {
            try {
              (track as RemoteAudioTrack).detach(el);
            } catch {
              // already detached
            }
            el.remove();
            remoteAudioElsRef.current.delete(sid);
          }
        })
        .on(livekit.RoomEvent.AudioPlaybackStatusChanged, () => {
          setNeedsPlaybackUnlock(!lkRoom.canPlaybackAudio);
        })
        .on(livekit.RoomEvent.Disconnected, () => {
          setStatus({ state: "error", message: "LiveKit disconnected" });
        })
        .on(livekit.RoomEvent.DataReceived, (payload, _participant, _kind, topic) => {
          handleData(payload, topic);
        });

      try {
        await lkRoom.connect(tokenResult.url, tokenResult.token);
        const micTrack = stream.getAudioTracks()[0];
        micTrack.enabled = false;
        const localAudio = new livekit.LocalAudioTrack(micTrack);
        localTrackRef.current = localAudio;
        await lkRoom.localParticipant.publishTrack(localAudio, {
          source: livekit.Track.Source.Microphone,
          name: "microphone",
        });
        await localAudio.mute();

        if (cancelled) {
          await lkRoom.disconnect();
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        setStatus({ state: "connected" });
        setNeedsPlaybackUnlock(!lkRoom.canPlaybackAudio);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setStatus({ state: "error", message });
        try {
          await lkRoom.disconnect();
        } catch {
          // racing teardown
        }
      }

      cleanup = () => {
        try {
          localTrackRef.current?.stop();
        } catch {
          // already stopped
        }
        try {
          lkRoom.disconnect();
        } catch {
          // racing teardown
        }
        for (const el of remoteAudioElsRef.current.values()) el.remove();
        remoteAudioElsRef.current.clear();
        stream.getTracks().forEach((t) => t.stop());
      };
    })().catch((err) => {
      console.error("[sentinel] room setup failed", err);
      if (!cancelled) {
        const message = err instanceof Error ? err.message : String(err);
        setStatus({ state: "error", message });
      }
    });

    return () => {
      cancelled = true;
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sentinel data-packet handler.
  const handleData = useCallback((bytes: Uint8Array, topic?: string) => {
    if (topic !== "sentinel.voice" && topic !== "sentinel.visual-alert") return;
    let envelope: VoiceEnvelope;
    try {
      envelope = JSON.parse(new TextDecoder().decode(bytes)) as VoiceEnvelope;
    } catch {
      setLatestTicker("live voice · ignored malformed data packet");
      return;
    }

    const { source, kind } = envelope;

    if (kind === "visual_event") {
      const visual = envelope.payload as VisualEventPayload;
      const nextId = visual.id ?? null;
      if (nextId && nextId !== visualEventIdRef.current) {
        conversationRef.current = [];
        visualEventIdRef.current = nextId;
      }
      visualRef.current = visual;
      setLatestAlert(makeLiveAlert(visualRef.current, conversationRef.current));
      setLatestTicker(
        topic === "sentinel.visual-alert"
          ? "visual alert sent to walkie-talkie"
          : "live voice · visual event received",
      );
      return;
    }

    if (kind === "guard_turn") {
      const turn = envelope.payload as GuardTurnPayload;
      conversationRef.current = [
        ...conversationRef.current,
        {
          speaker: "guard",
          text: turn.enhancedTranscript ?? turn.rawTranscript ?? "",
          rawText: turn.rawTranscript,
          enhancedText: turn.enhancedTranscript,
          timestamp: nowStamp(),
          nisqaRawMos: turn.nisqaRawMos,
          nisqaEnhancedMos: turn.nisqaEnhancedMos,
          nisqaDeltaMos: turn.nisqaDeltaMos,
          transcriptsDiffer: turn.transcriptsDiffer,
        },
      ];
      const alert = makeLiveAlert(visualRef.current, conversationRef.current);
      if (alert) setLatestAlert(alert);
      setLatestTicker("live transcription · guard speech transcribed");
      return;
    }

    if (kind === "assistant_turn") {
      const turn = envelope.payload as AssistantTurnPayload;
      conversationRef.current = [
        ...conversationRef.current,
        {
          speaker: "sentinel",
          text: turn.text ?? "",
          timestamp: nowStamp(),
        },
      ];
      const alert = makeLiveAlert(visualRef.current, conversationRef.current);
      if (alert) setLatestAlert(alert);
      setLatestTicker("live transcription · sentinel response");
      return;
    }

    if (kind === "interaction_record") {
      const record = envelope.payload as InteractionRecord;
      const alert = recordToAlert(record);
      conversationRef.current = alert.conversation;
      visualRef.current = {
        id: record.id,
        cameraId: record.visualEvent.cameraId,
        zone: record.visualEvent.zone,
        summary: record.visualEvent.summary,
        confidence: record.visualEvent.confidence,
      };
      setLatestAlert(alert);
      setLatestTicker(`live voice · ${record.visualEvent.cameraId} · ${record.outcome}`);
      return;
    }

    if (source && source !== "sentinel-voice-agent") {
      // Anything else (legacy framing packets, future kinds) — ignore quietly.
    }
  }, []);

  const startTalking = useCallback(() => {
    if (status.state !== "connected") return;
    const lkTrack = localTrackRef.current;
    const stream = localStreamRef.current;
    if (!lkTrack || !stream) return;
    // Unlock playback while we're at it — same gesture covers both.
    void roomRef.current?.startAudio().catch(() => {});
    for (const t of stream.getAudioTracks()) t.enabled = true;
    void lkTrack.unmute().catch(() => {});
    setMicOn(true);
  }, [status.state]);

  const stopTalking = useCallback(() => {
    const lkTrack = localTrackRef.current;
    const stream = localStreamRef.current;
    if (lkTrack) void lkTrack.mute().catch(() => {});
    if (stream) {
      for (const t of stream.getAudioTracks()) t.enabled = false;
    }
    setMicOn(false);
  }, []);

  const unlockPlayback = useCallback(async () => {
    try {
      await roomRef.current?.startAudio();
      setNeedsPlaybackUnlock(false);
    } catch {
      setNeedsPlaybackUnlock(true);
    }
  }, []);

  const publishVisualAlert = useCallback(
    async (input: VisualAlertInput): Promise<{ ok: true } | { ok: false; message: string }> => {
      const lkRoom = roomRef.current;
      if (!lkRoom) return { ok: false, message: "Room not connected" };
      try {
        const cleanFrame = input.frameBase64?.replace(/^data:[^;]+;base64,/i, "");
        const envelope = {
          source: "sentinel-dashboard",
          kind: "visual_event",
          payload: {
            id: input.eventId,
            cameraId: input.cameraId,
            zone: input.zone,
            summary: input.summary,
            confidence: input.confidence,
            ...(cleanFrame
              ? {
                  frameBase64: cleanFrame,
                  frameMimeType: input.frameMimeType ?? "image/jpeg",
                }
              : {}),
          },
        };
        await lkRoom.localParticipant.publishData(
          new TextEncoder().encode(JSON.stringify(envelope)),
          { reliable: true, topic: "sentinel.visual-alert" },
        );
        return { ok: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { ok: false, message };
      }
    },
    [],
  );

  return useMemo<SentinelRoom>(
    () => ({
      status,
      micOn,
      needsPlaybackUnlock,
      latestAlert,
      latestTicker,
      startTalking,
      stopTalking,
      unlockPlayback,
      publishVisualAlert,
    }),
    [
      status,
      micOn,
      needsPlaybackUnlock,
      latestAlert,
      latestTicker,
      startTalking,
      stopTalking,
      unlockPlayback,
      publishVisualAlert,
    ],
  );
}

function makeLiveAlert(
  visual: VisualEventPayload | null,
  conversation: ConversationMessage[],
): AlertEvent | null {
  if (!visual) return null;
  const cameraId = visual.cameraId ? normalizeCameraId(visual.cameraId) : "UNASSIGNED";
  const firstSentinelMessage = conversation.find((t) => t.speaker === "sentinel")?.text;
  return {
    cameraId,
    zone: visual.zone ?? "unassigned zone",
    timestamp: nowStamp(),
    sceneSummary: visual.summary ?? "Live visual event received.",
    visualConfidence: visual.confidence ?? 0,
    assistantMessage: firstSentinelMessage ?? "",
    conversation,
    actionTaken: "Awaiting human review",
  };
}

function recordToAlert(record: InteractionRecord): AlertEvent {
  const conversation: ConversationMessage[] = record.conversation.map((turn) => {
    const timestamp = new Date(record.timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    if (turn.speaker === "assistant") {
      return { speaker: "sentinel", text: turn.text ?? "", timestamp };
    }
    const raw = turn.rawTranscript ?? "";
    const enhanced = turn.enhancedTranscript ?? "";
    return {
      speaker: "guard",
      text: enhanced || raw,
      rawText: turn.rawTranscript,
      enhancedText: turn.enhancedTranscript,
      timestamp,
      nisqaRawMos: record.audio.nisqa.raw.mos,
      nisqaEnhancedMos: record.audio.nisqa.enhanced.mos,
      nisqaDeltaMos: record.audio.nisqa.delta.mos,
      transcriptsDiffer: raw.toLowerCase().trim() !== enhanced.toLowerCase().trim(),
    };
  });
  return {
    cameraId: normalizeCameraId(record.visualEvent.cameraId),
    zone: record.visualEvent.zone,
    timestamp: new Date(record.timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
    sceneSummary: record.visualEvent.summary,
    visualConfidence: record.visualEvent.confidence,
    assistantMessage: record.conversation.find((t) => t.speaker === "assistant")?.text ?? "",
    conversation,
    actionTaken: actionStatusFromRecord(record),
  };
}

function actionStatusFromRecord(record: InteractionRecord): AlertEvent["actionTaken"] {
  if (record.actionTaken === "dispatched_associate") return "Floor associate dispatched";
  if (record.actionTaken === "marked_false_alarm") return "Marked false alarm";
  if (record.actionTaken === "created_report") return "Error report created";
  return "Awaiting human review";
}

function normalizeCameraId(id: string) {
  if (id === "camera-aisle-5") return "CAM-05";
  return id.toUpperCase();
}

function nowStamp() {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

// Export for hover/debug; not used elsewhere yet.
export type { ConnState };
