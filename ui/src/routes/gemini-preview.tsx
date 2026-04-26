import { Link, createFileRoute } from "@tanstack/react-router";
import {
  ArrowLeft,
  Bot,
  Camera,
  Circle,
  Eye,
  Loader2,
  MessageSquare,
  Mic,
  Play,
  Send,
  ShieldAlert,
  Square,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { analyzeCameraFrame, type GeminiCameraMessage } from "@/lib/gemini-camera-analysis";
import { LivePageSkeleton } from "@/lib/live-page-skeleton";
import { publishVisualAlert } from "@/lib/publish-visual-alert";

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
  kind?: "commentary" | "question" | "loss-scan" | "object-watch" | "error";
};

type CameraStatus =
  | { state: "idle" }
  | { state: "starting" }
  | { state: "ready"; cameraLabel: string; microphoneLabel: string }
  | { state: "error"; message: string };

const AUTO_PROMPT =
  "Comment on the current camera frame. Focus on what changed, what is visible, and anything operationally relevant.";
const MAX_VOICE_RECORD_MS = 10_000;
const MIN_VOICE_RECORD_MS = 400;
const LIVE_SCAN_FRAME_COUNT = 8;
const LIVE_SCAN_FRAME_INTERVAL_MS = 500;
const LIVE_SCAN_CYCLE_MS = 6_000;
const LIVE_SCAN_PROMPT =
  "Run a loss-prevention review pass on this short camera sequence. Look for observable item movement or concealment-like behavior that should be reviewed by a human. Use cautious, non-accusatory language.";
const OBJECT_WATCH_INTERVAL_MS = 1_000;
const WATCHED_OBJECT_LABEL = "Mac";
const OBJECT_WATCH_PROMPT =
  "Detect whether a MacBook, laptop, or Mac computer is visible anywhere in this single frame. Reply exactly ITEM_VISIBLE if it is visible, otherwise reply exactly ITEM_GONE.";
const OBJECT_GONE_ALERT =
  "Mac disappeared from the camera frame. Human review recommended. Please locate and review the missing item.";

async function openGeminiCamera(deviceId?: string): Promise<MediaStream> {
  const video: MediaTrackConstraints = {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    frameRate: { ideal: 24, max: 30 },
    ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: { ideal: "user" } }),
  };

  return navigator.mediaDevices.getUserMedia({
    video,
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });
}

async function listVideoDevices(): Promise<MediaDeviceInfo[]> {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter((device) => device.kind === "videoinput" && device.deviceId);
}

function friendlyCameraLabel(device: MediaDeviceInfo, index: number) {
  return device.label?.trim() || `Camera ${index + 1}`;
}

type VoiceState = "idle" | "recording" | "processing";

type VoiceRecorder = {
  context: AudioContext;
  source: MediaStreamAudioSourceNode;
  processor: ScriptProcessorNode;
  chunks: Float32Array[];
  sampleRate: number;
  startedAt: number;
  durationTimer: number;
  stopTimer: number;
};

type WindowWithWebkitAudioContext = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

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
  const liveScanTimerRef = useRef<number | null>(null);
  const objectWatchTimerRef = useRef<number | null>(null);
  const voiceRecorderRef = useRef<VoiceRecorder | null>(null);
  const busyRef = useRef(false);
  const historyRef = useRef<GeminiCameraMessage[]>([]);
  const objectCheckingRef = useRef(false);
  const objectWatchRef = useRef(false);
  const activeDeviceIdRef = useRef<string | undefined>(undefined);

  const [status, setStatus] = useState<CameraStatus>({ state: "idle" });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [autoCommentary, setAutoCommentary] = useState(false);
  const [lastModel, setLastModel] = useState<string | null>(null);
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [voiceDurationMs, setVoiceDurationMs] = useState(0);
  const [liveScan, setLiveScan] = useState(false);
  const [scanState, setScanState] = useState<"idle" | "capturing" | "analyzing">("idle");
  const [lastScanFrames, setLastScanFrames] = useState(0);
  const [objectWatch, setObjectWatch] = useState(false);
  const [objectState, setObjectState] = useState<"idle" | "checking" | "visible" | "gone">("idle");
  const [objectAttempts, setObjectAttempts] = useState(0);
  const [visualAlertState, setVisualAlertState] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [activeDeviceId, setActiveDeviceId] = useState<string | undefined>(undefined);
  const [switchingCamera, setSwitchingCamera] = useState(false);

  const history = useMemo<GeminiCameraMessage[]>(
    () =>
      messages
        .filter((message) => message.kind !== "error")
        .map(({ role, text }) => ({ role, text }))
        .slice(-8),
    [messages],
  );

  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  useEffect(() => {
    activeDeviceIdRef.current = activeDeviceId;
  }, [activeDeviceId]);

  const stopCamera = useCallback(() => {
    if (liveScanTimerRef.current !== null) window.clearInterval(liveScanTimerRef.current);
    liveScanTimerRef.current = null;
    if (objectWatchTimerRef.current !== null) window.clearInterval(objectWatchTimerRef.current);
    objectWatchTimerRef.current = null;
    objectWatchRef.current = false;
    objectCheckingRef.current = false;
    setLiveScan(false);
    setScanState("idle");
    setObjectWatch(false);
    setObjectState("idle");
    setObjectAttempts(0);
    setVisualAlertState("idle");
    stopVoiceRecorder(voiceRecorderRef.current);
    voiceRecorderRef.current = null;
    setVoiceState("idle");
    setVoiceDurationMs(0);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setStatus({ state: "idle" });
  }, []);

  const startCamera = useCallback(async () => {
    setStatus({ state: "starting" });
    try {
      const stream = await openGeminiCamera(activeDeviceIdRef.current);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      const videoTrack = stream.getVideoTracks()[0];
      const audioTrack = stream.getAudioTracks()[0];
      const currentDeviceId = videoTrack?.getSettings().deviceId;
      activeDeviceIdRef.current = currentDeviceId;
      setActiveDeviceId(currentDeviceId);
      listVideoDevices()
        .then((devices) => setVideoDevices(devices))
        .catch(() => {});
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

  const switchCamera = useCallback(
    async (deviceId: string) => {
      if (switchingCamera || deviceId === activeDeviceId) return;
      setSwitchingCamera(true);
      setStatus({ state: "starting" });
      try {
        const stream = await openGeminiCamera(deviceId);
        const videoTrack = stream.getVideoTracks()[0];
        const audioTrack = stream.getAudioTracks()[0];
        if (!videoTrack) throw new Error("Selected camera did not provide a video track.");

        stopVoiceRecorder(voiceRecorderRef.current);
        voiceRecorderRef.current = null;
        setVoiceState("idle");
        setVoiceDurationMs(0);

        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }

        const currentDeviceId = videoTrack.getSettings().deviceId || deviceId;
        activeDeviceIdRef.current = currentDeviceId;
        setActiveDeviceId(currentDeviceId);
        setStatus({
          state: "ready",
          cameraLabel: videoTrack.label || "Selected camera",
          microphoneLabel: audioTrack?.label || "Microphone",
        });
        listVideoDevices()
          .then((devices) => setVideoDevices(devices))
          .catch(() => {});
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setStatus({ state: "error", message });
      } finally {
        setSwitchingCamera(false);
      }
    },
    [activeDeviceId, switchingCamera],
  );

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

  const captureFrameSequence = useCallback(async () => {
    const frames: string[] = [];
    for (let index = 0; index < LIVE_SCAN_FRAME_COUNT; index += 1) {
      const frame = captureFrame();
      if (frame) frames.push(frame);
      if (index < LIVE_SCAN_FRAME_COUNT - 1) {
        await delay(LIVE_SCAN_FRAME_INTERVAL_MS);
      }
    }
    return frames;
  }, [captureFrame]);

  const askGemini = useCallback(
    async (
      prompt: string,
      mode: "question" | "commentary",
      options?: { audioBase64?: string; audioMimeType?: string; userLabel?: string },
    ) => {
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
          {
            id: crypto.randomUUID(),
            role: "user",
            kind: "question",
            text: options?.userLabel || prompt,
          },
        ]);
      }

      const result = await analyzeCameraFrame({
        data: {
          imageBase64,
          prompt,
          history,
          mode,
          audioBase64: options?.audioBase64,
          audioMimeType: options?.audioMimeType,
        },
      }).catch((err: unknown) => ({
        ok: false as const,
        message: err instanceof Error ? err.message : "Gemini request failed before analysis.",
      }));

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

  const runLiveScan = useCallback(async () => {
    if (busyRef.current || status.state !== "ready") return;
    setScanState("capturing");
    const imageFramesBase64 = await captureFrameSequence();
    const imageBase64 = imageFramesBase64.at(-1);
    if (!imageBase64) {
      setScanState("idle");
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "model",
          kind: "error",
          text: "Camera frame sequence is not ready yet.",
        },
      ]);
      return;
    }

    busyRef.current = true;
    setBusy(true);
    setScanState("analyzing");
    setLastScanFrames(imageFramesBase64.length);

    const result = await analyzeCameraFrame({
      data: {
        imageBase64,
        imageFramesBase64,
        prompt: LIVE_SCAN_PROMPT,
        history: historyRef.current,
        mode: "loss-scan",
      },
    }).catch((err: unknown) => ({
      ok: false as const,
      message: err instanceof Error ? err.message : "Gemini live scan failed before analysis.",
    }));

    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: "model",
        kind: result.ok ? "loss-scan" : "error",
        text: result.ok ? result.text : result.message,
      },
    ]);
    if (result.ok) setLastModel(result.model);
    busyRef.current = false;
    setBusy(false);
    setScanState("idle");
  }, [captureFrameSequence, status.state]);

  const publishObjectGoneAlert = useCallback(async () => {
    setVisualAlertState("sending");
    const result = await publishVisualAlert({
      eventId: `event-${Date.now()}-object-gone`,
      cameraId: "CAM-03",
      zone: "Moving camera",
      summary: OBJECT_GONE_ALERT,
      confidence: 0.86,
    });

    if (result.ok) {
      setVisualAlertState("sent");
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "model",
          kind: "object-watch",
          text: "walkie-talkie alert sent.",
        },
      ]);
      return;
    }

    setVisualAlertState("error");
    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: "model",
        kind: "error",
        text: `Visual alert detected, but walkie-talkie publish failed: ${result.message}`,
      },
    ]);
  }, []);

  const checkForObject = useCallback(async () => {
    if (objectCheckingRef.current || busyRef.current || status.state !== "ready") return;
    const imageBase64 = captureFrame();
    if (!imageBase64) return;

    objectCheckingRef.current = true;
    busyRef.current = true;
    setBusy(true);
    setObjectState("checking");
    setObjectAttempts((value) => value + 1);

    const result = await analyzeCameraFrame({
      data: {
        imageBase64,
        prompt: OBJECT_WATCH_PROMPT,
        mode: "object-watch",
      },
    }).catch((err: unknown) => ({
      ok: false as const,
      message: err instanceof Error ? err.message : "Gemini object watch failed before analysis.",
    }));

    const objectGone = result.ok && /\bITEM_GONE\b/i.test(result.text);
    const objectVisible = result.ok && /\bITEM_VISIBLE\b/i.test(result.text);
    if (result.ok) setLastModel(result.model);

    if (objectGone && objectWatchRef.current) {
      if (objectWatchTimerRef.current !== null) window.clearInterval(objectWatchTimerRef.current);
      objectWatchTimerRef.current = null;
      objectWatchRef.current = false;
      setObjectWatch(false);
      setObjectState("gone");
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "model",
          kind: "object-watch",
          text: `${WATCHED_OBJECT_LABEL} disappeared from frame.`,
        },
      ]);
      await publishObjectGoneAlert();
    } else if (!result.ok) {
      if (objectWatchTimerRef.current !== null) window.clearInterval(objectWatchTimerRef.current);
      objectWatchTimerRef.current = null;
      objectWatchRef.current = false;
      setObjectWatch(false);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "model",
          kind: "error",
          text: result.message,
        },
      ]);
      setObjectState("idle");
    } else if (objectVisible) {
      setObjectState("visible");
    } else {
      setObjectState("checking");
    }

    busyRef.current = false;
    setBusy(false);
    objectCheckingRef.current = false;
  }, [captureFrame, publishObjectGoneAlert, status.state]);

  const stopVoiceInput = useCallback(async () => {
    const recorder = voiceRecorderRef.current;
    if (!recorder) return;
    voiceRecorderRef.current = null;
    stopVoiceRecorder(recorder);

    const durationMs = Date.now() - recorder.startedAt;
    setVoiceDurationMs(durationMs);
    if (durationMs < MIN_VOICE_RECORD_MS || recorder.chunks.length === 0) {
      setVoiceState("idle");
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "model",
          kind: "error",
          text: "Voice clip was too short to analyze.",
        },
      ]);
      return;
    }

    setVoiceState("processing");
    const samples = mergeFloat32Chunks(recorder.chunks);
    const wav = encodeWav(samples, recorder.sampleRate);
    const audioBase64 = await blobToDataUrl(wav);
    await askGemini(
      "Answer the user's spoken request using the attached microphone audio and current camera frame.",
      "question",
      {
        audioBase64,
        audioMimeType: "audio/wav",
        userLabel: `Voice question (${formatDuration(durationMs)})`,
      },
    );
    setVoiceState("idle");
    setVoiceDurationMs(0);
  }, [askGemini]);

  const startVoiceInput = useCallback(async () => {
    if (busy || status.state !== "ready" || voiceState !== "idle") return;
    const stream = streamRef.current;
    const audioTrack = stream?.getAudioTracks()[0];
    if (!stream || !audioTrack) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "model",
          kind: "error",
          text: "Microphone is not available.",
        },
      ]);
      return;
    }

    try {
      const AudioContextCtor =
        window.AudioContext || (window as WindowWithWebkitAudioContext).webkitAudioContext;
      if (!AudioContextCtor) throw new Error("Web Audio recording is not supported.");

      const context = new AudioContextCtor();
      await context.resume();
      const source = context.createMediaStreamSource(new MediaStream([audioTrack]));
      const processor = context.createScriptProcessor(4096, 1, 1);
      const chunks: Float32Array[] = [];

      processor.onaudioprocess = (event) => {
        chunks.push(new Float32Array(event.inputBuffer.getChannelData(0)));
        event.outputBuffer.getChannelData(0).fill(0);
      };

      source.connect(processor);
      processor.connect(context.destination);

      const startedAt = Date.now();
      const durationTimer = window.setInterval(() => {
        setVoiceDurationMs(Date.now() - startedAt);
      }, 120);
      const stopTimer = window.setTimeout(() => {
        void stopVoiceInput();
      }, MAX_VOICE_RECORD_MS);

      voiceRecorderRef.current = {
        context,
        source,
        processor,
        chunks,
        sampleRate: context.sampleRate,
        startedAt,
        durationTimer,
        stopTimer,
      };
      setVoiceDurationMs(0);
      setVoiceState("recording");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setVoiceState("idle");
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "model",
          kind: "error",
          text: message,
        },
      ]);
    }
  }, [busy, status.state, stopVoiceInput, voiceState]);

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

  useEffect(() => {
    if (liveScanTimerRef.current !== null) {
      window.clearInterval(liveScanTimerRef.current);
      liveScanTimerRef.current = null;
    }
    if (!liveScan || status.state !== "ready") return;

    void runLiveScan();
    liveScanTimerRef.current = window.setInterval(() => {
      void runLiveScan();
    }, LIVE_SCAN_CYCLE_MS);

    return () => {
      if (liveScanTimerRef.current !== null) window.clearInterval(liveScanTimerRef.current);
      liveScanTimerRef.current = null;
    };
  }, [liveScan, runLiveScan, status.state]);

  useEffect(() => {
    objectWatchRef.current = objectWatch;
    if (objectWatchTimerRef.current !== null) {
      window.clearInterval(objectWatchTimerRef.current);
      objectWatchTimerRef.current = null;
    }
    if (!objectWatch || status.state !== "ready") return;

    setObjectState("idle");
    setObjectAttempts(0);
    setVisualAlertState("idle");
    void checkForObject();
    objectWatchTimerRef.current = window.setInterval(() => {
      void checkForObject();
    }, OBJECT_WATCH_INTERVAL_MS);

    return () => {
      if (objectWatchTimerRef.current !== null) window.clearInterval(objectWatchTimerRef.current);
      objectWatchTimerRef.current = null;
      objectWatchRef.current = false;
    };
  }, [checkForObject, objectWatch, status.state]);

  const canAsk = status.state === "ready" && !busy;
  const canRecordVoice = status.state === "ready" && !busy && voiceState !== "processing";
  const canLiveScan = status.state === "ready" && (!busy || liveScan);
  const canObjectWatch = status.state === "ready" && (!busy || objectWatch);

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
            onClick={() => setObjectWatch((value) => !value)}
            disabled={!canObjectWatch}
            className={[
              "mono inline-flex h-9 items-center gap-2 rounded-md border px-3 text-[10px] uppercase tracking-[0.16em] transition disabled:cursor-not-allowed disabled:opacity-40",
              objectWatch
                ? "border-primary/50 bg-primary/15 text-primary"
                : "border-border bg-background/50 text-muted-foreground hover:border-primary/50 hover:text-foreground",
            ].join(" ")}
          >
            {objectState === "checking" || visualAlertState === "sending" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : objectWatch ? (
              <Square className="h-3.5 w-3.5" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            {objectWatch ? `stop ${WATCHED_OBJECT_LABEL}` : `watch ${WATCHED_OBJECT_LABEL}`}
          </button>
          <button
            type="button"
            onClick={() => setLiveScan((value) => !value)}
            disabled={!canLiveScan}
            className={[
              "mono inline-flex h-9 items-center gap-2 rounded-md border px-3 text-[10px] uppercase tracking-[0.16em] transition disabled:cursor-not-allowed disabled:opacity-40",
              liveScan
                ? "border-alert/50 bg-alert/15 text-alert"
                : "border-border bg-background/50 text-muted-foreground hover:border-alert/50 hover:text-foreground",
            ].join(" ")}
          >
            {scanState !== "idle" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : liveScan ? (
              <Square className="h-3.5 w-3.5" />
            ) : (
              <ShieldAlert className="h-3.5 w-3.5" />
            )}
            {liveScan ? "stop scan" : "live scan"}
          </button>
          <button
            type="button"
            onClick={voiceState === "recording" ? stopVoiceInput : startVoiceInput}
            disabled={!canRecordVoice}
            className={[
              "mono inline-flex h-9 items-center gap-2 rounded-md border px-3 text-[10px] uppercase tracking-[0.16em] transition disabled:cursor-not-allowed disabled:opacity-40",
              voiceState === "recording"
                ? "border-alert/50 bg-alert/15 text-alert"
                : "border-border bg-background/50 text-muted-foreground hover:border-primary/50 hover:text-foreground",
            ].join(" ")}
          >
            {voiceState === "processing" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : voiceState === "recording" ? (
              <Square className="h-3.5 w-3.5" />
            ) : (
              <Mic className="h-3.5 w-3.5" />
            )}
            {voiceState === "recording"
              ? "stop voice"
              : voiceState === "processing"
                ? "sending"
                : "speak"}
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

      <section className="mx-auto mt-4 grid min-h-0 w-full max-w-7xl flex-1 gap-4 xl:grid-cols-[minmax(0,1.16fr)_minmax(390px,0.84fr)]">
        <div className="flex min-h-0 flex-col rounded-lg border border-border bg-panel/85">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-primary" />
              <span className="mono text-[11px] uppercase tracking-[0.2em]">camera preview</span>
            </div>
            <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
              {videoDevices.length > 1 && (
                <select
                  value={activeDeviceId || ""}
                  onChange={(event) => void switchCamera(event.target.value)}
                  disabled={switchingCamera || status.state !== "ready"}
                  className="mono h-8 max-w-[240px] rounded-md border border-border bg-background/60 px-2 text-[10px] uppercase tracking-[0.12em] text-muted-foreground outline-none transition focus:border-primary/60 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Select camera"
                  title="Select camera"
                >
                  {videoDevices.map((device, index) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {friendlyCameraLabel(device, index)}
                    </option>
                  ))}
                </select>
              )}
              {switchingCamera && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
              {lastModel && (
                <span className="mono rounded-full border border-border bg-background/40 px-2.5 py-1 text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
                  {lastModel}
                </span>
              )}
            </div>
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

          <div className="grid gap-2 border-t border-border px-4 py-3 sm:grid-cols-6">
            <InfoTile
              label="camera"
              value={status.state === "ready" ? status.cameraLabel : "pending"}
            />
            <InfoTile
              label="microphone"
              value={status.state === "ready" ? status.microphoneLabel : "pending"}
            />
            <InfoTile label="analysis" value={autoCommentary ? "continuous" : "on demand"} />
            <InfoTile
              label="scan"
              value={
                liveScan
                  ? scanState === "capturing"
                    ? `capturing ${LIVE_SCAN_FRAME_COUNT}`
                    : scanState === "analyzing"
                      ? "analyzing"
                      : `${lastScanFrames || LIVE_SCAN_FRAME_COUNT} frames`
                  : "off"
              }
            />
            <InfoTile
              label={WATCHED_OBJECT_LABEL}
              value={
                visualAlertState === "sending"
                  ? "alerting"
                  : visualAlertState === "sent"
                    ? "alert sent"
                    : objectState === "gone"
                      ? "gone"
                      : objectWatch
                        ? objectState === "checking"
                          ? `checking ${objectAttempts}`
                          : objectState === "visible"
                            ? `visible ${objectAttempts}`
                            : `watching ${objectAttempts}`
                        : "off"
              }
            />
            <InfoTile
              label="voice"
              value={
                voiceState === "recording"
                  ? formatDuration(voiceDurationMs)
                  : voiceState === "processing"
                    ? "sending"
                    : "ready"
              }
            />
          </div>
        </div>

        <aside className="flex min-h-[560px] min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-panel/85 xl:max-h-[calc(100vh-9rem)]">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              <span className="mono text-[11px] uppercase tracking-[0.2em]">visual chat</span>
            </div>
            {busy && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
          </div>

          <div ref={chatRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.length === 0 ? (
              <div className="flex h-full items-center justify-center px-4 text-center">
                <div>
                  <Bot className="mx-auto h-8 w-8 text-primary/80" />
                  <div className="mono mt-3 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    ask about the current frame
                  </div>
                  <p className="mt-2 max-w-xs text-xs leading-5 text-muted-foreground">
                    Try: "What changed?", "Describe the scene", turn on live scan, or watch for a
                    {WATCHED_OBJECT_LABEL} disappearance.
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

function stopVoiceRecorder(recorder: VoiceRecorder | null) {
  if (!recorder) return;
  window.clearInterval(recorder.durationTimer);
  window.clearTimeout(recorder.stopTimer);
  recorder.processor.disconnect();
  recorder.source.disconnect();
  void recorder.context.close();
}

function mergeFloat32Chunks(chunks: Float32Array[]) {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const merged = new Float32Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return merged;
}

function encodeWav(samples: Float32Array, sampleRate: number) {
  const bytesPerSample = 2;
  const blockAlign = bytesPerSample;
  const buffer = new ArrayBuffer(44 + samples.length * bytesPerSample);
  const view = new DataView(buffer);

  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + samples.length * bytesPerSample, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, samples.length * bytesPerSample, true);

  let offset = 44;
  for (const sample of samples) {
    const clamped = Math.max(-1, Math.min(1, sample));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    offset += bytesPerSample;
  }

  return new Blob([view], { type: "audio/wav" });
}

function writeAscii(view: DataView, offset: number, value: string) {
  for (let i = 0; i < value.length; i += 1) {
    view.setUint8(offset + i, value.charCodeAt(i));
  }
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error || new Error("Could not read voice clip."));
    reader.readAsDataURL(blob);
  });
}

function formatDuration(ms: number) {
  return `${Math.max(0, ms / 1000).toFixed(1)}s`;
}

function delay(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
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
                : message.kind === "loss-scan"
                  ? "gemini · live scan"
                  : message.kind === "object-watch"
                    ? `gemini · ${WATCHED_OBJECT_LABEL.toLowerCase()} watch`
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
