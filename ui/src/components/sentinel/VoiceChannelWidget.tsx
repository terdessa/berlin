import { Headphones, Mic, Volume2 } from "lucide-react";
import type { Phase } from "@/lib/sentinel-data";

type Props = {
  phase: Phase;
};

export function VoiceChannelWidget({ phase }: Props) {
  const open = phase !== "resolved" && phase !== "idle";

  return (
    <div className="flex items-center justify-between gap-3 border-b border-border bg-background/40 px-4 py-2">
      <div className="flex items-center gap-2">
        <Headphones
          className={["h-3.5 w-3.5", open ? "text-primary" : "text-muted-foreground"].join(" ")}
        />
        <span className="mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          two-way · earpiece phone · ai-coustics
        </span>
      </div>

      <div className="flex items-center gap-2">
        <Volume2 className="h-3 w-3 text-muted-foreground/50" />
        <Mic className="h-3 w-3 text-muted-foreground/50" />
        <span
          className={[
            "mono ml-1 rounded-full px-2 py-0.5 text-[9px] uppercase tracking-[0.18em]",
            open ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
          ].join(" ")}
        >
          {open ? "channel open" : "channel closed"}
        </span>
      </div>
    </div>
  );
}
