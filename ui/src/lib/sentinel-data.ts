export type DeviceKind = "live-phone" | "live-video";

export type Camera = {
  id: string;
  zone: string;
  lastMotion: string;
  device: DeviceKind;
};

export type ConversationMessage =
  | {
      speaker: "sentinel";
      text: string;
      timestamp: string;
    }
  | {
      speaker: "guard";
      text: string;
      timestamp: string;
      confidenceRaw: number;
      confidenceEnhanced: number;
      rawText?: string;
      enhancedText?: string;
      unclear?: boolean;
    };

export type AlertStatus =
  | "Awaiting human review"
  | "Floor associate dispatched"
  | "Marked false alarm"
  | "Error report created";

export type AlertEvent = {
  cameraId: string;
  zone: string;
  timestamp: string;
  sceneSummary: string;
  visualConfidence: number;
  assistantMessage: string;
  conversation: ConversationMessage[];
  actionTaken: AlertStatus;
};

export type Phase =
  | "idle"
  | "analyzing"
  | "flagged"
  | "awaiting_voice"
  | "listening"
  | "interpreted"
  | "acting"
  | "resolved";
