import { useEffect, useRef } from "react";
import { Shield, Headphones, ChevronDown } from "lucide-react";
import type {
  AlertEvent,
  AlertStatus,
  ConversationMessage,
  Phase,
} from "@/lib/sentinel-data";
import { VoiceChannelWidget } from "./VoiceChannelWidget";

type Props = {
  alert: AlertEvent | null;
  phase: Phase;
  revealUpTo: number;
  status: AlertStatus;
  selectedCameraId: string | null;
  onAction: (next: AlertStatus) => void;
  onStartSuccess: () => void;
  onStartFailure: () => void;
};

const STATUSES: AlertStatus[] = [
  "Awaiting human review",
  "Floor associate dispatched",
  "Marked false alarm",
  "Error report created",
];

const statusTone: Record<AlertStatus, string> = {
  "Awaiting human review": "text-alert border-alert/40 bg-alert/10",
  "Floor associate dispatched": "text-primary border-primary/40 bg-primary/10",
  "Marked false alarm": "text-muted-foreground border-border bg-muted/40",
  "Error report created": "text-destructive border-destructive/40 bg-destructive/10",
};

export function ReviewLogPanel({
  alert,
  phase,
  revealUpTo,
  status,
  selectedCameraId,
  onAction,
  onStartSuccess,
  onStartFailure,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [revealUpTo, phase, alert]);

  if (!alert) {
    return <IdleLog selectedCameraId={selectedCameraId} onStartSuccess={onStartSuccess} onStartFailure={onStartFailure} />;
  }

  const visibleMessages = alert.conversation.slice(0, revealUpTo);
  const nextPending: "sentinel" | "guard" | null =
    revealUpTo < alert.conversation.length ? alert.conversation[revealUpTo].speaker : null;
  const showSentinelTyping =
    nextPending === "sentinel" && (phase === "flagged" || phase === "interpreted" || phase === "acting");
  const showGuardListening = nextPending === "guard" && phase === "listening";

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

      <VoiceChannelWidget phase={phase} />

      {/* Conversation */}
      <div ref={scrollRef} className="flex-1 space-y-2.5 overflow-y-auto px-3 py-3">
        {visibleMessages.map((msg, i) => (
          <MessageBubble key={i} message={msg} />
        ))}
        {showSentinelTyping && <SentinelTyping />}
        {showGuardListening && <GuardListening />}
      </div>

      {/* Compact status + actions in a single bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-panel-elevated px-3 py-2">
        <StatusSelector value={status} onChange={onAction} />
        <div className="flex gap-1.5">
          <button
            onClick={() => onAction("Floor associate dispatched")}
            className="mono cursor-pointer rounded-md bg-primary px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-primary-foreground transition hover:opacity-90"
          >
            dispatch
          </button>
          <button
            onClick={() => onAction("Marked false alarm")}
            className="mono cursor-pointer rounded-md border border-border bg-background/60 px-2 py-1 text-[10px] uppercase tracking-wider text-foreground transition hover:border-muted-foreground"
          >
            false alarm
          </button>
          <button
            onClick={() => onAction("Error report created")}
            className="mono cursor-pointer rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1 text-[10px] uppercase tracking-wider text-destructive transition hover:bg-destructive/20"
          >
            report
          </button>
        </div>
      </div>
    </aside>
  );
}

function StatusSelector({
  value,
  onChange,
}: {
  value: AlertStatus;
  onChange: (next: AlertStatus) => void;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as AlertStatus)}
        className={[
          "mono cursor-pointer appearance-none rounded-full border bg-transparent px-2.5 py-1 pr-6 text-[10px] uppercase tracking-wider focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          statusTone[value],
        ].join(" ")}
        aria-label="Current review status"
      >
        {STATUSES.map((s) => (
          <option key={s} value={s} className="bg-background text-foreground">
            {s.toLowerCase()}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 opacity-70" />
    </div>
  );
}

function IdleLog({
  selectedCameraId,
  onStartSuccess,
  onStartFailure,
}: {
  selectedCameraId: string | null;
  onStartSuccess: () => void;
  onStartFailure: () => void;
}) {
  return (
    <aside className="flex h-full flex-col overflow-hidden rounded-lg border border-dashed border-border bg-panel/40">
      <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
        <span className="mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          review log · standby
        </span>
        <span className="mono text-[10px] text-muted-foreground/70">
          {selectedCameraId ? `${selectedCameraId} · feed only` : "no selection"}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
        <div>
          <div className="mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            what happens on alert
          </div>
          <p className="mt-1 text-[12px] leading-snug text-foreground/85">
            When Sentinel flags a camera, this panel opens with the live two-way
            voice channel between the agent and the guard's earpiece, the
            conversation transcript, raw → enhanced confidence per turn, and
            review actions.
          </p>
        </div>

        <div className="rounded-md border border-border bg-background/40 p-2.5">
          <div className="mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            click a camera to inspect
          </div>
          <ul className="mt-1.5 space-y-1 text-[11px] text-foreground/85">
            <li>
              <span className="mono text-primary">CAM-05</span> · success demo —
              guard responds clearly, floor associate dispatched
            </li>
            <li>
              <span className="mono text-alert">CAM-08</span> · failure demo —
              noisy audio, error report generated
            </li>
            <li>
              <span className="mono text-muted-foreground">others</span> · feed
              preview only · no scripted review
            </li>
          </ul>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onStartSuccess}
            className="mono flex-1 cursor-pointer rounded-md border border-primary/40 bg-primary/10 px-2 py-1.5 text-[10px] uppercase tracking-wider text-primary transition hover:bg-primary/20"
          >
            ▶ run success
          </button>
          <button
            onClick={onStartFailure}
            className="mono flex-1 cursor-pointer rounded-md border border-alert/40 bg-alert/10 px-2 py-1.5 text-[10px] uppercase tracking-wider text-alert transition hover:bg-alert/20"
          >
            ▶ run failure
          </button>
        </div>

        {/* Skeleton preview of the conversation that will appear */}
        <div className="rounded-md border border-border/60 bg-background/30 p-2.5">
          <div className="mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            conversation preview
          </div>
          <div className="mt-2 space-y-2 opacity-60">
            <SkeletonBubble side="left" tone="primary" widths={[80, 60]} />
            <SkeletonBubble side="right" tone="alert" widths={[40]} />
            <SkeletonBubble side="left" tone="primary" widths={[55]} />
          </div>
        </div>
      </div>
    </aside>
  );
}

function SkeletonBubble({
  side,
  tone,
  widths,
}: {
  side: "left" | "right";
  tone: "primary" | "alert";
  widths: number[];
}) {
  const align = side === "left" ? "items-start" : "items-end";
  const bubble =
    tone === "primary"
      ? "border-primary/30 bg-primary/5"
      : "border-alert/30 bg-alert/5";
  const labelColor = tone === "primary" ? "text-primary" : "text-alert";
  const Icon = tone === "primary" ? Shield : Headphones;
  const label = tone === "primary" ? "Sentinel" : "Guard";
  return (
    <div className={`flex flex-col gap-1 ${align}`}>
      <div className={`flex items-center gap-1 ${labelColor}`}>
        <Icon className="h-3 w-3" />
        <span className="mono text-[9px] uppercase tracking-wider">{label}</span>
      </div>
      <div className={`flex w-full ${side === "right" ? "justify-end" : ""}`}>
        <div className={`max-w-[80%] rounded-md border ${bubble} p-1.5`}>
          {widths.map((w, i) => (
            <div
              key={i}
              className="h-1.5 rounded-full bg-foreground/20"
              style={{ width: `${w}%`, marginTop: i > 0 ? 4 : 0 }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ConversationMessage }) {
  if (message.speaker === "sentinel") {
    return (
      <div className="flex justify-start">
        <div className="max-w-[88%]">
          <div className="mb-0.5 flex items-center gap-1.5">
            <Shield className="h-3 w-3 text-primary" />
            <span className="mono text-[9px] uppercase tracking-wider text-primary">
              Sentinel
            </span>
            <span className="mono text-[9px] text-muted-foreground">{message.timestamp}</span>
          </div>
          <div className="rounded-md rounded-tl-sm border border-primary/30 bg-primary/5 px-2.5 py-1.5 text-[12px] leading-snug text-foreground">
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
      <div className="max-w-[88%]">
        <div className="mb-0.5 flex items-center justify-end gap-1.5">
          <span className="mono text-[9px] text-muted-foreground">{message.timestamp}</span>
          <span className="mono text-[9px] uppercase tracking-wider text-alert">
            Guard
          </span>
          <Headphones className="h-3 w-3 text-alert" />
        </div>
        <div
          className={[
            "rounded-md rounded-tr-sm px-2.5 py-1.5 text-[12px] leading-snug text-foreground",
            unclear
              ? "border border-dashed border-alert/50 bg-alert/5"
              : "border border-alert/30 bg-alert/10",
          ].join(" ")}
        >
          <div>{message.text}</div>
          {unclear && (
            <div className="mt-1 mono text-[10px] text-alert/80">
              voice command unclear — clarification requested
            </div>
          )}
        </div>
        <div className="mt-0.5 flex items-center justify-end gap-1">
          <span className="mono rounded-full border border-border bg-background/40 px-1 py-px text-[9px] text-muted-foreground">
            raw {rawPct}%
          </span>
          <span className="mono text-[9px] text-muted-foreground">→</span>
          <span
            className={[
              "mono rounded-full border px-1 py-px text-[9px]",
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
      <div>
        <div className="mb-0.5 flex items-center gap-1.5">
          <Shield className="h-3 w-3 text-primary" />
          <span className="mono text-[9px] uppercase tracking-wider text-primary">
            Sentinel
          </span>
        </div>
        <div className="inline-flex items-center gap-1 rounded-md rounded-tl-sm border border-primary/30 bg-primary/5 px-2.5 py-1.5">
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
      <div>
        <div className="mb-0.5 flex items-center justify-end gap-1.5">
          <span className="mono text-[9px] uppercase tracking-wider text-alert">
            Guard · listening
          </span>
          <Headphones className="h-3 w-3 text-alert" />
        </div>
        <div className="flex h-7 items-end gap-[3px] rounded-md rounded-tr-sm border border-dashed border-alert/40 bg-alert/5 px-2.5 py-1">
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <span
              key={i}
              className="block w-[3px] origin-bottom animate-wave rounded-sm bg-alert"
              style={{ animationDelay: `${i * 80}ms`, height: `${30 + ((i * 13) % 70)}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
