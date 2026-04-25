import { useState } from "react";
import { cameras, cam05Alert, type AlertEvent } from "@/lib/sentinel-data";
import { CameraTile } from "./CameraTile";
import { AlertVideoPanel } from "./AlertVideoPanel";
import { ReviewLogPanel } from "./ReviewLogPanel";

export function SentinelDashboard() {
  const [alert, setAlert] = useState<AlertEvent | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const isAlerting = alert !== null;

  const toggleDemo = () => {
    if (alert) {
      setAlert(null);
      setSelected(null);
    } else {
      setAlert(cam05Alert);
      setSelected("CAM-05");
    }
  };

  return (
    <main className="relative min-h-screen w-full px-6 py-5">
      {/* Ambient status */}
      <div className="pointer-events-none fixed left-5 top-5 z-40">
        <div
          aria-live="polite"
          className={[
            "pointer-events-auto inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs backdrop-blur-sm transition-colors",
            isAlerting
              ? "bg-alert/10 text-alert"
              : "bg-background/40 text-foreground/90",
          ].join(" ")}
        >
          <span
            className={[
              "h-2 w-2 rounded-full",
              isAlerting ? "bg-alert animate-alert-pulse" : "bg-ok animate-soft-pulse",
            ].join(" ")}
          />
          <span className="mono uppercase tracking-[0.18em] text-[10px]">
            {isAlerting
              ? `Sentinel flagged ${alert.cameraId} — requires review`
              : "Sentinel is watching"}
          </span>
        </div>
      </div>

      {/* Demo toggle */}
      <div className="fixed right-5 top-5 z-40">
        <button
          onClick={toggleDemo}
          className={[
            "mono inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] backdrop-blur-sm transition",
            isAlerting
              ? "border-alert/50 bg-alert/10 text-alert hover:bg-alert/20"
              : "border-border bg-background/40 text-muted-foreground hover:text-foreground",
          ].join(" ")}
          aria-pressed={isAlerting}
        >
          <span
            className={[
              "h-1.5 w-1.5 rounded-full",
              isAlerting ? "bg-alert" : "bg-muted-foreground",
            ].join(" ")}
          />
          demo · simulate CAM-05 {isAlerting ? "on" : "off"}
        </button>
      </div>

      {/* Camera grid */}
      <section
        aria-label="Camera grid"
        className="mt-14 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
        style={{ minHeight: "40vh" }}
      >
        {cameras.map((cam) => (
          <CameraTile
            key={cam.id}
            camera={cam}
            isAlert={alert?.cameraId === cam.id}
            isSelected={selected === cam.id}
            onClick={() => setSelected(cam.id)}
          />
        ))}
      </section>

      {/* Lower band: alert video + log */}
      <section className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="min-h-[360px]">
          <AlertVideoPanel alert={alert} />
        </div>

        <div className="min-h-[360px]">
          {alert ? (
            <ReviewLogPanel alert={alert} />
          ) : (
            <div className="flex h-full min-h-[360px] flex-col items-center justify-center rounded-lg border border-dashed border-border bg-panel/30 text-center">
              <div className="mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                review log · collapsed
              </div>
              <div className="mt-2 max-w-xs px-6 text-xs text-muted-foreground/70">
                The review record opens here when Sentinel flags a camera for human review.
              </div>
            </div>
          )}
        </div>
      </section>

      <footer className="mt-6 flex items-center justify-between text-[10px] text-muted-foreground/70">
        <span className="mono uppercase tracking-[0.2em]">sentinel · retail security ops</span>
        <span className="mono">cameras: video-only · audio: external earpiece device</span>
      </footer>
    </main>
  );
}
