import { Headphones, Mic, Radio, Wifi, Clock, Cpu } from "lucide-react";

type Pill = {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: "ok" | "warn" | "muted";
};

type Props = {
  voiceLatencyMs: number;
  earpieceBattery: number;
  alerting: boolean;
};

export function SystemPillsStrip({ voiceLatencyMs, earpieceBattery, alerting }: Props) {
  const pills: Pill[] = [
    {
      icon: <Cpu className="h-3 w-3" />,
      label: "Cameras",
      value: "10/10 · live",
      tone: "ok",
    },
    {
      icon: <Headphones className="h-3 w-3" />,
      label: "Earpiece phone",
      value: `linked · ${earpieceBattery}%`,
      tone: "ok",
    },
    {
      icon: <Mic className="h-3 w-3" />,
      label: "ai-coustics",
      value: alerting ? "active · enhancing" : "standby",
      tone: alerting ? "ok" : "muted",
    },
    {
      icon: <Radio className="h-3 w-3" />,
      label: "Voice latency",
      value: `${voiceLatencyMs}ms`,
      tone: voiceLatencyMs < 250 ? "ok" : "warn",
    },
    {
      icon: <Wifi className="h-3 w-3" />,
      label: "Network",
      value: "stable",
      tone: "ok",
    },
    {
      icon: <Clock className="h-3 w-3" />,
      label: "Store hours",
      value: "open · 09–22",
      tone: "muted",
    },
  ];

  const toneClass = (tone: Pill["tone"]) =>
    tone === "ok"
      ? "text-ok"
      : tone === "warn"
        ? "text-alert"
        : "text-muted-foreground";

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {pills.map((p) => (
        <span
          key={p.label}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-panel/60 px-2 py-1 text-[10px] backdrop-blur-sm"
        >
          <span className={toneClass(p.tone)}>{p.icon}</span>
          <span className="mono uppercase tracking-[0.16em] text-muted-foreground">
            {p.label}
          </span>
          <span className={["mono", toneClass(p.tone)].join(" ")}>{p.value}</span>
        </span>
      ))}
    </div>
  );
}
