import { issueLivekitToken } from "@/lib/livekit-token";

type VisualAlertInput = {
  room?: string;
  eventId: string;
  cameraId: string;
  zone: string;
  summary: string;
  confidence: number;
};

type VisualAlertResult =
  | { ok: true }
  | {
      ok: false;
      message: string;
    };

export async function publishVisualAlert({
  room = "sentinel-live",
  eventId,
  cameraId,
  zone,
  summary,
  confidence,
}: VisualAlertInput): Promise<VisualAlertResult> {
  try {
    const tokenResult = await issueLivekitToken({
      data: {
        room,
        identity: `gemini-preview-${Math.random().toString(36).slice(2, 8)}`,
      },
    });
    if (!tokenResult.ok) {
      return { ok: false, message: tokenResult.message };
    }

    const livekit = await import("livekit-client");
    const livekitRoom = new livekit.Room({ adaptiveStream: false, dynacast: false });
    await livekitRoom.connect(tokenResult.url, tokenResult.token);

    const envelope = {
      source: "sentinel-gemini-preview",
      kind: "visual_event",
      payload: {
        id: eventId,
        cameraId,
        zone,
        summary,
        confidence,
      },
    };

    await livekitRoom.localParticipant.publishData(
      new TextEncoder().encode(JSON.stringify(envelope)),
      {
        reliable: true,
        topic: "sentinel.visual-alert",
      },
    );
    livekitRoom.disconnect();
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Could not publish visual alert.",
    };
  }
}
