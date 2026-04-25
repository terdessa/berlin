import { Headphones, Mic, Volume2 } from "lucide-react";
import type { Phase } from "@/lib/sentinel-data";

type Props = {
  phase: Phase;
};

export function VoiceChannelWidget({ phase }: Props) {
  const closed = phase === "resolved" || phase === "idle";
  const guardSpeaking = phase === "listening";
  const sentinelSpeaking = phase === "flagged" || phase === "interpreted";

  return (
    <div className="flex items-center justify-between gap-3 border-b border-border bg-background/40 px-4 py-2">
      <div className="flex items-center gap-2">
        <Headphones
          className={[
            "h-3.5 w-3.5",
            closed ? "text-muted-foreground" : "text-primary",
          ].join(" ")}
        />
        <span className="mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          two-way · earpiece phone · ai-coustics
        </span>
      </div>

      <div className="flex items-center gap-2">
        {/* Sentinel TTS indicator */}
        <div className="flex items-center gap-1">
          <Volume2
            className={[
              "h-3 w-3",
              sentinelSpeaking ? "text-primary" : "text-muted-foreground/50",
            ].join(" ")}
          />
          <Equalizer active={sentinelSpeaking} tone="ok" />
        </div>

        <span className="mono text-[10px] text-muted-foreground/60">·</span>

        {/* Guard mic indicator */}
        <div className="flex items-center gap-1">
          <Mic
            className={[
              "h-3 w-3",
              guardSpeaking ? "text-alert" : "text-muted-foreground/50",
            ].join(" ")}
          />
          <Equalizer active={guardSpeaking} tone="alert" />
        </div>

        <span
          className={[
            "mono ml-2 rounded-full px-2 py-0.5 text-[9px] uppercase tracking-[0.18em]",
            closed
              ? "bg-muted text-muted-foreground"
              : guardSpeaking
                ? "bg-alert/15 text-alert"
                : sentinelSpeaking
                  ? "bg-primary/15 text-primary"
                  : "bg-background/40 text-muted-foreground",
          ].join(" ")}
        >
          {closed
            ? "channel closed"
            : guardSpeaking
              ? "guard speaking"
              : sentinelSpeaking
                ? "sentinel speaking"
                : "channel open"}
        </span>
      </div>
    </div>
  );
}

function Equalizer({ active, tone }: { active: boolean; tone: "ok" | "alert" }) {
  const color = tone === "alert" ? "bg-alert" : "bg-primary";
  return (
    <div className="flex h-3 items-end gap-[2px]">
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className={[
            "block w-[2px] origin-bottom rounded-sm",
            active ? `${color} animate-wave` : "bg-muted-foreground/30",
          ].join(" ")}
          style={{
            height: active ? "100%" : "30%",
            animationDelay: active ? `${i * 90}ms` : undefined,
          }}
        />
      ))}
    </div>
  );
}
