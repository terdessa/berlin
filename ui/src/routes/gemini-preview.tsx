import { Link, createFileRoute } from "@tanstack/react-router";
import {
  ArrowLeft,
  Bot,
  Camera,
  Circle,
  Eye,
  Loader2,
  MessageSquare,
  Play,
  Send,
  Square,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { analyzeCameraFrame, type GeminiCameraMessage } from "@/lib/gemini-camera-analysis";
import { LivePageSkeleton } from "@/lib/live-page-skeleton";

export const Route = createFileRoute("/gemini-preview")({
  component: GeminiPreviewPage,
  head: () => ({
    meta: [
      { title: "Sentinel - Gemini camera preview" },
      {
        name: "description",
        content: "Local MacBook camera preview with Gemini visual analysis and chat.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

type ChatMessage = GeminiCameraMessage & {
  id: string;
  kind?: "commentary" | "question" | "error";
};

type CameraStatus =
  | { state: "idle" }
  | { state: "starting" }
  | { state: "ready"; cameraLabel: string; microphoneLabel: string }
  | { state: "error"; message: string };

const AUTO_PROMPT =
  "Comment on the current camera frame. Focus on what changed, what is visible, and anything operationally relevant.";

function GeminiPreviewPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <LivePageSkeleton title="Sentinel · Gemini camera preview" />;
  return <GeminiPreviewInner />;
}

function GeminiPreviewInner() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chatRef = useRef<HTMLDivElement | null>(null);
  const autoTimerRef = useRef<number | null>(null);

  const [status, setStatus] = useState<CameraStatus>({ state: "idle" });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [autoCommentary, setAutoCommentary] = useState(false);
  const [lastModel, setLastModel] = useState<string | null>(null);

  const history = useMemo<GeminiCameraMessage[]>(
    () =>
      messages
        .filter((message) => message.kind !== "error")
        .map(({ role, text }) => ({ role, text }))
        .slice(-8),
    [messages],
  );

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setStatus({ state: "idle" });
  }, []);

  const startCamera = useCallback(async () => {
    setStatus({ state: "starting" });
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 24, max: 30 },
          facingMode: { ideal: "user" },
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      const videoTrack = stream.getVideoTracks()[0];
      const audioTrack = stream.getAudioTracks()[0];
      setStatus({
        state: "ready",
        cameraLabel: videoTrack?.label || "MacBook camera",
        microphoneLabel: audioTrack?.label || "MacBook microphone",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setStatus({ state: "error", message });
    }
  }, []);

  useEffect(() => {
    void startCamera();
    return () => {
      if (autoTimerRef.current !== null) window.clearInterval(autoTimerRef.current);
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  useEffect(() => {
    const el = chatRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy]);

  const captureFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.videoWidth === 0 || video.videoHeight === 0) return null;

    const width = Math.min(960, video.videoWidth);
    const height = Math.round((width / video.videoWidth) * video.videoHeight);
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", 0.78);
  }, []);

  const askGemini = useCallback(
    async (prompt: string, mode: "question" | "commentary") => {
      if (busy || status.state !== "ready") return;
      const imageBase64 = captureFrame();
      if (!imageBase64) {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "model",
            kind: "error",
            text: "Camera frame is not ready yet.",
          },
        ]);
        return;
      }

      setBusy(true);
      if (mode === "question") {
        setMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: "user", kind: "question", text: prompt },
        ]);
      }

      const result = await analyzeCameraFrame({
        data: {
          imageBase64,
          prompt,
          history,
          mode,
        },
      });

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "model",
          kind: result.ok ? mode : "error",
          text: result.ok ? result.text : result.message,
        },
      ]);
      if (result.ok) setLastModel(result.model);
      setBusy(false);
    },
    [busy, captureFrame, history, status.state],
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const prompt = question.trim();
    if (!prompt) return;
    setQuestion("");
    await askGemini(prompt, "question");
  };

  useEffect(() => {
    if (autoTimerRef.current !== null) {
      window.clearInterval(autoTimerRef.current);
      autoTimerRef.current = null;
    }
    if (!autoCommentary || status.state !== "ready") return;

    autoTimerRef.current = window.setInterval(() => {
      void askGemini(AUTO_PROMPT, "commentary");
    }, 7000);

    return () => {
      if (autoTimerRef.current !== null) window.clearInterval(autoTimerRef.current);
      autoTimerRef.current = null;
    };
  }, [askGemini, autoCommentary, status.state]);

  const canAsk = status.state === "ready" && !busy;

  return (
    <main className="flex min-h-screen flex-col bg-background px-4 py-4 text-foreground sm:px-6">
      <header className="mx-auto flex w-full max-w-7xl flex-wrap items-start justify-between gap-4 border-b border-border/70 pb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background/60 text-muted-foreground transition hover:border-primary/50 hover:text-foreground"
              aria-label="Back to dashboard"
              title="Back to dashboard"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <span className="mono rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-primary">
              Gemini visual preview
            </span>
            <CameraStatusPill status={status} />
          </div>
          <h1 className="mt-3 text-3xl font-semibold leading-tight">MacBook camera analyst</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Local browser camera preview with server-side Gemini analysis. Ask questions about the
            current frame or let Gemini comment on the scene while the camera runs.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setAutoCommentary((value) => !value)}
            disabled={status.state !== "ready"}
            className={[
              "mono inline-flex h-9 items-center gap-2 rounded-md border px-3 text-[10px] uppercase tracking-[0.16em] transition disabled:cursor-not-allowed disabled:opacity-40",
              autoCommentary
                ? "border-primary/50 bg-primary/15 text-primary"
                : "border-border bg-background/50 text-muted-foreground hover:border-primary/50 hover:text-foreground",
            ].join(" ")}
          >
            {autoCommentary ? <Square className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {autoCommentary ? "stop comments" : "auto comment"}
          </button>
          <button
            type="button"
            onClick={status.state === "ready" ? stopCamera : startCamera}
            className="mono inline-flex h-9 items-center gap-2 rounded-md border border-border bg-background/50 px-3 text-[10px] uppercase tracking-[0.16em] text-muted-foreground transition hover:border-primary/50 hover:text-foreground"
          >
            {status.state === "ready" ? (
              <Square className="h-3.5 w-3.5" />
            ) : (
              <Camera className="h-3.5 w-3.5" />
            )}
            {status.state === "ready" ? "stop camera" : "start camera"}
          </button>
        </div>
      </header>

      <section className="mx-auto mt-4 grid w-full max-w-7xl flex-1 gap-4 xl:grid-cols-[minmax(0,1.16fr)_minmax(390px,0.84fr)]">
        <div className="flex min-h-0 flex-col rounded-lg border border-border bg-panel/85">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-primary" />
              <span className="mono text-[11px] uppercase tracking-[0.2em]">camera preview</span>
            </div>
            {lastModel && (
              <span className="mono rounded-full border border-border bg-background/40 px-2.5 py-1 text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
                {lastModel}
              </span>
            )}
          </div>

          <div className="relative min-h-0 flex-1 overflow-hidden bg-background">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="h-full min-h-[420px] w-full object-cover"
            />
            {status.state !== "ready" && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/80 px-6 text-center">
                <div>
                  <div className="mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    {status.state === "starting" ? "opening camera" : "camera unavailable"}
                  </div>
                  {status.state === "error" && (
                    <p className="mt-2 max-w-md text-sm text-muted-foreground">{status.message}</p>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="grid gap-2 border-t border-border px-4 py-3 sm:grid-cols-3">
            <InfoTile
              label="camera"
              value={status.state === "ready" ? status.cameraLabel : "pending"}
            />
            <InfoTile
              label="microphone"
              value={status.state === "ready" ? status.microphoneLabel : "pending"}
            />
            <InfoTile label="analysis" value={autoCommentary ? "continuous" : "on demand"} />
          </div>
        </div>

        <aside className="flex min-h-[560px] flex-col overflow-hidden rounded-lg border border-border bg-panel/85">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              <span className="mono text-[11px] uppercase tracking-[0.2em]">visual chat</span>
            </div>
            {busy && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
          </div>

          <div ref={chatRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.length === 0 ? (
              <div className="flex h-full items-center justify-center px-4 text-center">
                <div>
                  <Bot className="mx-auto h-8 w-8 text-primary/80" />
                  <div className="mono mt-3 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    ask about the current frame
                  </div>
                  <p className="mt-2 max-w-xs text-xs leading-5 text-muted-foreground">
                    Try: "What changed?", "Describe the scene", or "What should I pay attention to?"
                  </p>
                </div>
              </div>
            ) : (
              messages.map((message) => <ChatBubble key={message.id} message={message} />)
            )}
          </div>

          <form onSubmit={handleSubmit} className="border-t border-border p-3">
            <div className="flex gap-2">
              <input
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="Ask Gemini about the current camera frame..."
                className="min-w-0 flex-1 rounded-md border border-border bg-background/60 px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary/60"
              />
              <button
                type="submit"
                disabled={!canAsk || !question.trim()}
                className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-primary/45 bg-primary/15 text-primary transition hover:border-primary/70 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Send question"
                title="Send question"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
          </form>
        </aside>
      </section>

      <canvas ref={canvasRef} className="hidden" />
    </main>
  );
}

function CameraStatusPill({ status }: { status: CameraStatus }) {
  const ready = status.state === "ready";
  const label =
    status.state === "ready"
      ? "camera live"
      : status.state === "starting"
        ? "starting"
        : status.state === "error"
          ? "blocked"
          : "idle";

  return (
    <span
      className={[
        "mono inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] uppercase tracking-[0.14em]",
        ready
          ? "border-ok/40 bg-ok/10 text-ok"
          : status.state === "error"
            ? "border-alert/50 bg-alert/10 text-alert"
            : "border-border bg-panel/70 text-muted-foreground",
      ].join(" ")}
    >
      <Circle className={["h-2 w-2 fill-current", ready ? "animate-soft-pulse" : ""].join(" ")} />
      {label}
    </span>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background/30 px-3 py-2">
      <div className="mono text-[8px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 truncate text-sm font-medium text-foreground">{value}</div>
    </div>
  );
}

function ChatBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const isError = message.kind === "error";
  return (
    <div className={["flex", isUser ? "justify-end" : "justify-start"].join(" ")}>
      <div className={["max-w-[88%]", isUser ? "text-right" : "text-left"].join(" ")}>
        <div
          className={[
            "mono mb-1 text-[9px] uppercase tracking-[0.16em]",
            isUser ? "text-primary" : isError ? "text-alert" : "text-muted-foreground",
          ].join(" ")}
        >
          {isUser
            ? "you"
            : isError
              ? "system"
              : message.kind === "commentary"
                ? "gemini · comment"
                : "gemini"}
        </div>
        <div
          className={[
            "rounded-md border px-3 py-2 text-sm leading-6",
            isUser
              ? "border-primary/35 bg-primary/10 text-foreground"
              : isError
                ? "border-alert/45 bg-alert/10 text-alert"
                : "border-border bg-background/45 text-foreground",
          ].join(" ")}
        >
          {message.text}
        </div>
      </div>
    </div>
  );
}
