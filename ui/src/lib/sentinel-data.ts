export type Camera = {
  id: string;
  zone: string;
  lastMotion: string;
};

export const cameras: Camera[] = [
  { id: "CAM-01", zone: "Entrance", lastMotion: "2s ago" },
  { id: "CAM-02", zone: "Aisle 1", lastMotion: "14s ago" },
  { id: "CAM-03", zone: "Aisle 2", lastMotion: "1m ago" },
  { id: "CAM-04", zone: "Aisle 3", lastMotion: "8s ago" },
  { id: "CAM-05", zone: "Aisle 5", lastMotion: "just now" },
  { id: "CAM-06", zone: "Aisle 4", lastMotion: "22s ago" },
  { id: "CAM-07", zone: "Checkout", lastMotion: "4s ago" },
  { id: "CAM-08", zone: "Checkout", lastMotion: "11s ago" },
  { id: "CAM-09", zone: "Storage", lastMotion: "3m ago" },
  { id: "CAM-10", zone: "Back exit", lastMotion: "47s ago" },
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
      confidence: number;
      unclear?: boolean;
    };

export type AlertEvent = {
  cameraId: string;
  zone: string;
  timestamp: string;
  sceneSummary: string;
  visualConfidence: number;
  assistantMessage: string;
  conversation: ConversationMessage[];
  actionTaken: string;
};

export const cam05Alert: AlertEvent = {
  cameraId: "CAM-05",
  zone: "Aisle 5",
  timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
  sceneSummary: "Item appears to move from shelf to pocket — requires review",
  visualConfidence: 0.74,
  assistantMessage: "Aisle 5 requires review",
  conversation: [
    {
      speaker: "sentinel",
      text: "Aisle 5 requires review. Item appears to move from shelf to pocket. Human review recommended.",
      timestamp: "14:22:08",
    },
    {
      speaker: "guard",
      text: "Open aisle five.",
      timestamp: "14:22:14",
      confidence: 0.91,
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
      confidence: 0.88,
    },
    {
      speaker: "sentinel",
      text: "Floor associate dispatched. Review record created.",
      timestamp: "14:22:33",
    },
  ],
  actionTaken: "Awaiting human review",
};
