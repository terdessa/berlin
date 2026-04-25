import { Headphones, Mic, Radio, Cpu } from "lucide-react";

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
      label: "cams",
      value: "10/10",
      tone: "ok",
    },
    {
      icon: <Headphones className="h-3 w-3" />,
      label: "earpiece",
      value: `${earpieceBattery}%`,
      tone: "ok",
    },
    {
      icon: <Mic className="h-3 w-3" />,
      label: "ai-coustics",
      value: alerting ? "active" : "standby",
      tone: alerting ? "ok" : "muted",
    },
    {
      icon: <Radio className="h-3 w-3" />,
      label: "latency",
      value: `${voiceLatencyMs}ms`,
      tone: voiceLatencyMs < 250 ? "ok" : "warn",
    },
  ];

  const toneClass = (tone: Pill["tone"]) =>
    tone === "ok"
      ? "text-ok"
      : tone === "warn"
        ? "text-alert"
        : "text-muted-foreground";

  return (
    <div className="flex flex-wrap items-center gap-1">
      {pills.map((p) => (
        <span
          key={p.label}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-panel/60 px-1.5 py-0.5 text-[10px] backdrop-blur-sm"
        >
          <span className={toneClass(p.tone)}>{p.icon}</span>
          <span className="mono uppercase tracking-[0.14em] text-muted-foreground">
            {p.label}
          </span>
          <span className={["mono", toneClass(p.tone)].join(" ")}>{p.value}</span>
        </span>
      ))}
    </div>
  );
}
