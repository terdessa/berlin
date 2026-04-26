import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { MessageSquare, Send } from "lucide-react";

type Message = {
  id: number;
  role: "operator" | "sentinel";
  text: string;
  at: string;
};

const INITIAL_MESSAGES: Message[] = [
  {
    id: 1,
    role: "sentinel",
    at: "—",
    text: "Sentinel chat is online. Ask about a camera, a flagged moment, or type /help.",
  },
];

function timestamp() {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function autoReply(input: string): string {
  const text = input.trim().toLowerCase();
  if (!text) return "Say something — I'm listening.";
  if (text === "/help") {
    return "Try: 'show CAM-03', 'replay last alert', 'mute audio', 'open metrics'.";
  }
  if (text.includes("metric") || text.includes("score") || text.includes("sais")) {
    return "Open the Audio Intelligence bench from the SAIS pill in the header.";
  }
  if (text.includes("cam")) {
    return "Click the tile in the camera wall to focus that feed.";
  }
  if (text.includes("alert") || text.includes("review")) {
    return "No active alerts — backend rewrite is pending. The wall is on passive recording.";
  }
  return "Logged. Backend voice loop is offline; this thread stays local until the rewrite ships.";
}

export function ChatPanel() {
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [draft, setDraft] = useState("");
  const idRef = useRef(2);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  function send() {
    const text = draft.trim();
    if (!text) return;
    const at = timestamp();
    const operator: Message = { id: idRef.current++, role: "operator", text, at };
    const sentinel: Message = {
      id: idRef.current++,
      role: "sentinel",
      text: autoReply(text),
      at,
    };
    setMessages((prev) => [...prev, operator, sentinel]);
    setDraft("");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    send();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  }

  return (
    <section
      aria-label="Sentinel chat"
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-border/70 bg-panel/70"
    >
      <header className="flex items-center justify-between gap-2 border-b border-border bg-panel-elevated/80 px-3 py-2">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          <div>
            <div className="mono text-[10px] uppercase tracking-[0.2em] text-primary">chat</div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">operator console</div>
          </div>
        </div>
        <span className="mono inline-flex items-center gap-1 rounded-full border border-border bg-background/40 px-2 py-0.5 text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-ok animate-soft-pulse" />
          local
        </span>
      </header>

      <div ref={scrollRef} className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 py-3">
        {messages.map((m) => (
          <ChatBubble key={m.id} message={m} />
        ))}
      </div>

      <form onSubmit={handleSubmit} className="border-t border-border bg-panel/80 px-3 py-2.5">
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder="Message Sentinel…"
            aria-label="Message Sentinel"
            className="min-h-9 max-h-32 flex-1 resize-none rounded-md border border-border bg-background/60 px-2.5 py-2 text-[12px] leading-snug text-foreground placeholder:text-muted-foreground/70 focus:border-primary/60 focus:outline-none"
          />
          <button
            type="submit"
            disabled={draft.trim().length === 0}
            aria-label="Send message"
            className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md bg-primary text-primary-foreground transition-colors duration-200 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        <div className="mono mt-1.5 text-[9px] uppercase tracking-[0.14em] text-muted-foreground/70">
          enter to send · shift+enter for newline
        </div>
      </form>
    </section>
  );
}

function ChatBubble({ message }: { message: Message }) {
  const isOperator = message.role === "operator";
  return (
    <div className={["flex flex-col gap-1", isOperator ? "items-end" : "items-start"].join(" ")}>
      <div
        className={[
          "max-w-[85%] rounded-lg border px-2.5 py-1.5 text-[12px] leading-snug",
          isOperator
            ? "border-primary/40 bg-primary/10 text-foreground"
            : "border-border bg-background/40 text-foreground/90",
        ].join(" ")}
      >
        {message.text}
      </div>
      <div className="mono px-1 text-[9px] uppercase tracking-[0.14em] text-muted-foreground/70">
        {isOperator ? "you" : "sentinel"} · {message.at}
      </div>
    </div>
  );
}
