import type { PastReview } from "@/lib/sentinel-data";

type Props = {
  reviews: PastReview[];
  onSelect?: (id: string) => void;
};

const statusTone: Record<PastReview["status"], string> = {
  "Awaiting human review": "border-alert/40 text-alert",
  "Floor associate dispatched": "border-primary/40 text-primary",
  "Marked false alarm": "border-border text-muted-foreground",
  "Error report created": "border-destructive/40 text-destructive",
};

export function ReviewHistoryStrip({ reviews, onSelect }: Props) {
  return (
    <div className="rounded-md border border-border bg-panel/60 p-3 backdrop-blur-sm">
      <div className="mono mb-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground/80">
        recent reviews · today
      </div>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-5">
        {reviews.map((r) => (
          <button
            type="button"
            key={r.id}
            onClick={() => onSelect?.(r.id)}
            className="cursor-pointer rounded-md border border-border bg-background/40 p-2 text-left transition hover:border-primary/40 hover:bg-background/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="mono flex items-center justify-between text-[10px] text-muted-foreground">
              <span>{r.timestamp}</span>
              <span>{r.cameraId}</span>
            </div>
            <div className="mt-1 line-clamp-2 text-[12px] text-foreground/90">
              {r.summary}
            </div>
            <div className="mt-2">
              <span
                className={[
                  "mono inline-block rounded-full border px-1.5 py-0.5 text-[9px] uppercase tracking-wider",
                  statusTone[r.status],
                ].join(" ")}
              >
                {r.status}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
