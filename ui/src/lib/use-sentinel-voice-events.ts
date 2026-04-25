import { useEffect, useMemo, useRef, useState } from "react";
import type { AlertEvent, ConversationMessage } from "@/lib/sentinel-data";
import { issueLivekitToken } from "@/lib/livekit-token";

type VoiceEventEnvelope = {
  source?: string;
  kind?: string;
  payload?: unknown;
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
  failure?: {
    reason: string;
    failureMode: string;
    explanation: string;
    suggestedClarification?: string;
  } | null;
};

type VisualEventPayload = {
  cameraId?: string;
  zone?: string;
  summary?: string;
  confidence?: number;
};

type GuardTurnPayload = {
  rawTranscript?: string;
  enhancedTranscript?: string;
  asrConfidence?: number;
};

type AssistantTurnPayload = {
  text?: string;
};

export function useSentinelVoiceEvents(roomName = "sentinel-live") {
  const identity = useMemo(() => `dashboard-${Math.random().toString(36).slice(2, 8)}`, []);
  const [status, setStatus] = useState<"idle" | "connecting" | "connected" | "error">("idle");
  const [latestAlert, setLatestAlert] = useState<AlertEvent | null>(null);
  const [latestTicker, setLatestTicker] = useState<string | null>(null);
  const conversationRef = useRef<ConversationMessage[]>([]);
  const visualRef = useRef<VisualEventPayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    let cleanup = () => {};

    (async () => {
      setStatus("connecting");
      const tokenResult = await issueLivekitToken({ data: { room: roomName, identity } });
      if (cancelled) return;
      if (!tokenResult.ok) {
        setStatus("error");
        return;
      }

      const livekit = await import("livekit-client");
      if (cancelled) return;

      const room = new livekit.Room({ adaptiveStream: true, dynacast: true });
      const onData = (
        payload: Uint8Array,
        participant: unknown,
        _kind: unknown,
        topic?: string,
      ) => {
        let envelope: VoiceEventEnvelope;
        try {
          const text = new TextDecoder().decode(payload);
          envelope = JSON.parse(text) as VoiceEventEnvelope;
        } catch {
          if (topic === "sentinel.voice") {
            setLatestTicker("live voice · ignored malformed data packet");
          }
          return;
        }

        if (topic !== "sentinel.voice" && envelope.source !== "sentinel-voice-agent") return;

        if (envelope.kind === "visual_event") {
          visualRef.current = envelope.payload as VisualEventPayload;
          setLatestAlert(makeLiveAlert(visualRef.current, conversationRef.current));
          setLatestTicker("live voice · visual event received");
          return;
        }

        if (envelope.kind === "assistant_turn") {
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

        if (envelope.kind === "guard_turn") {
          const turn = envelope.payload as GuardTurnPayload;
          const enhanced = turn.asrConfidence ?? 0;
          conversationRef.current = [
            ...conversationRef.current,
            {
              speaker: "guard",
              text: turn.enhancedTranscript ?? turn.rawTranscript ?? "",
              rawText: turn.rawTranscript,
              enhancedText: turn.enhancedTranscript,
              timestamp: nowStamp(),
              confidenceRaw: Math.max(0, enhanced - 0.25),
              confidenceEnhanced: enhanced,
              unclear: enhanced < 0.7,
            },
          ];
          const alert = makeLiveAlert(visualRef.current, conversationRef.current);
          if (alert) setLatestAlert(alert);
          setLatestTicker("live transcription · guard speech transcribed");
          return;
        }

        if (envelope.kind === "interaction_record") {
          const record = envelope.payload as InteractionRecord;
          const alert = recordToAlert(record);
          conversationRef.current = alert.conversation;
          visualRef.current = {
            cameraId: record.visualEvent.cameraId,
            zone: record.visualEvent.zone,
            summary: record.visualEvent.summary,
            confidence: record.visualEvent.confidence,
          };
          setLatestAlert(alert);
          setLatestTicker(
            `live voice · ${record.visualEvent.cameraId} · ${record.outcome} · ${record.interpretation.interpretedCommand} (${Math.round(record.interpretation.commandConfidence * 100)}%)`,
          );
        }
      };

      const onTranscription = (
        segments: Array<{ text?: string; final?: boolean }>,
        participant?: { identity?: string },
      ) => {
        const text = segments
          .filter((segment) => segment.final && segment.text)
          .map((segment) => segment.text)
          .join(" ")
          .trim();
        if (!text) return;

        const speaker = participant?.identity?.startsWith("agent-") ? "sentinel" : "guard";
        conversationRef.current = [
          ...conversationRef.current,
          {
            speaker,
            text,
            timestamp: nowStamp(),
            ...(speaker === "guard"
              ? {
                  rawText: text,
                  enhancedText: text,
                  confidenceRaw: 0.75,
                  confidenceEnhanced: 0.75,
                }
              : {}),
          },
        ];
        const alert = makeLiveAlert(visualRef.current, conversationRef.current);
        if (alert) setLatestAlert(alert);
        setLatestTicker(`live transcription · ${speaker} transcript received`);
      };

      room.on(livekit.RoomEvent.DataReceived, onData);
      room.on(livekit.RoomEvent.TranscriptionReceived, onTranscription);
      await room.connect(tokenResult.url, tokenResult.token);
      if (cancelled) {
        room.disconnect();
        return;
      }
      setStatus("connected");

      cleanup = () => {
        room.off(livekit.RoomEvent.DataReceived, onData);
        room.off(livekit.RoomEvent.TranscriptionReceived, onTranscription);
        room.disconnect();
      };
    })().catch(() => {
      if (!cancelled) setStatus("error");
    });

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [identity, roomName]);

  return { status, latestAlert, latestTicker };
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
      return {
        speaker: "sentinel",
        text: turn.text ?? "",
        timestamp,
      };
    }

    const enhanced = turn.asrConfidence ?? record.interpretation.commandConfidence;
    const raw = Math.max(0, Math.min(1, enhanced - Math.max(0, record.audio.nisqa.delta.mos) / 5));
    return {
      speaker: "guard",
      text: turn.enhancedTranscript ?? turn.rawTranscript ?? "",
      rawText: turn.rawTranscript,
      enhancedText: turn.enhancedTranscript,
      timestamp,
      confidenceRaw: raw,
      confidenceEnhanced: enhanced,
      unclear: record.outcome === "error",
    };
  });

  if (record.failure?.explanation) {
    conversation.push({
      speaker: "sentinel",
      text: `Error report: ${record.failure.explanation}`,
      timestamp: new Date(record.timestamp).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
    });
  }

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
    actionTaken: record.outcome === "error" ? "Error report created" : "Floor associate dispatched",
  };
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
