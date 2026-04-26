export type Camera = {
  id: string;
  zone: string;
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
      rawText?: string;
      enhancedText?: string;
      // NISQA scores from the per-utterance audio snapshot. Headline metric
      // is the delta — that's the ai-coustics contribution per turn.
      nisqaRawMos?: number;
      nisqaEnhancedMos?: number;
      nisqaDeltaMos?: number;
      // True when the dual-pass STT produced different text on raw vs.
      // enhanced — i.e. the enhancement actually moved the words.
      transcriptsDiffer?: boolean;
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
