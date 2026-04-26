import { useEffect, useRef } from "react";
import { MessageSquare } from "lucide-react";

export type ChatMessage = {
  id: number;
  role: "operator" | "sentinel";
  text: string;
  at: string;
};

type ChatPanelProps = {
  messages?: ChatMessage[];
};

const FALLBACK_MESSAGES: ChatMessage[] = [
  {
    id: 0,
    role: "sentinel",
    at: "—",
    text: "Sentinel conversation log is online. Voice exchanges over the walkie-talkie will appear here.",
  },
];

export function ChatPanel({ messages }: ChatPanelProps) {
  const list = messages ?? FALLBACK_MESSAGES;
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [list]);

  return (
    <section
      aria-label="Sentinel conversation log"
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-border/60 bg-panel/30"
    >
      <header className="flex items-center justify-between gap-2 border-b border-border/60 bg-panel-elevated/35 px-3 py-2">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          <div>
            <div className="mono text-[14px] uppercase tracking-[0.2em] text-primary">
              conversation log
            </div>
          </div>
        </div>
        <span className="mono inline-flex items-center gap-1 rounded-full border border-border bg-background/40 px-2 py-0.5 text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-ok animate-soft-pulse" />
          live
        </span>
      </header>

      <div ref={scrollRef} className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 py-3">
        {list.map((m) => (
          <ChatBubble key={m.id} message={m} />
        ))}
      </div>
    </section>
  );
}

function ChatBubble({ message }: { message: ChatMessage }) {
  const isOperator = message.role === "operator";
  return (
    <div className={["flex flex-col gap-1", isOperator ? "items-end" : "items-start"].join(" ")}>
      <div
        className={[
          "max-w-[90%] rounded-lg border px-3.5 py-2.5 text-[16px] leading-relaxed",
          isOperator
            ? "border-primary/40 bg-primary/10 text-foreground"
            : "border-border bg-background/40 text-foreground/90",
        ].join(" ")}
      >
        {message.text}
      </div>
    </div>
  );
}
