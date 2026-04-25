import { useEffect, useRef } from "react";
import { Shield, Headphones } from "lucide-react";
import type {
  AlertEvent,
  AlertStatus,
  ConversationMessage,
  Phase,
} from "@/lib/sentinel-data";
import { VoiceChannelWidget } from "./VoiceChannelWidget";

type Props = {
  alert: AlertEvent;
  phase: Phase;
  revealUpTo: number;
  status: AlertStatus;
  onAction: (next: AlertStatus) => void;
};

const statusStyles: Record<AlertStatus, string> = {
  "Awaiting human review": "bg-alert/15 text-alert border-alert/40",
  "Floor associate dispatched": "bg-primary/15 text-primary border-primary/40",
  "Marked false alarm": "bg-muted text-muted-foreground border-border",
  "Error report created": "bg-destructive/15 text-destructive border-destructive/40",
};

export function ReviewLogPanel({
  alert,
  phase,
  revealUpTo,
  status,
  onAction,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const visibleMessages = alert.conversation.slice(0, revealUpTo);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [revealUpTo, phase]);

  // What does the next pending turn look like?
  const nextPending: "sentinel" | "guard" | null =
    revealUpTo < alert.conversation.length
      ? alert.conversation[revealUpTo].speaker
      : null;
  const showSentinelTyping =
    nextPending === "sentinel" &&
    (phase === "flagged" || phase === "interpreted" || phase === "acting");
  const showGuardListening = nextPending === "guard" && phase === "listening";

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

      {/* Two-way channel widget */}
      <VoiceChannelWidget phase={phase} />

      {/* Conversation */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {visibleMessages.map((msg, i) => (
          <MessageBubble key={i} message={msg} />
        ))}
        {showSentinelTyping && <SentinelTyping />}
        {showGuardListening && <GuardListening />}
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
            ] as AlertStatus[]
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
          onClick={() => onAction("Floor associate dispatched")}
          className="mono cursor-pointer rounded-md bg-primary px-2 py-2 text-[11px] font-medium text-primary-foreground transition hover:opacity-90"
        >
          Send floor associate
        </button>
        <button
          onClick={() => onAction("Marked false alarm")}
          className="mono cursor-pointer rounded-md border border-border bg-background/60 px-2 py-2 text-[11px] text-foreground transition hover:border-muted-foreground"
        >
          Mark false alarm
        </button>
        <button
          onClick={() => onAction("Error report created")}
          className="mono cursor-pointer rounded-md border border-destructive/40 bg-destructive/10 px-2 py-2 text-[11px] text-destructive transition hover:bg-destructive/20"
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

  const unclear = message.unclear || message.confidenceEnhanced < 0.6;
  const rawPct = Math.round(message.confidenceRaw * 100);
  const enhPct = Math.round(message.confidenceEnhanced * 100);

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
        <div className="mt-1 flex items-center justify-end gap-1.5">
          <span className="mono rounded-full border border-border bg-background/40 px-1.5 py-0.5 text-[9px] text-muted-foreground">
            raw {rawPct}%
          </span>
          <span className="mono text-[9px] text-muted-foreground">→</span>
          <span
            className={[
              "mono rounded-full border px-1.5 py-0.5 text-[9px]",
              unclear
                ? "border-alert/40 bg-alert/10 text-alert"
                : "border-primary/40 bg-primary/10 text-primary",
            ].join(" ")}
          >
            enhanced {enhPct}%
          </span>
        </div>
      </div>
    </div>
  );
}

function SentinelTyping() {
  return (
    <div className="flex justify-start">
      <div className="max-w-[85%]">
        <div className="mb-1 flex items-center gap-1.5">
          <Shield className="h-3 w-3 text-primary" />
          <span className="mono text-[10px] uppercase tracking-wider text-primary">
            Sentinel
          </span>
        </div>
        <div className="inline-flex items-center gap-1 rounded-md rounded-tl-sm border border-primary/30 bg-primary/5 px-3 py-2">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-1.5 w-1.5 animate-soft-pulse rounded-full bg-primary"
              style={{ animationDelay: `${i * 200}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function GuardListening() {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%]">
        <div className="mb-1 flex items-center justify-end gap-1.5">
          <span className="mono text-[10px] uppercase tracking-wider text-alert">
            Guard · listening
          </span>
          <Headphones className="h-3 w-3 text-alert" />
        </div>
        <div className="flex h-8 items-end gap-[3px] rounded-md rounded-tr-sm border border-dashed border-alert/40 bg-alert/5 px-3 py-2">
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <span
              key={i}
              className="block w-[3px] origin-bottom animate-wave rounded-sm bg-alert"
              style={{
                animationDelay: `${i * 80}ms`,
                height: `${30 + ((i * 13) % 70)}%`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
