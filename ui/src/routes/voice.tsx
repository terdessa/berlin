import { createFileRoute } from "@tanstack/react-router";
import { Mic } from "lucide-react";
import { useSentinelRoom } from "@/lib/use-sentinel-room";

export const Route = createFileRoute("/voice")({
  component: VoicePage,
  head: () => ({
    meta: [
      { title: "Sentinel — Guard Walkie-Talkie" },
      {
        name: "description",
        content:
          "Phone-based push-to-talk walkie-talkie that joins the Sentinel voice room with ai-coustics noise enhancement.",
      },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
    ],
  }),
});

function VoicePage() {
  const sentinel = useSentinelRoom({ withMic: true });

  const ready = sentinel.status.state === "connected";
  const statusLabel = (() => {
    switch (sentinel.status.state) {
      case "idle":
        return "starting…";
      case "connecting":
        return "connecting…";
      case "media-error":
        return "mic blocked";
      case "error":
        return "voice offline";
      case "connected":
        return sentinel.micOn ? "transmitting" : "ready";
    }
  })();

  const statusDetail = (() => {
    if (sentinel.status.state === "media-error") return sentinel.status.message;
    if (sentinel.status.state === "error") return sentinel.status.message;
    if (sentinel.status.state === "connected")
      return sentinel.micOn ? "release to send" : "press and hold to talk";
    return "joining sentinel-live room";
  })();

  return (
    <main className="flex min-h-screen w-full flex-col items-stretch bg-background px-5 py-6 text-foreground">
      <header className="flex items-center justify-between">
        <div className="mono text-[10px] uppercase tracking-[0.22em] text-primary">sentinel</div>
        <div
          className={[
            "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.18em]",
            sentinel.micOn
              ? "border-alert/60 bg-alert/15 text-alert"
              : ready
                ? "border-ok/40 bg-ok/10 text-ok"
                : "border-border bg-panel/70 text-muted-foreground",
          ].join(" ")}
        >
          <span
            className={[
              "h-2 w-2 rounded-full",
              sentinel.micOn
                ? "bg-alert animate-alert-pulse"
                : ready
                  ? "bg-ok animate-soft-pulse"
                  : "bg-muted-foreground/60",
            ].join(" ")}
          />
          {statusLabel}
        </div>
      </header>

      <div className="mt-8 flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Guard walkie-talkie</h1>
        <p className="max-w-xs text-sm text-muted-foreground">
          Hold the button to talk to Sentinel. ai-coustics enhances your voice and Gemini watches
          the camera for you.
        </p>
      </div>

      <div className="mt-auto flex flex-col items-center gap-6 pb-8 pt-12">
        <button
          type="button"
          disabled={!ready}
          onPointerDown={(event) => {
            if (!ready) return;
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            sentinel.startTalking();
          }}
          onPointerUp={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              event.currentTarget.releasePointerCapture(event.pointerId);
            }
            sentinel.stopTalking();
          }}
          onPointerCancel={() => sentinel.stopTalking()}
          onPointerLeave={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) return;
            sentinel.stopTalking();
          }}
          onContextMenu={(event) => event.preventDefault()}
          className={[
            "mono flex h-56 w-56 select-none flex-col items-center justify-center gap-3 rounded-full border-4 text-sm uppercase tracking-[0.22em] transition disabled:cursor-not-allowed disabled:opacity-50",
            sentinel.micOn
              ? "border-alert bg-alert/20 text-alert shadow-[0_0_0_8px_rgba(255,80,80,0.18)]"
              : "border-primary/70 bg-panel/80 text-primary hover:bg-panel",
          ].join(" ")}
          aria-pressed={sentinel.micOn}
          aria-label="Hold to talk"
          style={{ touchAction: "none", WebkitUserSelect: "none", userSelect: "none" }}
        >
          <Mic className="h-12 w-12" />
          <span>{sentinel.micOn ? "talking" : "hold"}</span>
        </button>

        <p className="mono text-center text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          {statusDetail}
        </p>

        {sentinel.needsPlaybackUnlock && (
          <button
            type="button"
            onClick={() => void sentinel.unlockPlayback()}
            className="mono rounded-md border border-amber-400/60 bg-amber-500/15 px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-amber-200 transition hover:bg-amber-500/25"
          >
            tap to hear sentinel
          </button>
        )}
      </div>
    </main>
  );
}
