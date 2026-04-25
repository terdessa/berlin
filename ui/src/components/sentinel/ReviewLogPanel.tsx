import { useEffect, useRef, useState } from "react";
import { Shield, Headphones } from "lucide-react";
import type { AlertEvent, ConversationMessage } from "@/lib/sentinel-data";

type Status =
  | "Awaiting human review"
  | "Floor associate dispatched"
  | "Marked false alarm"
  | "Error report created";

type Props = {
  alert: AlertEvent;
};

export function ReviewLogPanel({ alert }: Props) {
  const [status, setStatus] = useState<Status>("Awaiting human review");
  const scrollRef = useRef<HTMLDivElement>(null);

  const channelClosed =
    status === "Floor associate dispatched" ||
    status === "Marked false alarm" ||
    status === "Error report created";

  const statusStyles: Record<Status, string> = {
    "Awaiting human review": "bg-alert/15 text-alert border-alert/40",
    "Floor associate dispatched": "bg-primary/15 text-primary border-primary/40",
    "Marked false alarm": "bg-muted text-muted-foreground border-border",
    "Error report created": "bg-destructive/15 text-destructive border-destructive/40",
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [alert]);

  return (
    <aside className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-panel animate-slide-in-right">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-panel-elevated px-4 py-3">
        <div>
          <div className="mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            review record
          </div>
          <div className="mt-0.5 mono text-sm text-foreground">
            {alert.cameraId} · {alert.zone}
          </div>
        </div>
        <span className="mono text-[10px] text-muted-foreground">{alert.timestamp}</span>
      </div>

      {/* Channel status */}
      <div className="flex items-center justify-between border-b border-border bg-background/30 px-4 py-2">
        <div className="flex items-center gap-2">
          <span
            className={[
              "h-1.5 w-1.5 rounded-full",
              channelClosed ? "bg-muted-foreground" : "bg-primary animate-soft-pulse",
            ].join(" ")}
          />
          <span className="mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            {channelClosed ? "channel closed" : "live · earpiece channel open"}
          </span>
        </div>
        <span className="mono text-[10px] text-muted-foreground">guard · earpiece</span>
      </div>

      {/* Conversation */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {alert.conversation.map((msg, i) => (
          <MessageBubble key={i} message={msg} />
        ))}
      </div>

      {/* Status badges */}
      <div className="border-t border-border bg-background/30 px-4 py-3">
        <div className="mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          current status
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {(
            [
              "Awaiting human review",
              "Floor associate dispatched",
              "Marked false alarm",
              "Error report created",
            ] as Status[]
          ).map((s) => (
            <span
              key={s}
              className={[
                "mono rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider transition",
                s === status
                  ? statusStyles[s]
                  : "border-border bg-background/30 text-muted-foreground/60",
              ].join(" ")}
            >
              {s}
            </span>
          ))}
        </div>
      </div>

      {/* Footer actions */}
      <div className="grid grid-cols-3 gap-2 border-t border-border bg-panel-elevated p-3">
        <button
          onClick={() => setStatus("Floor associate dispatched")}
          className="mono rounded-md bg-primary px-2 py-2 text-[11px] font-medium text-primary-foreground transition hover:opacity-90"
        >
          Send floor associate
        </button>
        <button
          onClick={() => setStatus("Marked false alarm")}
          className="mono rounded-md border border-border bg-background/60 px-2 py-2 text-[11px] text-foreground transition hover:border-muted-foreground"
        >
          Mark false alarm
        </button>
        <button
          onClick={() => setStatus("Error report created")}
          className="mono rounded-md border border-destructive/40 bg-destructive/10 px-2 py-2 text-[11px] text-destructive transition hover:bg-destructive/20"
        >
          Create report
        </button>
      </div>
    </aside>
  );
}

function MessageBubble({ message }: { message: ConversationMessage }) {
  if (message.speaker === "sentinel") {
    return (
      <div className="flex justify-start">
        <div className="max-w-[85%]">
          <div className="mb-1 flex items-center gap-1.5">
            <Shield className="h-3 w-3 text-primary" />
            <span className="mono text-[10px] uppercase tracking-wider text-primary">
              Sentinel
            </span>
            <span className="mono text-[9px] text-muted-foreground">{message.timestamp}</span>
          </div>
          <div className="rounded-md rounded-tl-sm border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-foreground">
            {message.text}
          </div>
        </div>
      </div>
    );
  }

  const unclear = message.unclear || message.confidence < 0.6;

  return (
    <div className="flex justify-end">
      <div className="max-w-[85%]">
        <div className="mb-1 flex items-center justify-end gap-1.5">
          <span className="mono text-[9px] text-muted-foreground">{message.timestamp}</span>
          <span className="mono text-[10px] uppercase tracking-wider text-alert">
            Guard · earpiece
          </span>
          <Headphones className="h-3 w-3 text-alert" />
        </div>
        <div
          className={[
            "rounded-md rounded-tr-sm px-3 py-2 text-sm text-foreground",
            unclear
              ? "border border-dashed border-alert/50 bg-alert/5"
              : "border border-alert/30 bg-alert/10",
          ].join(" ")}
        >
          <div>{message.text}</div>
          {unclear && (
            <div className="mt-1.5 mono text-[10px] text-alert/80">
              voice command unclear — clarification requested
            </div>
          )}
        </div>
        <div className="mt-1 flex justify-end">
          <span
            className={[
              "mono rounded-full border px-1.5 py-0.5 text-[9px]",
              unclear
                ? "border-alert/40 bg-alert/10 text-alert"
                : "border-border bg-background/40 text-muted-foreground",
            ].join(" ")}
          >
            conf {message.confidence.toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
}
