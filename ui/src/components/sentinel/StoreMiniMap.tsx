import { floorPlan } from "@/lib/sentinel-data";

type Props = {
  alertCameraId?: string | null;
};

export function StoreMiniMap({ alertCameraId }: Props) {
  return (
    <div className="flex h-full flex-col rounded-md border border-border bg-panel/60 p-2.5 backdrop-blur-sm">
      <div className="mono mb-2 flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-muted-foreground/80">
        <span>store · floor plan</span>
        <span>store 042 · kreuzberg</span>
      </div>
      <div
        className="relative min-h-0 flex-1 overflow-hidden rounded border border-border/80 bg-background/60"
        style={{
          backgroundImage:
            "linear-gradient(var(--grid-line) 1px, transparent 1px), linear-gradient(90deg, var(--grid-line) 1px, transparent 1px)",
          backgroundSize: "16px 16px",
        }}
      >
        <div className="absolute inset-x-4 top-[18%] h-[1px] bg-border/80" />
        <div className="absolute inset-x-4 top-[26%] h-[1px] bg-border/60" />
        <div className="absolute inset-x-4 bottom-[18%] h-[1px] bg-border/80" />

        {floorPlan.map((dot) => {
          const isAlert = dot.id === alertCameraId;
          return (
            <div
              key={dot.id}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${dot.x}%`, top: `${dot.y}%` }}
              title={`${dot.id} · ${dot.label}`}
            >
              <span
                className={[
                  "block h-2 w-2 rounded-full",
                  isAlert
                    ? "bg-alert animate-alert-pulse"
                    : "bg-ok/80 animate-soft-pulse",
                ].join(" ")}
              />
              <span
                className={[
                  "mono mt-0.5 block whitespace-nowrap text-[8px] uppercase tracking-wider",
                  isAlert ? "text-alert" : "text-muted-foreground/70",
                ].join(" ")}
              >
                {dot.id.replace("CAM-", "")}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
