import { useEffect, useRef } from "react";
import { Shield, Headphones } from "lucide-react";
import type { AlertEvent, AlertStatus, ConversationMessage, Phase } from "@/lib/sentinel-data";
import { VoiceChannelWidget } from "./VoiceChannelWidget";

type Props = {
  alert: AlertEvent | null;
  phase: Phase;
  revealUpTo: number;
  status: AlertStatus;
  selectedCameraId: string | null;
};

const statusTone: Record<AlertStatus, string> = {
  "Awaiting human review": "text-alert border-alert/40 bg-alert/10",
  "Floor associate dispatched": "text-primary border-primary/40 bg-primary/10",
  "Marked false alarm": "text-muted-foreground border-border bg-muted/40",
  "Error report created": "text-destructive border-destructive/40 bg-destructive/10",
};

export function ReviewLogPanel({ alert, phase, revealUpTo, status, selectedCameraId }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [revealUpTo, phase, alert]);

  if (!alert) {
    return <IdleLog selectedCameraId={selectedCameraId} />;
  }

  const visibleMessages = alert.conversation.slice(0, revealUpTo);

  return (
    <aside className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-panel animate-slide-in-right">
      {/* Header — compact */}
      <div className="flex items-center justify-between border-b border-border bg-panel-elevated px-3 py-2">
        <div className="flex items-baseline gap-2">
          <span className="mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            review
          </span>
          <span className="mono text-xs text-foreground">
            {alert.cameraId} · {alert.zone}
          </span>
        </div>
        <span className="mono text-[10px] text-muted-foreground">{alert.timestamp}</span>
      </div>

      {alert.conversation.length > 0 && <VoiceChannelWidget phase={phase} />}

      {/* Conversation */}
      <div ref={scrollRef} className="flex-1 space-y-2.5 overflow-y-auto px-3 py-3">
        {visibleMessages.map((msg, i) => (
          <MessageBubble key={i} message={msg} />
        ))}
        {visibleMessages.length === 0 && (
          <div className="flex h-full items-center justify-center text-center">
            <span className="mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              visual event received · no transcript turns yet
            </span>
          </div>
        )}
      </div>

      {/* Status comes from the live interaction record, not from local UI buttons. */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-panel-elevated px-3 py-2">
        <StatusPill value={status} />
        <span className="mono text-[10px] text-muted-foreground/70">
          {alert.conversation.length} transcript turns
        </span>
      </div>
    </aside>
  );
}

function StatusPill({ value }: { value: AlertStatus }) {
  return (
    <span
      className={[
        "mono rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-wider",
        statusTone[value],
      ].join(" ")}
    >
      {value.toLowerCase()}
    </span>
  );
}

function IdleLog({ selectedCameraId }: { selectedCameraId: string | null }) {
  return (
    <aside className="flex h-full flex-col overflow-hidden rounded-lg border border-dashed border-border bg-panel/40">
      <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
        <span className="mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          review log
        </span>
        <span className="mono text-[10px] text-muted-foreground/70">
          {selectedCameraId ? `${selectedCameraId} selected` : "idle"}
        </span>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 text-center">
        <div>
          <div className="mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            no live interaction received
          </div>
          {selectedCameraId && (
            <p className="mt-1 text-[12px] leading-snug text-muted-foreground/80">
              Waiting for a live voice event tied to {selectedCameraId}.
            </p>
          )}
        </div>
      </div>
    </aside>
  );
}

function MessageBubble({ message }: { message: ConversationMessage }) {
  if (message.speaker === "sentinel") {
    return (
      <div className="flex justify-start">
        <div className="max-w-[88%]">
          <div className="mb-0.5 flex items-center gap-1.5">
            <Shield className="h-3 w-3 text-primary" />
            <span className="mono text-[9px] uppercase tracking-wider text-primary">Sentinel</span>
            <span className="mono text-[9px] text-muted-foreground">{message.timestamp}</span>
          </div>
          <div className="rounded-md rounded-tl-sm border border-primary/30 bg-primary/5 px-2.5 py-1.5 text-[12px] leading-snug text-foreground">
            {message.text}
          </div>
        </div>
      </div>
    );
  }

  const hasDualTranscripts = !!(message.rawText || message.enhancedText);
  const transcriptsDiffer = message.transcriptsDiffer ?? false;
  const deltaMos = typeof message.nisqaDeltaMos === "number" ? message.nisqaDeltaMos : null;
  const rawMos = typeof message.nisqaRawMos === "number" ? message.nisqaRawMos : null;
  const enhMos = typeof message.nisqaEnhancedMos === "number" ? message.nisqaEnhancedMos : null;

  return (
    <div className="flex justify-end">
      <div className="max-w-[88%]">
        <div className="mb-0.5 flex items-center justify-end gap-1.5">
          <span className="mono text-[9px] text-muted-foreground">{message.timestamp}</span>
          <span className="mono text-[9px] uppercase tracking-wider text-alert">Guard</span>
          <Headphones className="h-3 w-3 text-alert" />
        </div>
        <div className="rounded-md rounded-tr-sm border border-alert/30 bg-alert/10 px-2.5 py-1.5 text-[12px] leading-snug text-foreground">
          {hasDualTranscripts ? (
            <div className="space-y-1">
              <div>
                <span className="mono text-[9px] uppercase tracking-wider text-muted-foreground">
                  raw transcript
                </span>
                <div className="text-foreground/70">{message.rawText ?? message.text}</div>
              </div>
              <div>
                <span className="mono text-[9px] uppercase tracking-wider text-primary">
                  ai-coustics enhanced transcript
                </span>
                <div className="font-medium">{message.enhancedText ?? message.text}</div>
              </div>
            </div>
          ) : (
            <div>{message.text}</div>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center justify-end gap-1">
          {transcriptsDiffer && (
            <span className="mono rounded-full border border-primary/40 bg-primary/10 px-1.5 py-px text-[9px] uppercase tracking-wider text-primary">
              enhancement changed words
            </span>
          )}
          {rawMos !== null && enhMos !== null && (
            <span className="mono rounded-full border border-border bg-background/40 px-1.5 py-px text-[9px] text-muted-foreground">
              MOS {rawMos.toFixed(1)} → {enhMos.toFixed(1)}
            </span>
          )}
          {deltaMos !== null && (
            <span
              className={[
                "mono rounded-full border px-1.5 py-px text-[9px] uppercase tracking-wider",
                deltaMos > 0.1
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : deltaMos < -0.1
                    ? "border-alert/40 bg-alert/10 text-alert"
                    : "border-border bg-background/40 text-muted-foreground",
              ].join(" ")}
            >
              Δ MOS {deltaMos >= 0 ? "+" : ""}
              {deltaMos.toFixed(1)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
