export type DeviceKind = "live-phone" | "cctv-mock";

export type Camera = {
  id: string;
  zone: string;
  lastMotion: string;
  device: DeviceKind;
  battery?: number;
  signal?: "4g" | "5g" | "wifi";
};

export const cameras: Camera[] = [
  { id: "CAM-01", zone: "Entrance", lastMotion: "2s ago", device: "cctv-mock" },
  { id: "CAM-02", zone: "Aisle 1", lastMotion: "14s ago", device: "cctv-mock" },
  {
    id: "CAM-05",
    zone: "Aisle 5",
    lastMotion: "just now",
    device: "live-phone",
    battery: 87,
    signal: "5g",
  },
  { id: "CAM-07", zone: "Checkout 1", lastMotion: "4s ago", device: "cctv-mock" },
  { id: "CAM-08", zone: "Checkout 2", lastMotion: "11s ago", device: "cctv-mock" },
  { id: "CAM-10", zone: "Back exit", lastMotion: "47s ago", device: "cctv-mock" },
];

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

/**
 * Phase of the live alert flow. Drives the dashboard state machine and
 * dictates which conversation messages are revealed at any given time.
 */
export type Phase =
  | "idle"
  | "analyzing"
  | "flagged"
  | "awaiting_voice"
  | "listening"
  | "interpreted"
  | "acting"
  | "resolved";

export type ScenarioStep = {
  /** Phase to transition to. */
  phase: Phase;
  /** Reveal conversation messages up to this index (exclusive). */
  revealUpTo: number;
  /** Optional ticker entry to push when entering this step. */
  ticker?: string;
  /** Optional final status to set on the review record. */
  status?: AlertStatus;
  /** Delay in ms before transitioning to the next step. */
  durationMs: number;
};

export type Scenario = {
  id: string;
  label: string;
  description: string;
  alert: AlertEvent;
  steps: ScenarioStep[];
};

const successConversation: ConversationMessage[] = [
  {
    speaker: "sentinel",
    text: "Aisle 5 requires review. Item appears to move from shelf to pocket. Human review recommended.",
    timestamp: "14:22:08",
  },
  {
    speaker: "guard",
    text: "Open aisle five.",
    timestamp: "14:22:14",
    confidenceRaw: 0.42,
    confidenceEnhanced: 0.91,
  },
  {
    speaker: "sentinel",
    text: "Opening Aisle 5 evidence video now.",
    timestamp: "14:22:15",
  },
  {
    speaker: "guard",
    text: "Send floor associate and create report.",
    timestamp: "14:22:31",
    confidenceRaw: 0.39,
    confidenceEnhanced: 0.88,
  },
  {
    speaker: "sentinel",
    text: "Floor associate dispatched. Review record created.",
    timestamp: "14:22:33",
  },
];

const failureConversation: ConversationMessage[] = [
  {
    speaker: "sentinel",
    text: "Checkout 2 requires review. Item scanned mismatch — bottle vs. produce barcode.",
    timestamp: "14:31:02",
  },
  {
    speaker: "guard",
    text: "Pull register two.",
    timestamp: "14:31:09",
    confidenceRaw: 0.18,
    confidenceEnhanced: 0.41,
    unclear: true,
  },
  {
    speaker: "sentinel",
    text: "Voice command unclear. Could you repeat?",
    timestamp: "14:31:10",
  },
  {
    speaker: "guard",
    text: "[indistinct — checkout noise]",
    timestamp: "14:31:18",
    confidenceRaw: 0.12,
    confidenceEnhanced: 0.34,
    unclear: true,
  },
  {
    speaker: "sentinel",
    text: "Still unclear. Generating error report with raw and enhanced audio context.",
    timestamp: "14:31:20",
  },
];

export const successScenario: Scenario = {
  id: "success",
  label: "Run scenario · success",
  description:
    "CAM-05 flagged · guard responds clearly · floor associate dispatched.",
  alert: {
    cameraId: "CAM-05",
    zone: "Aisle 5",
    timestamp: "14:22:08",
    sceneSummary:
      "Item appears to move from shelf to pocket — requires review",
    visualConfidence: 0.74,
    assistantMessage: "Aisle 5 requires review",
    conversation: successConversation,
    actionTaken: "Awaiting human review",
  },
  steps: [
    { phase: "analyzing", revealUpTo: 0, durationMs: 900, ticker: "CAM-05 · scene model elevated · 0.74" },
    { phase: "flagged", revealUpTo: 1, durationMs: 1400, ticker: "CAM-05 · review flagged · earpiece alert sent" },
    { phase: "awaiting_voice", revealUpTo: 1, durationMs: 1300, ticker: "earpiece · awaiting guard response" },
    { phase: "listening", revealUpTo: 1, durationMs: 1200, ticker: "earpiece · guard speaking · ai-coustics on" },
    { phase: "interpreted", revealUpTo: 3, durationMs: 1600, ticker: "command · open aisle 5 · 0.91 (raw 0.42)" },
    { phase: "listening", revealUpTo: 3, durationMs: 1500, ticker: "earpiece · guard speaking" },
    { phase: "acting", revealUpTo: 4, durationMs: 1500, ticker: "command · send floor associate + create report" },
    {
      phase: "resolved",
      revealUpTo: 5,
      durationMs: 0,
      ticker: "review · CAM-05 · floor associate dispatched",
      status: "Floor associate dispatched",
    },
  ],
};

export const failureScenario: Scenario = {
  id: "failure",
  label: "Run scenario · voice fails",
  description:
    "CAM-08 checkout flagged · guard audio is too noisy · error report generated.",
  alert: {
    cameraId: "CAM-08",
    zone: "Checkout 2",
    timestamp: "14:31:02",
    sceneSummary:
      "Item scanned mismatch — bottle vs. produce barcode · requires review",
    visualConfidence: 0.61,
    assistantMessage: "Checkout 2 requires review",
    conversation: failureConversation,
    actionTaken: "Awaiting human review",
  },
  steps: [
    { phase: "analyzing", revealUpTo: 0, durationMs: 900, ticker: "CAM-08 · scan-mismatch detector · 0.61" },
    { phase: "flagged", revealUpTo: 1, durationMs: 1400, ticker: "CAM-08 · review flagged · earpiece alert sent" },
    { phase: "awaiting_voice", revealUpTo: 1, durationMs: 1300, ticker: "earpiece · awaiting guard response" },
    { phase: "listening", revealUpTo: 1, durationMs: 1300, ticker: "earpiece · high background noise" },
    { phase: "interpreted", revealUpTo: 2, durationMs: 1500, ticker: "command · unclear · 0.41 (raw 0.18)" },
    { phase: "awaiting_voice", revealUpTo: 3, durationMs: 1300, ticker: "earpiece · clarification requested" },
    { phase: "listening", revealUpTo: 3, durationMs: 1300, ticker: "earpiece · guard speaking" },
    { phase: "interpreted", revealUpTo: 4, durationMs: 1600, ticker: "command · still unclear · 0.34" },
    {
      phase: "resolved",
      revealUpTo: 5,
      durationMs: 0,
      ticker: "error · CAM-08 · report archived for review",
      status: "Error report created",
    },
  ],
};

export const scenarios: Scenario[] = [successScenario, failureScenario];

/** Audio metric headline for the partner-track money shot. */
export const audioMetric = {
  raw: 0.42,
  enhanced: 0.91,
  label: "Command recognition",
};

/** Map a camera id to its scripted scenario, if any. Powers click-to-demo on the grid. */
export const scenarioByCamera: Record<string, Scenario | undefined> = {
  [successScenario.alert.cameraId]: successScenario,
  [failureScenario.alert.cameraId]: failureScenario,
};
